-- Bulk candidate import (SEH admin roster)
--
-- Imported candidates are stored in their own roster table. They are NOT auth
-- users and NOT rows in `candidate_profiles` / `candidates`, so:
--   * no Auth account is created by an import,
--   * no imported candidate is ever verified by an import,
--   * no imported candidate is ever visible to HR (HR policies only read
--     `candidates` / `candidate_profiles`),
--   * SEH Talent IDs keep being assigned by the existing trigger on
--     `candidate_profiles`, when (and only when) the person registers.
--
-- When a person later registers with the same email, the claim trigger below
-- pre-fills their real candidate profile from the roster row and marks it
-- claimed. Existing profile values are never overwritten.

CREATE TABLE IF NOT EXISTS candidate_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  total_rows INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  skipped_duplicate_count INT NOT NULL DEFAULT 0,
  conflict_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imported_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES candidate_import_batches(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  headline TEXT,
  bio TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  structured_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  education JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  seh_training JSONB NOT NULL DEFAULT '[]'::jsonb,
  career_preferences JSONB NOT NULL DEFAULT '{
    "openToWork": true,
    "employmentTypes": [],
    "preferredFields": [],
    "preferredLocations": [],
    "remotePreference": "flexible",
    "availabilityTiming": "immediate"
  }'::jsonb,
  linkedin_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'imported'
    CHECK (status IN ('imported', 'claimed')),
  claimed_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  source_row_number INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One roster row per email: re-running the same file cannot duplicate people.
CREATE UNIQUE INDEX IF NOT EXISTS idx_imported_candidates_normalized_email
  ON imported_candidates(normalized_email);

CREATE INDEX IF NOT EXISTS idx_imported_candidates_batch
  ON imported_candidates(batch_id);

CREATE INDEX IF NOT EXISTS idx_imported_candidates_status
  ON imported_candidates(status);

ALTER TABLE candidate_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_candidates ENABLE ROW LEVEL SECURITY;

-- Admin-only. HR has no policy at all on these tables, so the roster is
-- invisible to employers until the candidate registers, is verified and is
-- marked employer-visible through the existing rules.
DROP POLICY IF EXISTS candidate_import_batches_admin ON candidate_import_batches;
CREATE POLICY candidate_import_batches_admin ON candidate_import_batches FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS imported_candidates_admin ON imported_candidates;
CREATE POLICY imported_candidates_admin ON imported_candidates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- A candidate may read the roster row that was claimed by their own account,
-- so the "your data came from SEH" state can be shown after registration.
DROP POLICY IF EXISTS imported_candidates_own_claim ON imported_candidates;
CREATE POLICY imported_candidates_own_claim ON imported_candidates FOR SELECT USING (
  claimed_user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION touch_imported_candidate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_imported_candidate ON imported_candidates;
CREATE TRIGGER trg_touch_imported_candidate
  BEFORE UPDATE ON imported_candidates
  FOR EACH ROW
  EXECUTE FUNCTION touch_imported_candidate();

-- Claim: when a real candidate profile appears for an imported email, copy the
-- imported data into the empty fields of that profile. Verification status,
-- employer visibility and the SEH Talent ID are deliberately untouched.
CREATE OR REPLACE FUNCTION claim_imported_candidate()
RETURNS TRIGGER AS $$
DECLARE
  candidate_email TEXT;
  roster imported_candidates%ROWTYPE;
BEGIN
  SELECT lower(btrim(email)) INTO candidate_email
  FROM profiles
  WHERE id = NEW.user_id;

  IF candidate_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO roster
  FROM imported_candidates
  WHERE normalized_email = candidate_email
    AND status = 'imported'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE candidate_profiles cp
  SET
    headline = COALESCE(cp.headline, roster.headline),
    location = COALESCE(cp.location, roster.location),
    bio = COALESCE(cp.bio, roster.bio),
    skills = CASE
      WHEN cp.skills IS NULL OR cardinality(cp.skills) = 0 THEN roster.skills
      ELSE cp.skills
    END,
    structured_skills = CASE
      WHEN jsonb_array_length(cp.structured_skills) = 0 THEN roster.structured_skills
      ELSE cp.structured_skills
    END,
    languages = CASE
      WHEN jsonb_array_length(cp.languages) = 0 THEN roster.languages
      ELSE cp.languages
    END,
    education = CASE
      WHEN jsonb_array_length(cp.education) = 0 THEN roster.education
      ELSE cp.education
    END,
    experience = CASE
      WHEN jsonb_array_length(cp.experience) = 0 THEN roster.experience
      ELSE cp.experience
    END,
    seh_training = CASE
      WHEN jsonb_array_length(cp.seh_training) = 0 THEN roster.seh_training
      ELSE cp.seh_training
    END,
    career_preferences = CASE
      WHEN cp.career_preferences = '{}'::jsonb OR cp.career_preferences IS NULL
        THEN roster.career_preferences
      ELSE cp.career_preferences
    END,
    linkedin_url = COALESCE(cp.linkedin_url, roster.linkedin_url),
    updated_at = now()
  WHERE cp.user_id = NEW.user_id;

  UPDATE imported_candidates
  SET status = 'claimed',
      claimed_user_id = NEW.user_id,
      claimed_at = now()
  WHERE id = roster.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_claim_imported_candidate ON candidate_profiles;
CREATE TRIGGER trg_claim_imported_candidate
  AFTER INSERT ON candidate_profiles
  FOR EACH ROW
  EXECUTE FUNCTION claim_imported_candidate();
