-- Activate remaining Privacy Policies v1.0
-- Privacy Policy, Data Policy, Employer Data Policy, Data Retention, Acceptable Use
-- Version: 1.0 | Effective: 13 September 2026

BEGIN;

-- Privacy Policy v1.0
UPDATE privacy_policies SET
  version = '1.0',
  effective_date = '2026-09-13',
  last_updated_date = '2026-09-13',
  is_active = true
WHERE policy_key = 'privacy_policy';

-- Candidate Data Policy v1.0
UPDATE privacy_policies SET
  version = '1.0',
  effective_date = '2026-09-13',
  last_updated_date = '2026-09-13',
  is_active = true
WHERE policy_key = 'candidate_data_policy';

-- Employer Data Policy v1.0
UPDATE privacy_policies SET
  version = '1.0',
  effective_date = '2026-09-13',
  last_updated_date = '2026-09-13',
  is_active = true
WHERE policy_key = 'employer_data_policy';

-- Data Retention Policy v1.0
UPDATE privacy_policies SET
  version = '1.0',
  effective_date = '2026-09-13',
  last_updated_date = '2026-09-13',
  is_active = true
WHERE policy_key = 'data_retention_deletion';

-- Acceptable Use Policy v1.0
UPDATE privacy_policies SET
  version = '1.0',
  effective_date = '2026-09-13',
  last_updated_date = '2026-09-13',
  is_active = true
WHERE policy_key = 'acceptable_use';

COMMIT;
