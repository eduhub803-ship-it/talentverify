-- Candidate Talent Passport foundation

CREATE SEQUENCE IF NOT EXISTS seh_talent_id_seq START 1;

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS seh_talent_id TEXT,
  ADD COLUMN IF NOT EXISTS structured_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS education JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS projects JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seh_training JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS credentials JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS career_preferences JSONB NOT NULL DEFAULT '{
    "openToWork": true,
    "employmentTypes": [],
    "preferredFields": [],
    "preferredLocations": [],
    "remotePreference": "flexible",
    "availabilityTiming": "immediate"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS employer_visible BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_profiles_seh_talent_id
  ON candidate_profiles(seh_talent_id)
  WHERE seh_talent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_employer_visible
  ON candidate_profiles(employer_visible)
  WHERE employer_visible = true;

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_structured_skills
  ON candidate_profiles USING GIN (structured_skills);

UPDATE candidate_profiles
SET employer_visible = true
WHERE verification_status = 'verified'
  AND employer_visible = false;

CREATE OR REPLACE FUNCTION assign_seh_talent_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.seh_talent_id IS NULL THEN
    NEW.seh_talent_id :=
      'SEH-' ||
      EXTRACT(YEAR FROM now())::int ||
      '-' ||
      lpad(nextval('seh_talent_id_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_seh_talent_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.seh_talent_id IS DISTINCT FROM NEW.seh_talent_id THEN
    RAISE EXCEPTION 'SEH Talent ID is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_seh_talent_id ON candidate_profiles;
CREATE TRIGGER trg_assign_seh_talent_id
  BEFORE INSERT ON candidate_profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_seh_talent_id();

SELECT setval(
  'seh_talent_id_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX((regexp_match(seh_talent_id, '^SEH-[0-9]{4}-([0-9]+)$'))[1]::bigint)
        FROM candidate_profiles
        WHERE seh_talent_id ~ '^SEH-[0-9]{4}-[0-9]+$'
      ),
      0
    ),
    1
  ),
  true
);

UPDATE candidate_profiles
SET seh_talent_id =
  'SEH-' ||
  EXTRACT(YEAR FROM now())::int ||
  '-' ||
  lpad(nextval('seh_talent_id_seq')::text, 6, '0')
WHERE seh_talent_id IS NULL;

DROP TRIGGER IF EXISTS trg_prevent_seh_talent_id_change ON candidate_profiles;
CREATE TRIGGER trg_prevent_seh_talent_id_change
  BEFORE UPDATE ON candidate_profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_seh_talent_id_change();

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS seh_talent_id TEXT,
  ADD COLUMN IF NOT EXISTS structured_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS employer_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_to_work BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS employment_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_fields TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_locations TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS remote_preference TEXT,
  ADD COLUMN IF NOT EXISTS availability_timing TEXT;

CREATE INDEX IF NOT EXISTS idx_candidates_employer_visible
  ON candidates(employer_visible)
  WHERE employer_visible = true;

CREATE INDEX IF NOT EXISTS idx_candidates_preferred_fields
  ON candidates USING GIN (preferred_fields);

CREATE INDEX IF NOT EXISTS idx_candidates_employment_types
  ON candidates USING GIN (employment_types);

UPDATE candidates c
SET
  seh_talent_id = cp.seh_talent_id,
  structured_skills = cp.structured_skills,
  employer_visible = cp.employer_visible,
  open_to_work = COALESCE((cp.career_preferences->>'openToWork')::boolean, true),
  employment_types = COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(cp.career_preferences->'employmentTypes')),
    '{}'
  ),
  preferred_fields = COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(cp.career_preferences->'preferredFields')),
    '{}'
  ),
  preferred_locations = COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(cp.career_preferences->'preferredLocations')),
    '{}'
  ),
  remote_preference = cp.career_preferences->>'remotePreference',
  availability_timing = cp.career_preferences->>'availabilityTiming'
FROM candidate_profiles cp
WHERE cp.user_id = c.id;

ALTER POLICY profiles_select ON profiles USING (
  auth.uid() = id
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  OR EXISTS (
    SELECT 1 FROM candidate_profiles cp
    WHERE cp.user_id = profiles.id
      AND cp.verification_status = 'verified'
      AND cp.employer_visible = true
      AND EXISTS (
        SELECT 1 FROM hr_members hm
        JOIN hr_organizations ho ON ho.id = hm.organization_id
        WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
      )
  )
);

ALTER POLICY candidate_hr_read ON candidate_profiles USING (
  verification_status = 'verified'
  AND employer_visible = true
  AND EXISTS (
    SELECT 1 FROM hr_members hm
    JOIN hr_organizations ho ON ho.id = hm.organization_id
    WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
  )
);

ALTER POLICY candidates_hr_read ON candidates USING (
  employer_visible = true
  AND EXISTS (
    SELECT 1 FROM candidate_profiles cp
    WHERE cp.user_id = candidates.id
      AND cp.verification_status = 'verified'
      AND cp.employer_visible = true
      AND EXISTS (
        SELECT 1 FROM hr_members hm
        JOIN hr_organizations ho ON ho.id = hm.organization_id
        WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
      )
  )
);
