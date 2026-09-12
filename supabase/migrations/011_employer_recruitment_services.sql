-- Employer & Recruitment Services (27-36)
--
--   27/28/29  opportunity hubs: is_exclusive + tracks on jobs, with exclusive
--             roles visible only to verified candidates (enforced in RLS).
--   30        job_alerts + a definer routine that raises alert notifications.
--   31        employer profile fields on hr_organizations.
--   32/33     the `plan` column and its staff-only setter.
--   34        matching runs in application code over the existing verified +
--             employer-visible search; no schema is needed and none is added.
--   35/36     employer_service_requests, reusing the career_request_status and
--             career_payment_status enums so the product keeps one status model.
--
-- Additive and idempotent. No destructive SQL.

/* ------------------------------------------------------------------ */
/* 1. Opportunity hubs on jobs                                         */
/* ------------------------------------------------------------------ */

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES hr_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracks TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_jobs_organization ON jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tracks ON jobs USING GIN (tracks);
CREATE INDEX IF NOT EXISTS idx_jobs_exclusive ON jobs(is_exclusive) WHERE is_exclusive = true;

-- Backfill the owning organization from the poster's membership.
UPDATE jobs j
SET organization_id = hm.organization_id
FROM hr_members hm
WHERE hm.user_id = j.created_by AND j.organization_id IS NULL;

-- Service 27: an exclusive role is browsable only by verified candidates.
ALTER POLICY jobs_candidate_open_select ON jobs USING (
  status = 'open'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'candidate'
  )
  AND (
    is_exclusive = false
    OR EXISTS (
      SELECT 1 FROM candidate_profiles cp
      WHERE cp.user_id = auth.uid() AND cp.verification_status = 'verified'
    )
  )
);

/* ------------------------------------------------------------------ */
/* 2. Employer profile and plan (31, 32, 33)                           */
/* ------------------------------------------------------------------ */

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employer_plan') THEN
    CREATE TYPE employer_plan AS ENUM ('free', 'pro');
  END IF;
END
$$;

ALTER TABLE hr_organizations
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS company_size TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS profile_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan employer_plan NOT NULL DEFAULT 'free';

-- An HR owner may edit their own organization profile. The plan column is not
-- writable by them: it is revoked below and set only through the RPC.
DROP POLICY IF EXISTS hr_organizations_member_update ON hr_organizations;
CREATE POLICY hr_organizations_member_update ON hr_organizations
  FOR UPDATE USING (
    id = public.current_hr_organization()
  ) WITH CHECK (
    id = public.current_hr_organization()
  );

REVOKE UPDATE ON hr_organizations FROM authenticated;
GRANT UPDATE (
  website, industry, description, company_size, location, contact_email,
  profile_submitted_at
) ON hr_organizations TO authenticated;

/** Staff-only plan change, re-checked inside the definer routine. */
CREATE OR REPLACE FUNCTION public.admin_set_employer_plan(
  target_organization_id UUID,
  new_plan employer_plan
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  organization_name TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only SEH staff can change an employer plan';
  END IF;

  UPDATE hr_organizations
  SET plan = new_plan
  WHERE id = target_organization_id
  RETURNING name INTO organization_name;

  IF organization_name IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    hm.user_id, 'hr', target_organization_id,
    CASE WHEN new_plan = 'pro' THEN 'employer_plan_upgraded' ELSE 'employer_plan_changed' END,
    CASE WHEN new_plan = 'pro' THEN 'Upgraded to Pro' ELSE 'Plan updated' END,
    CASE
      WHEN new_plan = 'pro'
        THEN 'Your organization now has TalentVerify Pro: unlimited job posts, search and matching.'
      ELSE 'Your organization is on the Free plan.'
    END,
    'organization', target_organization_id::text, 'high'
  FROM hr_members hm
  WHERE hm.organization_id = target_organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_employer_profile_updated(
  target_organization_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  organization_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF target_organization_id IS DISTINCT FROM public.current_hr_organization() THEN
    RAISE EXCEPTION 'You can only manage your own organization';
  END IF;

  SELECT name INTO organization_name
  FROM hr_organizations WHERE id = target_organization_id;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    p.id, 'admin', target_organization_id,
    'employer_profile_updated', 'Employer profile updated',
    COALESCE(organization_name, 'An employer') || ' updated their employer profile.',
    'organization', target_organization_id::text, 'normal'
  FROM profiles p
  WHERE p.role = 'admin';
END;
$$;

/* ------------------------------------------------------------------ */
/* 3. Job alerts (30)                                                  */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS job_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,
  job_types TEXT[] NOT NULL DEFAULT '{}',
  tracks TEXT[] NOT NULL DEFAULT '{}',
  exclusive_only BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'immediate'
    CHECK (frequency IN ('immediate', 'daily', 'weekly')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_matched_at TIMESTAMPTZ,
  match_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_job_alerts_candidate
  ON job_alerts(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_alerts_active ON job_alerts(active) WHERE active = true;

ALTER TABLE job_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_alerts_own ON job_alerts;
CREATE POLICY job_alerts_own ON job_alerts
  FOR ALL USING (candidate_id = auth.uid())
  WITH CHECK (candidate_id = auth.uid());

DROP POLICY IF EXISTS job_alerts_admin_select ON job_alerts;
CREATE POLICY job_alerts_admin_select ON job_alerts
  FOR SELECT USING (public.is_platform_admin());

/**
 * Mirrors src/features/employer/alerts.ts. Called after a job is published;
 * candidates are only notified about exclusive roles when they are verified.
 */
CREATE OR REPLACE FUNCTION public.fire_job_alerts(target_job_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_row jobs%ROWTYPE;
  alert_row job_alerts%ROWTYPE;
  haystack TEXT;
  fired INT := 0;
BEGIN
  SELECT * INTO job_row FROM jobs WHERE id = target_job_id;
  IF NOT FOUND OR job_row.status <> 'open' THEN
    RETURN 0;
  END IF;

  haystack := lower(
    COALESCE(job_row.title, '') || ' ' ||
    COALESCE(job_row.description, '') || ' ' ||
    COALESCE(array_to_string(job_row.requirements, ' '), '')
  );

  FOR alert_row IN
    SELECT * FROM job_alerts WHERE active = true
  LOOP
    -- Exclusive roles never reach an unverified candidate.
    IF job_row.is_exclusive AND NOT EXISTS (
      SELECT 1 FROM candidate_profiles cp
      WHERE cp.user_id = alert_row.candidate_id AND cp.verification_status = 'verified'
    ) THEN
      CONTINUE;
    END IF;

    IF alert_row.exclusive_only AND NOT job_row.is_exclusive THEN CONTINUE; END IF;

    IF cardinality(alert_row.keywords) > 0 AND NOT EXISTS (
      SELECT 1 FROM unnest(alert_row.keywords) AS keyword
      WHERE haystack LIKE '%' || lower(btrim(keyword)) || '%'
    ) THEN
      CONTINUE;
    END IF;

    IF alert_row.location IS NOT NULL AND btrim(alert_row.location) <> ''
      AND position(lower(btrim(alert_row.location)) in lower(COALESCE(job_row.location, ''))) = 0
    THEN
      CONTINUE;
    END IF;

    IF cardinality(alert_row.job_types) > 0 AND NOT EXISTS (
      SELECT 1 FROM unnest(alert_row.job_types) AS job_type
      WHERE lower(btrim(job_type)) = lower(COALESCE(job_row.job_type, ''))
    ) THEN
      CONTINUE;
    END IF;

    IF cardinality(alert_row.tracks) > 0 AND NOT (alert_row.tracks && job_row.tracks) THEN
      CONTINUE;
    END IF;

    INSERT INTO notifications (
      recipient_user_id, recipient_role, type, title, message,
      entity_type, entity_id, priority
    )
    VALUES (
      alert_row.candidate_id, 'candidate', 'job_alert_match',
      'New match: ' || job_row.title,
      job_row.title || ' matches your "' || alert_row.name || '" alert.',
      'job', target_job_id::text, 'normal'
    );

    UPDATE job_alerts
    SET match_count = match_count + 1,
        last_matched_at = now(),
        updated_at = now()
    WHERE id = alert_row.id;

    fired := fired + 1;
  END LOOP;

  RETURN fired;
END;
$$;

/* ------------------------------------------------------------------ */
/* 4. Employer service requests (35, 36)                               */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS employer_service_catalog (
  code TEXT PRIMARY KEY,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('free', 'paid', 'premium')),
  allows_repeat_requests BOOLEAN NOT NULL DEFAULT false,
  requires_scheduling BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE employer_service_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employer_catalog_read ON employer_service_catalog;
CREATE POLICY employer_catalog_read ON employer_service_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS employer_catalog_admin_write ON employer_service_catalog;
CREATE POLICY employer_catalog_admin_write ON employer_service_catalog
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

INSERT INTO employer_service_catalog
  (code, pricing_type, allows_repeat_requests, requires_scheduling, active)
VALUES
  ('35', 'paid',    true,  false, true),
  ('36', 'premium', false, true,  true)
ON CONFLICT (code) DO UPDATE SET
  pricing_type = EXCLUDED.pricing_type,
  allows_repeat_requests = EXCLUDED.allows_repeat_requests,
  requires_scheduling = EXCLUDED.requires_scheduling,
  active = EXCLUDED.active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS employer_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES hr_organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  status career_request_status NOT NULL DEFAULT 'requested',
  payment_status career_payment_status NOT NULL DEFAULT 'not_required',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  admin_message TEXT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  result JSONB,
  scheduled_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employer_requests_org
  ON employer_service_requests(organization_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_employer_requests_status
  ON employer_service_requests(status, submitted_at DESC);

ALTER TABLE employer_service_requests ENABLE ROW LEVEL SECURITY;

-- Internal notes live in their own admin-only table, as with career services.
CREATE TABLE IF NOT EXISTS employer_service_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES employer_service_requests(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE employer_service_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employer_internal_notes_admin ON employer_service_internal_notes;
CREATE POLICY employer_internal_notes_admin ON employer_service_internal_notes
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS employer_requests_member_select ON employer_service_requests;
CREATE POLICY employer_requests_member_select ON employer_service_requests
  FOR SELECT USING (organization_id = public.current_hr_organization());

DROP POLICY IF EXISTS employer_requests_admin_all ON employer_service_requests;
CREATE POLICY employer_requests_admin_all ON employer_service_requests
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Employers never INSERT or UPDATE directly: both go through definer routines.
REVOKE INSERT, UPDATE ON employer_service_requests FROM authenticated;

/** Creation with a server-derived status, payment state and organization. */
CREATE OR REPLACE FUNCTION public.employer_service_create_request(
  target_service_code TEXT,
  input_value JSONB DEFAULT '{}'::jsonb,
  notes_value TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  caller_org UUID;
  service employer_service_catalog%ROWTYPE;
  blocking_status career_request_status;
  derived_status career_request_status;
  derived_payment career_payment_status;
  new_id UUID;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  caller_org := public.current_hr_organization();
  IF caller_org IS NULL THEN
    RAISE EXCEPTION 'Only employer accounts can request recruitment services';
  END IF;
  IF NOT public.is_approved_hr_member() THEN
    RAISE EXCEPTION 'Your organization must be verified before using employer services';
  END IF;

  SELECT * INTO service FROM employer_service_catalog WHERE code = target_service_code;
  IF NOT FOUND OR NOT service.active THEN
    RAISE EXCEPTION 'This service is not currently available.';
  END IF;

  SELECT r.status INTO blocking_status
  FROM employer_service_requests r
  WHERE r.organization_id = caller_org
    AND r.service_code = target_service_code
    AND (
      r.status NOT IN ('completed', 'cancelled')
      OR (NOT service.allows_repeat_requests AND r.status = 'completed')
    )
  ORDER BY (r.status = 'completed')
  LIMIT 1;

  IF blocking_status IS NOT NULL THEN
    IF blocking_status = 'completed' THEN
      RAISE EXCEPTION 'Your organization has already completed this service. Contact SEH to arrange it again.';
    ELSE
      RAISE EXCEPTION 'Your organization already has an open request for this service.';
    END IF;
  END IF;

  IF service.pricing_type = 'free' THEN
    derived_status := 'ready';
    derived_payment := 'not_required';
  ELSE
    derived_status := 'payment_pending';
    derived_payment := 'pending';
  END IF;

  INSERT INTO employer_service_requests (
    organization_id, requested_by, service_code, status, payment_status, input, notes
  )
  VALUES (
    caller_org, caller, target_service_code, derived_status, derived_payment,
    COALESCE(input_value, '{}'::jsonb), NULLIF(btrim(COALESCE(notes_value, '')), '')
  )
  RETURNING id INTO new_id;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    hm.user_id, 'hr', caller_org, 'employer_service_requested',
    'Service request received', 'Your recruitment service request was received.',
    'employer_service_request', new_id::text, 'normal'
  FROM hr_members hm WHERE hm.organization_id = caller_org;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    p.id, 'admin', caller_org, 'employer_service_request',
    'New employer service request', 'An employer requested a recruitment service.',
    'employer_service_request', new_id::text, 'high'
  FROM profiles p WHERE p.role = 'admin';

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.employer_service_cancel_request(target_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row employer_service_requests%ROWTYPE;
BEGIN
  SELECT * INTO request_row FROM employer_service_requests WHERE id = target_request_id;
  IF NOT FOUND OR request_row.organization_id IS DISTINCT FROM public.current_hr_organization() THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF request_row.status NOT IN
    ('requested', 'payment_pending', 'ready', 'waiting_candidate', 'scheduled') THEN
    RAISE EXCEPTION 'This request can no longer be cancelled. Contact SEH.';
  END IF;

  UPDATE employer_service_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = target_request_id;
END;
$$;

/** Staff transition, enforcing the same transition table as career services. */
CREATE OR REPLACE FUNCTION public.employer_service_apply_transition(
  target_request_id UUID,
  new_status career_request_status,
  scheduled_at_value TIMESTAMPTZ DEFAULT NULL,
  result_value JSONB DEFAULT NULL,
  admin_message_value TEXT DEFAULT NULL,
  internal_notes_value TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_request employer_service_requests%ROWTYPE;
  allowed career_request_status[];
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only SEH staff can manage employer service requests';
  END IF;

  SELECT * INTO current_request
  FROM employer_service_requests WHERE id = target_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  allowed := CASE current_request.status
    WHEN 'requested' THEN ARRAY['payment_pending', 'ready', 'cancelled']::career_request_status[]
    WHEN 'payment_pending' THEN ARRAY['ready', 'cancelled']::career_request_status[]
    WHEN 'ready' THEN ARRAY['assigned', 'in_progress', 'scheduled', 'cancelled']::career_request_status[]
    WHEN 'assigned' THEN ARRAY['in_progress', 'scheduled', 'waiting_candidate', 'cancelled']::career_request_status[]
    WHEN 'in_progress' THEN ARRAY['waiting_candidate', 'scheduled', 'completed', 'cancelled']::career_request_status[]
    WHEN 'waiting_candidate' THEN ARRAY['in_progress', 'cancelled']::career_request_status[]
    WHEN 'scheduled' THEN ARRAY['in_progress', 'completed', 'cancelled']::career_request_status[]
    ELSE ARRAY[]::career_request_status[]
  END;

  IF NOT (new_status = ANY (allowed)) THEN
    RAISE EXCEPTION 'Cannot move a request from % to %', current_request.status, new_status;
  END IF;
  IF new_status = 'scheduled' AND scheduled_at_value IS NULL THEN
    RAISE EXCEPTION 'Choose a date and time before scheduling this session';
  END IF;
  IF new_status = 'completed'
    AND (result_value IS NULL OR btrim(COALESCE(result_value->>'summary', '')) = '') THEN
    RAISE EXCEPTION 'Add the result before completing this request';
  END IF;
  IF new_status = 'waiting_candidate' AND btrim(COALESCE(admin_message_value, '')) = '' THEN
    RAISE EXCEPTION 'Explain what the employer needs to provide';
  END IF;

  UPDATE employer_service_requests
  SET
    status = new_status,
    scheduled_at = CASE WHEN new_status = 'scheduled' THEN scheduled_at_value ELSE scheduled_at END,
    result = COALESCE(result_value, result),
    admin_message = CASE
      WHEN admin_message_value IS NOT NULL THEN NULLIF(btrim(admin_message_value), '')
      WHEN new_status = 'in_progress' THEN NULL
      ELSE admin_message
    END,
    payment_status = CASE
      WHEN new_status = 'ready' AND payment_status = 'pending' THEN 'received'::career_payment_status
      ELSE payment_status
    END,
    assigned_to = CASE WHEN new_status = 'assigned' THEN auth.uid() ELSE assigned_to END,
    completed_at = CASE WHEN new_status = 'completed' THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = target_request_id;

  IF btrim(COALESCE(internal_notes_value, '')) <> '' THEN
    INSERT INTO employer_service_internal_notes (request_id, author_id, note)
    VALUES (target_request_id, auth.uid(), btrim(internal_notes_value));
  END IF;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    hm.user_id, 'hr', current_request.organization_id,
    'employer_service_' || new_status::text,
    'Recruitment service update',
    COALESCE(
      NULLIF(btrim(admin_message_value), ''),
      NULLIF(btrim(result_value->>'summary'), ''),
      'Your recruitment service request was updated.'
    ),
    'employer_service_request', target_request_id::text,
    CASE WHEN new_status IN ('waiting_candidate', 'completed') THEN 'high' ELSE 'normal' END
  FROM hr_members hm
  WHERE hm.organization_id = current_request.organization_id;
END;
$$;

/* ------------------------------------------------------------------ */
/* 5. Execution grants                                                 */
/* ------------------------------------------------------------------ */

REVOKE ALL ON FUNCTION public.admin_set_employer_plan(UUID, employer_plan) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_employer_profile_updated(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fire_job_alerts(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.employer_service_create_request(TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.employer_service_cancel_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.employer_service_apply_transition(
  UUID, career_request_status, TIMESTAMPTZ, JSONB, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_set_employer_plan(UUID, employer_plan) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_employer_profile_updated(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fire_job_alerts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employer_service_create_request(TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employer_service_cancel_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employer_service_apply_transition(
  UUID, career_request_status, TIMESTAMPTZ, JSONB, TEXT, TEXT
) TO authenticated;
