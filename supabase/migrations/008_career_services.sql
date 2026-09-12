-- Career Services engine
--
-- Service definitions live in application code (src/features/career-services/
-- catalog.ts) because they carry behaviour - required inputs, Talent Passport
-- prefill, repeat rules, scheduling. Only requests are persisted here, keyed by
-- the catalog's service_code.
--
-- Additive and idempotent. No destructive SQL.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_request_status') THEN
    CREATE TYPE career_request_status AS ENUM (
      'requested',
      'payment_pending',
      'ready',
      'assigned',
      'in_progress',
      'waiting_candidate',
      'scheduled',
      'completed',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'career_payment_status') THEN
    -- Workflow metadata only: no payment gateway is integrated.
    CREATE TYPE career_payment_status AS ENUM ('not_required', 'pending', 'received');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS career_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  status career_request_status NOT NULL DEFAULT 'requested',
  payment_status career_payment_status NOT NULL DEFAULT 'not_required',
  candidate_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  candidate_notes TEXT,
  -- Written by staff, shown to the candidate.
  admin_message TEXT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  result JSONB,
  scheduled_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_requests_candidate
  ON career_service_requests(candidate_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_career_requests_status
  ON career_service_requests(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_career_requests_service
  ON career_service_requests(service_code, status);

CREATE INDEX IF NOT EXISTS idx_career_requests_assigned
  ON career_service_requests(assigned_to)
  WHERE assigned_to IS NOT NULL;

ALTER TABLE career_service_requests ENABLE ROW LEVEL SECURITY;

-- Candidates read and create their own requests. HR has no policy at all here,
-- so the career services queue is invisible to employers.
DROP POLICY IF EXISTS career_requests_candidate_select ON career_service_requests;
CREATE POLICY career_requests_candidate_select ON career_service_requests
  FOR SELECT USING (candidate_id = auth.uid());

DROP POLICY IF EXISTS career_requests_candidate_insert ON career_service_requests;
CREATE POLICY career_requests_candidate_insert ON career_service_requests
  FOR INSERT WITH CHECK (
    candidate_id = auth.uid()
    -- A candidate may only open a request, never grant themselves a workflow
    -- state, a payment confirmation or an assignment.
    AND status IN ('requested', 'payment_pending', 'ready', 'completed')
    AND payment_status IN ('not_required', 'pending')
    AND assigned_to IS NULL
    AND admin_message IS NULL
  );

-- The candidate's own updates are limited to answering a "waiting_candidate"
-- request or withdrawing one; staff transitions go through the RPC below.
DROP POLICY IF EXISTS career_requests_candidate_update ON career_service_requests;
CREATE POLICY career_requests_candidate_update ON career_service_requests
  FOR UPDATE USING (
    candidate_id = auth.uid()
    AND status IN ('requested', 'payment_pending', 'ready', 'waiting_candidate', 'scheduled')
  ) WITH CHECK (
    candidate_id = auth.uid()
    AND status IN ('in_progress', 'cancelled')
  );

DROP POLICY IF EXISTS career_requests_admin_all ON career_service_requests;
CREATE POLICY career_requests_admin_all ON career_service_requests
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Internal notes live in their own admin-only table rather than a column on the
-- request. PostgreSQL RLS is row-level, so a column on the request row would
-- still be readable through the REST API by the candidate who owns that row.
-- A separate table with an admin-only policy makes the boundary absolute.
CREATE TABLE IF NOT EXISTS career_service_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES career_service_requests(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_internal_notes_request
  ON career_service_internal_notes(request_id, created_at DESC);

ALTER TABLE career_service_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_internal_notes_admin_all ON career_service_internal_notes;
CREATE POLICY career_internal_notes_admin_all ON career_service_internal_notes
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Candidates may only ever write the columns that are theirs; every staff field
-- is changed through the transition RPC, which runs as the function owner.
REVOKE UPDATE ON career_service_requests FROM authenticated;
GRANT UPDATE (status, candidate_input, candidate_notes, updated_at)
  ON career_service_requests TO authenticated;


CREATE OR REPLACE FUNCTION public.touch_career_service_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_career_service_request ON career_service_requests;
CREATE TRIGGER trg_touch_career_service_request
  BEFORE UPDATE ON career_service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_career_service_request();

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

-- Clients may not address a notification to another user, so career-service
-- notices are raised through this definer routine. It only ever writes to the
-- request's own candidate, or to the admin team.
CREATE OR REPLACE FUNCTION public.career_service_notify(
  target_request_id UUID,
  audience TEXT,
  notification_type TEXT,
  notification_title TEXT,
  notification_message TEXT,
  notification_priority TEXT DEFAULT 'normal'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_candidate UUID;
BEGIN
  SELECT candidate_id INTO request_candidate
  FROM career_service_requests
  WHERE id = target_request_id;

  IF request_candidate IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- Only the request's own candidate or an admin may raise its notifications.
  IF NOT (request_candidate = auth.uid() OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Not authorised for this request';
  END IF;

  IF audience = 'candidate' THEN
    INSERT INTO notifications (
      recipient_user_id, recipient_role, type, title, message,
      entity_type, entity_id, priority
    )
    VALUES (
      request_candidate, 'candidate', notification_type, notification_title,
      notification_message, 'career_service_request', target_request_id::text,
      notification_priority
    );
  ELSIF audience = 'staff' THEN
    INSERT INTO notifications (
      recipient_user_id, recipient_role, type, title, message,
      entity_type, entity_id, priority
    )
    SELECT
      p.id, 'admin', notification_type, notification_title,
      notification_message, 'career_service_request', target_request_id::text,
      notification_priority
    FROM profiles p
    WHERE p.role = 'admin';
  ELSE
    RAISE EXCEPTION 'Unknown notification audience: %', audience;
  END IF;
END;
$$;

/* ------------------------------------------------------------------ */
/* Staff transitions                                                   */
/* ------------------------------------------------------------------ */

-- Mirrors src/features/career-services/rules.ts. The transition table is
-- enforced here as well, so an admin session cannot post an illegal move by
-- calling the API directly.
CREATE OR REPLACE FUNCTION public.career_service_apply_transition(
  target_request_id UUID,
  new_status career_request_status,
  scheduled_at_value TIMESTAMPTZ DEFAULT NULL,
  result_value JSONB DEFAULT NULL,
  admin_message_value TEXT DEFAULT NULL,
  internal_notes_value TEXT DEFAULT NULL,
  payment_status_value career_payment_status DEFAULT NULL,
  service_name TEXT DEFAULT 'service'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_request career_service_requests%ROWTYPE;
  allowed career_request_status[];
  notice_type TEXT;
  notice_title TEXT;
  notice_message TEXT;
  notice_priority TEXT := 'normal';
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only the career team can manage service requests';
  END IF;

  SELECT * INTO current_request
  FROM career_service_requests
  WHERE id = target_request_id
  FOR UPDATE;

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
  IF new_status = 'completed' AND (result_value IS NULL OR btrim(COALESCE(result_value->>'summary', '')) = '') THEN
    RAISE EXCEPTION 'Add the result before completing this request';
  END IF;
  IF new_status = 'waiting_candidate' AND btrim(COALESCE(admin_message_value, '')) = '' THEN
    RAISE EXCEPTION 'Explain what the candidate needs to provide';
  END IF;

  UPDATE career_service_requests
  SET
    status = new_status,
    scheduled_at = CASE WHEN new_status = 'scheduled' THEN scheduled_at_value ELSE scheduled_at END,
    result = COALESCE(result_value, result),
    admin_message = CASE
      WHEN admin_message_value IS NOT NULL THEN NULLIF(btrim(admin_message_value), '')
      WHEN new_status = 'in_progress' THEN NULL
      ELSE admin_message
    END,
    payment_status = COALESCE(
      payment_status_value,
      CASE
        WHEN new_status = 'ready' AND payment_status = 'pending' THEN 'received'::career_payment_status
        ELSE payment_status
      END
    ),
    assigned_to = CASE WHEN new_status = 'assigned' THEN auth.uid() ELSE assigned_to END,
    completed_at = CASE WHEN new_status = 'completed' THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = target_request_id;

  IF btrim(COALESCE(internal_notes_value, '')) <> '' THEN
    INSERT INTO career_service_internal_notes (request_id, author_id, note)
    VALUES (target_request_id, auth.uid(), btrim(internal_notes_value));
  END IF;

  notice_type := CASE new_status
    WHEN 'ready' THEN 'career_service_ready'
    WHEN 'in_progress' THEN 'career_service_in_progress'
    WHEN 'waiting_candidate' THEN 'career_service_information_required'
    WHEN 'scheduled' THEN 'career_service_scheduled'
    WHEN 'completed' THEN 'career_service_completed'
    WHEN 'cancelled' THEN 'career_service_cancelled'
    ELSE NULL
  END;

  notice_title := CASE new_status
    WHEN 'ready' THEN 'Payment confirmed'
    WHEN 'in_progress' THEN 'Work started'
    WHEN 'waiting_candidate' THEN 'More information needed'
    WHEN 'scheduled' THEN 'Session scheduled'
    WHEN 'completed' THEN service_name || ' completed'
    WHEN 'cancelled' THEN 'Request cancelled'
    ELSE NULL
  END;

  notice_message := CASE new_status
    WHEN 'ready' THEN 'Your ' || service_name || ' request is confirmed and queued with the career team.'
    WHEN 'in_progress' THEN 'The career team started working on your ' || service_name || ' request.'
    WHEN 'waiting_candidate' THEN COALESCE(NULLIF(btrim(admin_message_value), ''), 'The career team needs more information.')
    WHEN 'scheduled' THEN 'Your ' || service_name || ' session is scheduled.'
    WHEN 'completed' THEN COALESCE(NULLIF(btrim(result_value->>'summary'), ''), 'Your service is complete.')
    WHEN 'cancelled' THEN 'Your ' || service_name || ' request was cancelled.'
    ELSE NULL
  END;


  IF notice_type IS NOT NULL THEN
    IF new_status IN ('waiting_candidate', 'completed') THEN
      notice_priority := 'high';
    END IF;

    INSERT INTO notifications (
      recipient_user_id, recipient_role, type, title, message,
      entity_type, entity_id, priority
    )
    VALUES (
      current_request.candidate_id, 'candidate', notice_type, notice_title,
      notice_message, 'career_service_request', target_request_id::text, notice_priority
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.career_service_notify(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.career_service_apply_transition(
  UUID, career_request_status, TIMESTAMPTZ, JSONB, TEXT, TEXT, career_payment_status, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.career_service_notify(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.career_service_apply_transition(
  UUID, career_request_status, TIMESTAMPTZ, JSONB, TEXT, TEXT, career_payment_status, TEXT
) TO authenticated;
