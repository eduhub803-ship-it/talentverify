-- Career Services catalog expansion (services 09-26)
--
-- Keeps the server-side security view of the catalog in step with
-- src/features/career-services/catalog.ts, and teaches the creation routine to
-- enforce service prerequisites (service 26 needs a completed mock interview).
--
-- Additive and idempotent. No destructive SQL. Migration 009 is left untouched.

/* ------------------------------------------------------------------ */
/* 1. Prerequisites                                                    */
/* ------------------------------------------------------------------ */

ALTER TABLE career_service_catalog
  ADD COLUMN IF NOT EXISTS prerequisite_code TEXT;

/* ------------------------------------------------------------------ */
/* 2. Catalog rows                                                     */
/* ------------------------------------------------------------------ */

-- pricing_type / self_service / allows_repeat_requests / active are the flags
-- the server uses to derive an initial status and enforce duplicates. Service
-- 22 (AI Interview Simulator) is seeded inactive so the creation routine
-- refuses it even if a client asks for it by code.
INSERT INTO career_service_catalog
  (code, pricing_type, self_service, allows_repeat_requests, active, prerequisite_code)
VALUES
  ('07', 'free',    true,  true,  true,  NULL),  -- CV Readiness Check
  ('08', 'paid',    false, false, true,  NULL),  -- Professional CV Writing
  ('09', 'paid',    false, false, true,  NULL),  -- ATS-Friendly CV Optimization
  ('10', 'paid',    false, true,  true,  NULL),  -- Job-Specific CV Customization
  ('11', 'paid',    false, false, true,  NULL),  -- NGO & INGO CV Preparation
  ('12', 'paid',    false, false, true,  NULL),  -- LinkedIn Profile Optimization
  ('13', 'free',    true,  true,  true,  NULL),  -- Job Application Readiness Check
  ('14', 'free',    false, true,  true,  NULL),  -- Job Description Analysis
  ('15', 'premium', false, true,  true,  NULL),  -- CV-to-Job Matching
  ('16', 'paid',    false, true,  true,  NULL),  -- Professional Cover Letter
  ('17', 'paid',    false, true,  true,  NULL),  -- Job Application Review
  ('18', 'premium', false, true,  true,  NULL),  -- NGO & INGO Application Preparation
  ('19', 'free',    true,  true,  true,  NULL),  -- Interview Readiness Assessment
  ('20', 'paid',    false, true,  true,  NULL),  -- Interview Preparation Session
  ('21', 'paid',    false, true,  true,  NULL),  -- Professional Mock Interview
  ('22', 'premium', false, false, false, NULL),  -- AI Interview Simulator (not built)
  ('23', 'paid',    false, true,  true,  NULL),  -- Competency-Based Interview Preparation
  ('24', 'paid',    false, true,  true,  NULL),  -- English Interview Preparation
  ('25', 'premium', false, true,  true,  NULL),  -- NGO & INGO Interview Preparation
  ('26', 'paid',    false, true,  true,  '21')   -- Interview Performance Report
ON CONFLICT (code) DO UPDATE SET
  pricing_type = EXCLUDED.pricing_type,
  self_service = EXCLUDED.self_service,
  allows_repeat_requests = EXCLUDED.allows_repeat_requests,
  active = EXCLUDED.active,
  prerequisite_code = EXCLUDED.prerequisite_code,
  updated_at = now();

/* ------------------------------------------------------------------ */
/* 3. Creation routine now enforces prerequisites                      */
/* ------------------------------------------------------------------ */

-- Identical to 009 apart from the prerequisite check. Everything a candidate
-- could otherwise forge is still derived here: candidate_id from auth.uid(),
-- status and payment_status from the catalog, and a result accepted only for a
-- free self-service assessment.
CREATE OR REPLACE FUNCTION public.career_service_create_request(
  target_service_code TEXT,
  candidate_input_value JSONB DEFAULT '{}'::jsonb,
  candidate_notes_value TEXT DEFAULT NULL,
  self_service_result JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  service career_service_catalog%ROWTYPE;
  blocking_status career_request_status;
  derived_status career_request_status;
  derived_payment career_payment_status;
  accepted_result JSONB := NULL;
  new_id UUID;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = caller AND p.role = 'candidate'
  ) THEN
    RAISE EXCEPTION 'Only candidates can request career services';
  END IF;

  SELECT * INTO service
  FROM career_service_catalog
  WHERE code = target_service_code;

  IF NOT FOUND OR NOT service.active THEN
    RAISE EXCEPTION 'This service is not currently available.';
  END IF;

  -- Prerequisite: some services only make sense after another has completed.
  IF service.prerequisite_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM career_service_requests r
    WHERE r.candidate_id = caller
      AND r.service_code = service.prerequisite_code
      AND r.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Complete the required prerequisite service before requesting this one.';
  END IF;

  SELECT r.status INTO blocking_status
  FROM career_service_requests r
  WHERE r.candidate_id = caller
    AND r.service_code = target_service_code
    AND (
      r.status NOT IN ('completed', 'cancelled')
      OR (NOT service.allows_repeat_requests AND r.status = 'completed')
    )
  ORDER BY (r.status = 'completed')
  LIMIT 1;

  IF blocking_status IS NOT NULL THEN
    IF blocking_status = 'completed' THEN
      RAISE EXCEPTION 'You have already completed this service. Contact the career team to request it again.';
    ELSE
      RAISE EXCEPTION 'You already have an open request for this service.';
    END IF;
  END IF;

  IF service.pricing_type = 'free' THEN
    derived_payment := 'not_required';
    IF service.self_service AND self_service_result IS NOT NULL THEN
      derived_status := 'completed';
      accepted_result := self_service_result;
    ELSE
      derived_status := 'ready';
    END IF;
  ELSE
    derived_payment := 'pending';
    derived_status := 'payment_pending';
  END IF;

  INSERT INTO career_service_requests (
    candidate_id, service_code, status, payment_status,
    candidate_input, candidate_notes, result, completed_at
  )
  VALUES (
    caller,
    target_service_code,
    derived_status,
    derived_payment,
    COALESCE(candidate_input_value, '{}'::jsonb),
    NULLIF(btrim(COALESCE(candidate_notes_value, '')), ''),
    accepted_result,
    CASE WHEN derived_status = 'completed' THEN now() ELSE NULL END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.career_service_create_request(TEXT, JSONB, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.career_service_create_request(TEXT, JSONB, TEXT, JSONB) TO authenticated;
