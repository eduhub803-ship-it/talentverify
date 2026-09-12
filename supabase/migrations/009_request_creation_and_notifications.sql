-- Security / parity hardening
--
--   1. Career service requests are created by a SECURITY DEFINER routine that
--      derives the initial workflow status server-side. Candidates lose the
--      ability to INSERT directly, so no crafted payload can pick a status,
--      an assignee, a payment state or a result.
--   2. The remaining notification producers (verification submission, job
--      application, HR contact request) get definer routines, matching what
--      the mock backend already does.
--
-- Additive and idempotent. No destructive SQL. Supersedes the permissive
-- INSERT policy created in 008.

/* ------------------------------------------------------------------ */
/* 1. Server-side view of the service catalog                          */
/* ------------------------------------------------------------------ */

-- The full catalog (input fields, prefill, copy) stays in application code.
-- Only the security-relevant subset lives here: what the server needs to
-- derive an initial status and enforce the duplicate rule without trusting
-- the client. Adding a service means adding a row here as well.
CREATE TABLE IF NOT EXISTS career_service_catalog (
  code TEXT PRIMARY KEY,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('free', 'paid', 'premium')),
  self_service BOOLEAN NOT NULL DEFAULT false,
  allows_repeat_requests BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE career_service_catalog ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user (it is public product information);
-- writable only by admins.
DROP POLICY IF EXISTS career_catalog_read ON career_service_catalog;
CREATE POLICY career_catalog_read ON career_service_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS career_catalog_admin_write ON career_service_catalog;
CREATE POLICY career_catalog_admin_write ON career_service_catalog
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

INSERT INTO career_service_catalog (code, pricing_type, self_service, allows_repeat_requests, active)
VALUES
  ('07', 'free', true,  true,  true),   -- CV Readiness Check
  ('08', 'paid', false, false, true),   -- Professional CV Writing
  ('12', 'paid', false, false, true),   -- LinkedIn Profile Optimization
  ('20', 'paid', false, true,  true)    -- Interview Preparation Session
ON CONFLICT (code) DO UPDATE SET
  pricing_type = EXCLUDED.pricing_type,
  self_service = EXCLUDED.self_service,
  allows_repeat_requests = EXCLUDED.allows_repeat_requests,
  active = EXCLUDED.active,
  updated_at = now();

/* ------------------------------------------------------------------ */
/* 2. Candidates may no longer INSERT requests directly                */
/* ------------------------------------------------------------------ */

DROP POLICY IF EXISTS career_requests_candidate_insert ON career_service_requests;

-- 008 allowed a candidate to move a request to 'in_progress' from any of the
-- states it could edit, which let a paid request skip 'payment_pending'.
-- Split into two narrow policies so 'in_progress' is reachable only from
-- 'waiting_candidate' (answering the team) and 'cancelled' only from the
-- states a candidate may withdraw from.
DROP POLICY IF EXISTS career_requests_candidate_update ON career_service_requests;

DROP POLICY IF EXISTS career_requests_candidate_respond ON career_service_requests;
CREATE POLICY career_requests_candidate_respond ON career_service_requests
  FOR UPDATE USING (
    candidate_id = auth.uid() AND status = 'waiting_candidate'
  ) WITH CHECK (
    candidate_id = auth.uid() AND status = 'in_progress'
  );

DROP POLICY IF EXISTS career_requests_candidate_cancel ON career_service_requests;
CREATE POLICY career_requests_candidate_cancel ON career_service_requests
  FOR UPDATE USING (
    candidate_id = auth.uid()
    AND status IN ('requested', 'payment_pending', 'ready', 'waiting_candidate', 'scheduled')
  ) WITH CHECK (
    candidate_id = auth.uid() AND status = 'cancelled'
  );

/* ------------------------------------------------------------------ */
/* 3. Server-side request creation                                     */
/* ------------------------------------------------------------------ */

-- The only way a candidate can create a request. Everything except their own
-- input is derived here:
--   * candidate_id       := auth.uid()
--   * status             := from the catalog's pricing / self-service flags
--   * payment_status     := from the catalog's pricing
--   * assignee / message / internal notes / scheduled_at := never set
--   * result             := accepted ONLY for a free self-service assessment
--
-- NOTE: a free self-service assessment's result is computed by the client rule
-- engine (deterministic, no AI). That is deliberate - it is the candidate's own
-- self-assessment feedback and carries no privilege or payment. The server
-- still refuses a result for every other service, so no one can fabricate a
-- completed paid deliverable.
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

  -- A candidate may only ever create a request for themselves.
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

  -- Same duplicate rule as the engine: repeatable services allow a new request
  -- once nothing is in flight; the rest are blocked once open or completed.
  SELECT r.status INTO blocking_status
  FROM career_service_requests r
  WHERE r.candidate_id = caller
    AND r.service_code = target_service_code
    AND (
      r.status NOT IN ('completed', 'cancelled')
      OR (NOT service.allows_repeat_requests AND r.status = 'completed')
    )
  -- Prefer an in-flight request so the message names the real blocker.
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

/* ------------------------------------------------------------------ */
/* 4. Remaining notification producers                                 */
/* ------------------------------------------------------------------ */

-- Candidate submitted their profile for verification.
CREATE OR REPLACE FUNCTION public.notify_verification_submitted()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  candidate_label TEXT;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(p.full_name, p.email) INTO candidate_label
  FROM profiles p
  WHERE p.id = caller AND p.role = 'candidate';

  IF candidate_label IS NULL THEN
    RAISE EXCEPTION 'Only candidates can submit for verification';
  END IF;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, type, title, message,
    entity_type, entity_id, priority
  )
  VALUES (
    caller, 'candidate', 'candidate_verification_submitted',
    'Verification request submitted', 'Your verification request was submitted.',
    'candidate', caller::text, 'normal'
  );

  INSERT INTO notifications (
    recipient_user_id, recipient_role, type, title, message,
    entity_type, entity_id, priority
  )
  SELECT
    p.id, 'admin', 'candidate_verification_pending',
    'Candidate submitted verification',
    candidate_label || ' submitted a verification request.',
    'candidate', caller::text, 'high'
  FROM profiles p
  WHERE p.role = 'admin';
END;
$$;

-- Candidate applied to a job.
CREATE OR REPLACE FUNCTION public.notify_job_application(target_application_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  application_row applications%ROWTYPE;
  job_title TEXT;
  job_owner UUID;
  owner_org UUID;
  candidate_label TEXT;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO application_row FROM applications WHERE id = target_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- Only the applicant may raise their own application notifications.
  IF application_row.candidate_id <> caller THEN
    RAISE EXCEPTION 'Not authorised for this application';
  END IF;

  SELECT j.title, j.created_by INTO job_title, job_owner
  FROM jobs j WHERE j.id = application_row.job_id;

  SELECT hm.organization_id INTO owner_org
  FROM hr_members hm WHERE hm.user_id = job_owner;

  SELECT COALESCE(p.full_name, p.email) INTO candidate_label
  FROM profiles p WHERE p.id = caller;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  VALUES (
    caller, 'candidate', owner_org, 'application_submitted',
    'Application submitted',
    'Your application for ' || COALESCE(job_title, 'a job') || ' was submitted.',
    'application', target_application_id::text, 'normal'
  );

  IF owner_org IS NOT NULL THEN
    INSERT INTO notifications (
      recipient_user_id, recipient_role, recipient_organization_id,
      type, title, message, entity_type, entity_id, priority
    )
    SELECT
      hm.user_id, 'hr', owner_org, 'application_received',
      'New job application',
      candidate_label || ' applied to ' || COALESCE(job_title, 'a job') || '.',
      'application', target_application_id::text, 'high'
    FROM hr_members hm
    WHERE hm.organization_id = owner_org;
  END IF;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    p.id, 'admin', owner_org, 'application_submitted_admin',
    'Candidate applied to a job',
    candidate_label || ' applied to ' || COALESCE(job_title, 'a job') || '.',
    'application', target_application_id::text, 'normal'
  FROM profiles p
  WHERE p.role = 'admin';
END;
$$;

-- HR sent a contact request to a candidate.
CREATE OR REPLACE FUNCTION public.notify_contact_request(target_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  request_row contact_requests%ROWTYPE;
  org_name TEXT;
  hr_label TEXT;
  candidate_label TEXT;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO request_row FROM contact_requests WHERE id = target_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact request not found';
  END IF;

  -- Only the HR user who sent it may raise its notifications.
  IF request_row.hr_user_id <> caller THEN
    RAISE EXCEPTION 'Not authorised for this contact request';
  END IF;

  SELECT ho.name INTO org_name
  FROM hr_organizations ho WHERE ho.id = request_row.organization_id;

  SELECT COALESCE(p.full_name, p.email) INTO hr_label
  FROM profiles p WHERE p.id = caller;

  SELECT COALESCE(p.full_name, p.email) INTO candidate_label
  FROM profiles p WHERE p.id = request_row.candidate_id;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  VALUES (
    request_row.candidate_id, 'candidate', request_row.organization_id,
    'contact_request_received', 'New contact request',
    COALESCE(org_name, 'An HR organization') || ' requested to contact you.',
    'contact_request', target_request_id::text, 'high'
  );

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    hm.user_id, 'hr', request_row.organization_id,
    'contact_request_sent', 'Contact request sent',
    COALESCE(hr_label, 'Your team') || ' requested contact with ' ||
      COALESCE(candidate_label, 'a candidate') || '.',
    'contact_request', target_request_id::text, 'normal'
  FROM hr_members hm
  WHERE hm.organization_id = request_row.organization_id;
END;
$$;

/* ------------------------------------------------------------------ */
/* 5. Execution grants                                                 */
/* ------------------------------------------------------------------ */

REVOKE ALL ON FUNCTION public.career_service_create_request(TEXT, JSONB, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_verification_submitted() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_job_application(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_contact_request(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.career_service_create_request(TEXT, JSONB, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_verification_submitted() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_job_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_contact_request(UUID) TO authenticated;
