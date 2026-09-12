-- Pre-Supabase production hardening
--
-- Adds the database behaviour the application already relies on in Mock mode
-- but which was never represented in version control:
--
--   1. RLS helper functions, so policies can read hr_members / hr_organizations
--      without tripping over those tables' own RLS.
--   2. The missing policies on hr_organizations and hr_members (RLS was enabled
--      with zero policies, which denies everything, including HR membership
--      lookup and admin HR approvals).
--   3. RLS on verification_reviews, which had none at all.
--   4. The notifications table backing the in-app notification bell.
--   5. Admin review RPCs, so approve/reject runs as one authorised transaction.
--   6. The signup trigger that creates the application records for a new
--      Supabase Auth user (profile + role-specific domain rows).
--
-- Additive and idempotent. No data is deleted and no existing row is modified.

/* ------------------------------------------------------------------ */
/* 1. RLS helper functions                                            */
/* ------------------------------------------------------------------ */

-- A policy on table A that sub-queries table B also applies B's RLS. Every HR
-- policy in 001-005 sub-queries hr_members/hr_organizations, so once those
-- tables carry policies the checks would silently evaluate to false. These
-- SECURITY DEFINER helpers read them with the owner's rights instead.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_hr_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM hr_members hm
    JOIN hr_organizations ho ON ho.id = hm.organization_id
    WHERE hm.user_id = auth.uid() AND ho.status = 'approved'
  );
$$;

/** Organization of the calling HR user, regardless of approval state. */
CREATE OR REPLACE FUNCTION public.current_hr_organization()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hm.organization_id
  FROM hr_members hm
  WHERE hm.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_approved_hr_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_hr_organization() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_hr_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_hr_organization() TO authenticated;

/* ------------------------------------------------------------------ */
/* 2. hr_organizations / hr_members policies                          */
/* ------------------------------------------------------------------ */

-- Both tables had RLS enabled in 001 but no policy was ever created, so every
-- read and write was denied. Organizations and memberships are created by the
-- signup trigger below, so no user-facing INSERT policy is required.

DROP POLICY IF EXISTS hr_organizations_member_select ON hr_organizations;
CREATE POLICY hr_organizations_member_select ON hr_organizations FOR SELECT USING (
  id = public.current_hr_organization()
);

DROP POLICY IF EXISTS hr_organizations_admin_all ON hr_organizations;
CREATE POLICY hr_organizations_admin_all ON hr_organizations FOR ALL USING (
  public.is_platform_admin()
) WITH CHECK (
  public.is_platform_admin()
);

DROP POLICY IF EXISTS hr_members_own_select ON hr_members;
CREATE POLICY hr_members_own_select ON hr_members FOR SELECT USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS hr_members_admin_all ON hr_members;
CREATE POLICY hr_members_admin_all ON hr_members FOR ALL USING (
  public.is_platform_admin()
) WITH CHECK (
  public.is_platform_admin()
);

/* ------------------------------------------------------------------ */
/* 3. Re-point existing HR policies at the helper functions           */
/* ------------------------------------------------------------------ */

-- Same logical rules as 001-005, expressed so they still evaluate correctly
-- now that hr_members / hr_organizations are themselves protected.

ALTER POLICY profiles_select ON profiles USING (
  auth.uid() = id
  OR public.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM candidate_profiles cp
    WHERE cp.user_id = profiles.id
      AND cp.verification_status = 'verified'
      AND cp.employer_visible = true
      AND public.is_approved_hr_member()
  )
);

ALTER POLICY candidate_hr_read ON candidate_profiles USING (
  verification_status = 'verified'
  AND employer_visible = true
  AND public.is_approved_hr_member()
);

ALTER POLICY candidate_admin ON candidate_profiles USING (
  public.is_platform_admin()
);

ALTER POLICY candidates_hr_read ON candidates USING (
  employer_visible = true
  AND EXISTS (
    SELECT 1 FROM candidate_profiles cp
    WHERE cp.user_id = candidates.id
      AND cp.verification_status = 'verified'
      AND cp.employer_visible = true
  )
  AND public.is_approved_hr_member()
);

ALTER POLICY candidates_admin ON candidates USING (
  public.is_platform_admin()
);

ALTER POLICY documents_admin ON documents USING (
  public.is_platform_admin()
);

ALTER POLICY jobs_hr_select ON jobs USING (
  created_by = auth.uid() AND public.is_approved_hr_member()
);

ALTER POLICY jobs_hr_insert ON jobs WITH CHECK (
  created_by = auth.uid() AND public.is_approved_hr_member()
);

ALTER POLICY jobs_hr_update ON jobs USING (
  created_by = auth.uid() AND public.is_approved_hr_member()
);

ALTER POLICY candidate_shortlists_hr_select ON candidate_shortlists USING (
  hr_user_id = auth.uid()
  AND organization_id = public.current_hr_organization()
  AND public.is_approved_hr_member()
);

ALTER POLICY candidate_shortlists_hr_insert ON candidate_shortlists WITH CHECK (
  hr_user_id = auth.uid()
  AND organization_id = public.current_hr_organization()
  AND public.is_approved_hr_member()
  AND EXISTS (
    SELECT 1 FROM candidate_profiles cp
    WHERE cp.user_id = candidate_shortlists.candidate_id
      AND cp.verification_status = 'verified'
  )
);

ALTER POLICY candidate_shortlists_hr_delete ON candidate_shortlists USING (
  hr_user_id = auth.uid()
  AND organization_id = public.current_hr_organization()
  AND public.is_approved_hr_member()
);

ALTER POLICY imported_candidates_admin ON imported_candidates USING (
  public.is_platform_admin()
) WITH CHECK (
  public.is_platform_admin()
);

ALTER POLICY candidate_import_batches_admin ON candidate_import_batches USING (
  public.is_platform_admin()
) WITH CHECK (
  public.is_platform_admin()
);

/* ------------------------------------------------------------------ */
/* 4. verification_reviews                                            */
/* ------------------------------------------------------------------ */

-- This table stored admin review notes with RLS never enabled, so any signed-in
-- user could read or forge review records.

ALTER TABLE verification_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verification_reviews_admin_all ON verification_reviews;
CREATE POLICY verification_reviews_admin_all ON verification_reviews FOR ALL USING (
  public.is_platform_admin()
) WITH CHECK (
  public.is_platform_admin()
);

DROP POLICY IF EXISTS verification_reviews_candidate_select ON verification_reviews;
CREATE POLICY verification_reviews_candidate_select ON verification_reviews FOR SELECT USING (
  candidate_id = auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_verification_reviews_candidate
  ON verification_reviews(candidate_id, reviewed_at DESC);

/* ------------------------------------------------------------------ */
/* 5. notifications                                                   */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_role user_role NOT NULL,
  recipient_organization_id UUID REFERENCES hr_organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_org
  ON notifications(recipient_organization_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Mirrors mockDb.getNotificationsForUser: a user sees notifications addressed
-- to them, and HR members also see notifications addressed to their org.
DROP POLICY IF EXISTS notifications_recipient_select ON notifications;
CREATE POLICY notifications_recipient_select ON notifications FOR SELECT USING (
  recipient_user_id = auth.uid()
  OR (
    recipient_role = 'hr'
    AND recipient_organization_id IS NOT NULL
    AND recipient_organization_id = public.current_hr_organization()
  )
);

DROP POLICY IF EXISTS notifications_recipient_update ON notifications;
CREATE POLICY notifications_recipient_update ON notifications FOR UPDATE USING (
  recipient_user_id = auth.uid()
  OR (
    recipient_role = 'hr'
    AND recipient_organization_id IS NOT NULL
    AND recipient_organization_id = public.current_hr_organization()
  )
);

-- Notifications are written by SECURITY DEFINER routines only: no client may
-- insert a notification addressed to somebody else.

/* ------------------------------------------------------------------ */
/* 6. Admin review RPCs                                               */
/* ------------------------------------------------------------------ */

-- One authorised transaction per review: status change, audit row and the
-- notifications, matching mockDb.reviewCandidate / reviewHrOrg exactly.

CREATE OR REPLACE FUNCTION public.admin_review_candidate(
  target_user_id UUID,
  new_status verification_status,
  review_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate_label TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins can review candidates';
  END IF;

  SELECT COALESCE(p.full_name, p.email) INTO candidate_label
  FROM profiles p
  WHERE p.id = target_user_id;

  IF candidate_label IS NULL THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  UPDATE candidate_profiles
  SET verification_status = new_status,
      rejection_reason = CASE
        WHEN new_status = 'rejected'
          THEN COALESCE(NULLIF(btrim(review_notes), ''), 'Did not meet verification requirements.')
        ELSE NULL
      END,
      verified_at = CASE WHEN new_status = 'verified' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  INSERT INTO verification_reviews (candidate_id, reviewer_id, status, notes)
  VALUES (target_user_id, auth.uid(), new_status, NULLIF(btrim(review_notes), ''));

  INSERT INTO notifications (
    recipient_user_id, recipient_role, type, title, message,
    entity_type, entity_id, priority
  )
  VALUES (
    target_user_id,
    'candidate',
    CASE WHEN new_status = 'verified' THEN 'candidate_verified' ELSE 'candidate_rejected' END,
    CASE WHEN new_status = 'verified' THEN 'Profile verified' ELSE 'Verification update' END,
    CASE
      WHEN new_status = 'verified' THEN 'Your profile has been verified.'
      ELSE 'Your verification request was reviewed. Please check your profile status.'
    END,
    'candidate',
    target_user_id::text,
    'high'
  );

  INSERT INTO notifications (
    recipient_user_id, recipient_role, type, title, message,
    entity_type, entity_id, priority
  )
  SELECT
    p.id,
    'admin',
    CASE WHEN new_status = 'verified' THEN 'candidate_verified_admin' ELSE 'candidate_rejected_admin' END,
    CASE WHEN new_status = 'verified' THEN 'Candidate verified' ELSE 'Candidate rejected' END,
    candidate_label || ' was ' || new_status::text || '.',
    'candidate',
    target_user_id::text,
    'normal'
  FROM profiles p
  WHERE p.role = 'admin';

  -- Keep the HR-facing directory row in step with the decision.
  UPDATE candidates c
  SET employer_visible = cp.employer_visible,
      updated_at = now()
  FROM candidate_profiles cp
  WHERE cp.user_id = c.id AND c.id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_hr_organization(
  target_org_id UUID,
  approved BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_name TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins can review organizations';
  END IF;

  UPDATE hr_organizations
  SET status = CASE WHEN approved THEN 'approved'::hr_org_status ELSE 'rejected'::hr_org_status END,
      approved_by = CASE WHEN approved THEN auth.uid() ELSE NULL END,
      approved_at = CASE WHEN approved THEN now() ELSE NULL END
  WHERE id = target_org_id
  RETURNING name INTO org_name;

  IF org_name IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    hm.user_id,
    'hr',
    target_org_id,
    CASE WHEN approved THEN 'hr_organization_approved' ELSE 'hr_organization_rejected' END,
    CASE WHEN approved THEN 'Organization approved' ELSE 'Organization review update' END,
    CASE
      WHEN approved THEN 'Your organization account has been approved.'
      ELSE 'Your organization account was reviewed. Please check your status.'
    END,
    'organization',
    target_org_id::text,
    'high'
  FROM hr_members hm
  WHERE hm.organization_id = target_org_id;

  INSERT INTO notifications (
    recipient_user_id, recipient_role, recipient_organization_id,
    type, title, message, entity_type, entity_id, priority
  )
  SELECT
    p.id,
    'admin',
    target_org_id,
    CASE WHEN approved THEN 'hr_organization_approved_admin' ELSE 'hr_organization_rejected_admin' END,
    CASE WHEN approved THEN 'HR organization approved' ELSE 'HR organization rejected' END,
    org_name || ' was ' || CASE WHEN approved THEN 'approved' ELSE 'rejected' END || '.',
    'organization',
    target_org_id::text,
    'normal'
  FROM profiles p
  WHERE p.role = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_candidate(UUID, verification_status, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_hr_organization(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_candidate(UUID, verification_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_hr_organization(UUID, BOOLEAN) TO authenticated;

/* ------------------------------------------------------------------ */
/* 7. Signup provisioning                                             */
/* ------------------------------------------------------------------ */

-- Creates the application records a new Auth user needs. The role is resolved
-- here, never taken on trust: anything other than an explicit 'hr' request
-- becomes a candidate, so no client can self-register as an admin. Admin
-- accounts stay a manual, out-of-band operation.
--
-- For a candidate this inserts candidate_profiles, which fires the existing
-- 005 trigger (SEH Talent ID) and the 006 trigger (imported roster claim),
-- landing on verification_status 'draft' and employer_visible false.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT;
  resolved_role user_role;
  resolved_name TEXT;
  organization_name TEXT;
  new_org_id UUID;
BEGIN
  -- profiles.email / candidates.email are NOT NULL. A provider that supplies no
  -- email (phone signup) must not make this trigger abort the signup itself.
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  requested_role := lower(btrim(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  resolved_role := CASE WHEN requested_role = 'hr' THEN 'hr'::user_role ELSE 'candidate'::user_role END;

  resolved_name := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');

  INSERT INTO profiles (id, role, email, full_name)
  VALUES (NEW.id, resolved_role, NEW.email, resolved_name)
  ON CONFLICT (id) DO NOTHING;

  IF resolved_role = 'candidate' THEN
    INSERT INTO candidate_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO candidates (id, name, email)
    VALUES (NEW.id, COALESCE(resolved_name, NEW.email), NEW.email)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    organization_name := NULLIF(
      btrim(COALESCE(NEW.raw_user_meta_data->>'organization_name', '')), ''
    );

    IF organization_name IS NOT NULL THEN
      -- Always 'pending': the existing admin approval workflow is preserved.
      INSERT INTO hr_organizations (name, status)
      VALUES (organization_name, 'pending')
      RETURNING id INTO new_org_id;

      INSERT INTO hr_members (user_id, organization_id, is_owner)
      VALUES (NEW.id, new_org_id, true)
      ON CONFLICT (user_id) DO NOTHING;

      INSERT INTO notifications (
        recipient_user_id, recipient_role, recipient_organization_id,
        type, title, message, entity_type, entity_id, priority
      )
      VALUES (
        NEW.id, 'hr', new_org_id,
        'hr_organization_pending',
        'Organization pending approval',
        'Your organization account is pending approval.',
        'organization', new_org_id::text, 'normal'
      );

      INSERT INTO notifications (
        recipient_user_id, recipient_role, recipient_organization_id,
        type, title, message, entity_type, entity_id, priority
      )
      SELECT
        p.id, 'admin', new_org_id,
        'hr_organization_registered',
        'New HR organization pending approval',
        organization_name || ' is pending approval.',
        'organization', new_org_id::text, 'high'
      FROM profiles p
      WHERE p.role = 'admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- AFTER INSERT only: existing users are never touched or re-provisioned.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
