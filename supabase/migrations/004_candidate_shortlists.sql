-- HR shortlist workflow

CREATE TABLE IF NOT EXISTS candidate_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES hr_organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (hr_user_id, candidate_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_shortlists_hr
  ON candidate_shortlists(hr_user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_candidate_shortlists_candidate
  ON candidate_shortlists(candidate_id);

ALTER TABLE candidate_shortlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidate_shortlists_hr_select ON candidate_shortlists
  FOR SELECT USING (
    hr_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM hr_members hm
      JOIN hr_organizations ho ON ho.id = hm.organization_id
      WHERE hm.user_id = auth.uid()
        AND hm.organization_id = candidate_shortlists.organization_id
        AND ho.status = 'approved'
    )
  );

CREATE POLICY candidate_shortlists_hr_insert ON candidate_shortlists
  FOR INSERT WITH CHECK (
    hr_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM candidate_profiles cp
      WHERE cp.user_id = candidate_shortlists.candidate_id
        AND cp.verification_status = 'verified'
    )
    AND EXISTS (
      SELECT 1
      FROM hr_members hm
      JOIN hr_organizations ho ON ho.id = hm.organization_id
      WHERE hm.user_id = auth.uid()
        AND hm.organization_id = candidate_shortlists.organization_id
        AND ho.status = 'approved'
    )
  );

CREATE POLICY candidate_shortlists_hr_delete ON candidate_shortlists
  FOR DELETE USING (
    hr_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM hr_members hm
      JOIN hr_organizations ho ON ho.id = hm.organization_id
      WHERE hm.user_id = auth.uid()
        AND hm.organization_id = candidate_shortlists.organization_id
        AND ho.status = 'approved'
    )
  );
