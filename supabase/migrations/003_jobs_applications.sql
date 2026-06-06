-- Jobs and applications module

DO $$
BEGIN
  CREATE TYPE job_status AS ENUM ('open', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE application_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT[] DEFAULT '{}',
  experience_level TEXT,
  location TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status job_status NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  cv_url TEXT,
  message TEXT,
  status application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_hr_select ON jobs FOR SELECT USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM hr_members hm
    JOIN hr_organizations ho ON ho.id = hm.organization_id
    WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
  )
);

CREATE POLICY jobs_candidate_open_select ON jobs FOR SELECT USING (
  status = 'open'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'candidate'
  )
);

CREATE POLICY jobs_hr_insert ON jobs FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM hr_members hm
    JOIN hr_organizations ho ON ho.id = hm.organization_id
    WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
  )
);

CREATE POLICY jobs_hr_update ON jobs FOR UPDATE USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM hr_members hm
    JOIN hr_organizations ho ON ho.id = hm.organization_id
    WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
  )
);

CREATE POLICY applications_candidate_insert ON applications FOR INSERT WITH CHECK (
  candidate_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_id AND j.status = 'open'
  )
);

CREATE POLICY applications_candidate_select ON applications FOR SELECT USING (
  candidate_id = auth.uid()
);

CREATE POLICY applications_hr_select ON applications FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_id AND j.created_by = auth.uid()
  )
);

CREATE POLICY applications_hr_update ON applications FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_id AND j.created_by = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_id AND j.created_by = auth.uid()
  )
);

CREATE POLICY profiles_hr_applicant_read ON profiles FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.candidate_id = profiles.id
      AND j.created_by = auth.uid()
  )
);

CREATE POLICY candidate_profiles_hr_applicant_read ON candidate_profiles FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.candidate_id = candidate_profiles.user_id
      AND j.created_by = auth.uid()
  )
);

CREATE POLICY candidates_hr_applicant_read ON candidates FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.candidate_id = candidates.id
      AND j.created_by = auth.uid()
  )
);
