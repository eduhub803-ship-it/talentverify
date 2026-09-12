-- Correction pass for Services 34 and 36
--
--   34  Talent Request: a request-linked shortlist built by SEH from the
--       verified + employer-visible pool, invisible to the employer until it is
--       submitted. The deterministic match helper is unchanged and stays a
--       read-only assistance tool.
--   36  Corporate Talent Partnership: an entitlement tier on the organization
--       (`plan = 'partner'`) rather than a scheduled service request. The
--       historic service-36 request rows are preserved untouched.
--
-- Additive and idempotent. Migrations 011 and 012 are not modified. No
-- destructive SQL.

/* ------------------------------------------------------------------ */
/* 1. Partner tier and partnership fields (36)                         */
/* ------------------------------------------------------------------ */

-- The `partner` enum value is added by migration 012, which must run in its own
-- transaction: PostgreSQL refuses ALTER TYPE ... ADD VALUE inside a function or
-- DO block, and a value added in a transaction cannot be used in that same
-- transaction. Everything here only needs the value to already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partnership_status') THEN
    CREATE TYPE partnership_status AS ENUM ('pending', 'active', 'inactive', 'expired');
  END IF;
END
$$;

ALTER TABLE hr_organizations
  ADD COLUMN IF NOT EXISTS partnership_status partnership_status,
  ADD COLUMN IF NOT EXISTS partnership_start_date DATE,
  ADD COLUMN IF NOT EXISTS partnership_end_date DATE,
  ADD COLUMN IF NOT EXISTS partnership_notes TEXT;

-- Partnership fields are staff-managed. The employer-writable column grant from
-- 011 already excludes them; this makes the boundary explicit for the new ones.
REVOKE UPDATE (partnership_status, partnership_start_date, partnership_end_date, partnership_notes)
  ON hr_organizations FROM authenticated;

-- Internal partnership notes must never reach the employer. RLS is row-level,
-- so the column privilege is what actually enforces it; admins read through the
-- definer routine below.
REVOKE SELECT (partnership_notes) ON hr_organizations FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_employer_partnership(
  target_organization_id UUID,
  new_status partnership_status DEFAULT NULL,
  start_date_value DATE DEFAULT NULL,
  end_date_value DATE DEFAULT NULL,
  notes_value TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_status partnership_status;
  organization_name TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only SEH staff can manage a partnership';
  END IF;
  IF start_date_value IS NOT NULL AND end_date_value IS NOT NULL
    AND end_date_value < start_date_value THEN
    RAISE EXCEPTION 'The partnership end date cannot be before the start date.';
  END IF;

  SELECT partnership_status, name INTO previous_status, organization_name
  FROM hr_organizations WHERE id = target_organization_id;

  IF organization_name IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  UPDATE hr_organizations
  SET partnership_status = new_status,
      partnership_start_date = start_date_value,
      partnership_end_date = end_date_value,
      partnership_notes = NULLIF(btrim(COALESCE(notes_value, '')), '')
  WHERE id = target_organization_id;

  IF new_status = 'active' AND previous_status IS DISTINCT FROM 'active' THEN
    INSERT INTO notifications (
      recipient_user_id, recipient_role, recipient_organization_id,
      type, title, message, entity_type, entity_id, priority
    )
    SELECT
      hm.user_id, 'hr', target_organization_id,
      'employer_partnership_active', 'SEH Talent Partnership active',
      'Your organization is now an active SEH Talent Partner.',
      'organization', target_organization_id::text, 'high'
    FROM hr_members hm
    WHERE hm.organization_id = target_organization_id;
  END IF;
END;
$$;

/* ------------------------------------------------------------------ */
/* 2. Talent Request shortlist (34)                                    */
/* ------------------------------------------------------------------ */

ALTER TABLE employer_service_requests
  ADD COLUMN IF NOT EXISTS shortlist_submitted_at TIMESTAMPTZ;

INSERT INTO employer_service_catalog
  (code, pricing_type, allows_repeat_requests, requires_scheduling, active)
VALUES
  ('34', 'paid', true, false, true),
  -- Service 36 is now an entitlement tier: the row is kept so historic requests
  -- still resolve, but no new request can be created for it.
  ('36', 'premium', false, true, false)
ON CONFLICT (code) DO UPDATE SET
  pricing_type = EXCLUDED.pricing_type,
  allows_repeat_requests = EXCLUDED.allows_repeat_requests,
  requires_scheduling = EXCLUDED.requires_scheduling,
  active = EXCLUDED.active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS talent_request_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES employer_service_requests(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  employer_note TEXT,
  rank INT NOT NULL DEFAULT 1,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (request_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_talent_shortlists_request
  ON talent_request_shortlists(request_id, rank);

ALTER TABLE talent_request_shortlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS talent_shortlists_admin_all ON talent_request_shortlists;
CREATE POLICY talent_shortlists_admin_all ON talent_request_shortlists
  FOR ALL USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- The employer sees shortlist rows only for their own organization's request,
-- and only once SEH has submitted it. A draft is invisible.
DROP POLICY IF EXISTS talent_shortlists_employer_select ON talent_request_shortlists;
CREATE POLICY talent_shortlists_employer_select ON talent_request_shortlists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employer_service_requests r
      WHERE r.id = talent_request_shortlists.request_id
        AND r.organization_id = public.current_hr_organization()
        AND r.shortlist_submitted_at IS NOT NULL
    )
  );

-- Employers never write shortlist rows.
REVOKE INSERT, UPDATE, DELETE ON talent_request_shortlists FROM authenticated;

/**
 * Adds one candidate to a talent shortlist. Eligibility is the product-wide
 * rule: verified AND employer-visible. A partner plan does not relax it.
 */
CREATE OR REPLACE FUNCTION public.talent_request_add_candidate(
  target_request_id UUID,
  target_candidate_id UUID,
  employer_note_value TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row employer_service_requests%ROWTYPE;
  next_rank INT;
  new_id UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only SEH staff can build a talent shortlist';
  END IF;

  SELECT * INTO request_row
  FROM employer_service_requests WHERE id = target_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Talent request not found';
  END IF;
  IF request_row.service_code <> '34' THEN
    RAISE EXCEPTION 'This request does not have a talent shortlist';
  END IF;
  IF request_row.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'This request is closed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM candidate_profiles cp
    WHERE cp.user_id = target_candidate_id
      AND cp.verification_status = 'verified'
      AND cp.employer_visible = true
  ) THEN
    RAISE EXCEPTION 'Only verified, employer-visible candidates can be shortlisted';
  END IF;

  SELECT COALESCE(MAX(rank), 0) + 1 INTO next_rank
  FROM talent_request_shortlists WHERE request_id = target_request_id;

  INSERT INTO talent_request_shortlists (
    request_id, candidate_id, employer_note, rank, added_by
  )
  VALUES (
    target_request_id, target_candidate_id,
    NULLIF(btrim(COALESCE(employer_note_value, '')), ''), next_rank, auth.uid()
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.talent_request_remove_candidate(target_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_row talent_request_shortlists%ROWTYPE;
  submitted TIMESTAMPTZ;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only SEH staff can change a talent shortlist';
  END IF;

  SELECT * INTO item_row FROM talent_request_shortlists WHERE id = target_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shortlist entry not found';
  END IF;

  SELECT shortlist_submitted_at INTO submitted
  FROM employer_service_requests WHERE id = item_row.request_id;
  IF submitted IS NOT NULL THEN
    RAISE EXCEPTION 'This shortlist has already been submitted to the employer';
  END IF;

  DELETE FROM talent_request_shortlists WHERE id = target_item_id;

  UPDATE talent_request_shortlists
  SET rank = rank - 1
  WHERE request_id = item_row.request_id AND rank > item_row.rank;
END;
$$;

CREATE OR REPLACE FUNCTION public.talent_request_submit_shortlist(target_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row employer_service_requests%ROWTYPE;
  shortlist_count INT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only SEH staff can submit a talent shortlist';
  END IF;

  SELECT * INTO request_row
  FROM employer_service_requests WHERE id = target_request_id FOR UPDATE;
  IF NOT FOUND OR request_row.service_code <> '34' THEN
    RAISE EXCEPTION 'Talent request not found';
  END IF;
  IF request_row.shortlist_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This shortlist has already been submitted';
  END IF;

  SELECT count(*) INTO shortlist_count
  FROM talent_request_shortlists WHERE request_id = target_request_id;
  IF shortlist_count = 0 THEN
    RAISE EXCEPTION 'Add at least one candidate before submitting the shortlist';
  END IF;

  UPDATE employer_service_requests
  SET shortlist_submitted_at = now(), updated_at = now()
  WHERE id = target_request_id;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    hm.user_id, 'hr', request_row.organization_id,
    'talent_request_shortlist_submitted', 'Your shortlist is ready',
    'SEH submitted ' || shortlist_count || ' candidate(s) for your talent request.',
    'employer_service_request', target_request_id::text, 'high'
  FROM hr_members hm
  WHERE hm.organization_id = request_row.organization_id;
END;
$$;

/* ------------------------------------------------------------------ */
/* 3. Execution grants                                                 */
/* ------------------------------------------------------------------ */

REVOKE ALL ON FUNCTION public.admin_set_employer_partnership(
  UUID, partnership_status, DATE, DATE, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.talent_request_add_candidate(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.talent_request_remove_candidate(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.talent_request_submit_shortlist(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_set_employer_partnership(
  UUID, partnership_status, DATE, DATE, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.talent_request_add_candidate(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.talent_request_remove_candidate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.talent_request_submit_shortlist(UUID) TO authenticated;
