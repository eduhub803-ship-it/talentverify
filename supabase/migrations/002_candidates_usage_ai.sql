-- HR candidate directory
CREATE TABLE candidates (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  cv_url TEXT,
  skills TEXT[] DEFAULT '{}',
  experience_years INT,
  education TEXT,
  ai_summary TEXT,
  job_match_score INT,
  location TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Freemium usage limits
CREATE TABLE usage_limits (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, feature)
);

CREATE INDEX idx_usage_limits_user ON usage_limits(user_id);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;

-- Candidates: HR (approved org) read verified; candidate read/update own; admin all
CREATE POLICY candidates_hr_read ON candidates FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM candidate_profiles cp
    WHERE cp.user_id = candidates.id
      AND cp.verification_status = 'verified'
      AND EXISTS (
        SELECT 1 FROM hr_members hm
        JOIN hr_organizations ho ON ho.id = hm.organization_id
        WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
      )
  )
);

CREATE POLICY candidates_own ON candidates FOR ALL USING (auth.uid() = id);

CREATE POLICY candidates_admin ON candidates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Usage limits: users manage own row
CREATE POLICY usage_own_select ON usage_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY usage_own_insert ON usage_limits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY usage_own_update ON usage_limits FOR UPDATE USING (auth.uid() = user_id);
