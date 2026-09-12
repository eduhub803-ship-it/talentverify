-- Super Admin authorization and safe platform-admin bootstrap helpers.
--
-- Additive only. Public signup remains candidate/HR: elevated roles may only be
-- provisioned through server-side/admin-owned paths, never through raw user
-- metadata submitted by the frontend.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;

-- Users may still edit their own profile fields, but never their own role.
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (
  auth.uid() = id
) WITH CHECK (
  auth.uid() = id
  AND role = public.current_profile_role()
);

-- Server-side signup provisioning. Public clients can only influence candidate
-- vs HR through raw_user_meta_data. Admin and Super Admin are read only from
-- app_metadata, which is not writable by public signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_user_role TEXT;
  requested_app_role TEXT;
  resolved_role user_role;
  resolved_name TEXT;
  organization_name TEXT;
  new_org_id UUID;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  requested_user_role := lower(btrim(COALESCE(NEW.raw_user_meta_data->>'role', '')));
  requested_app_role := lower(btrim(COALESCE(NEW.raw_app_meta_data->>'role', '')));

  resolved_role := CASE
    WHEN requested_app_role = 'super_admin' THEN 'super_admin'::user_role
    WHEN requested_app_role = 'admin' THEN 'admin'::user_role
    WHEN requested_user_role = 'hr' THEN 'hr'::user_role
    ELSE 'candidate'::user_role
  END;

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
  ELSIF resolved_role = 'hr' THEN
    organization_name := NULLIF(
      btrim(COALESCE(NEW.raw_user_meta_data->>'organization_name', '')), ''
    );

    IF organization_name IS NOT NULL THEN
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
        p.id, p.role, new_org_id,
        'hr_organization_registered',
        'New HR organization pending approval',
        organization_name || ' is pending approval.',
        'organization', new_org_id::text, 'high'
      FROM profiles p
      WHERE p.role IN ('admin', 'super_admin');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Owner/service-side helper for manually bootstrapping platform admins after
-- the Auth user exists. Intentionally not granted to authenticated users.
CREATE OR REPLACE FUNCTION public.provision_platform_admin_profile(
  target_user_id UUID,
  target_role user_role,
  target_full_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role user_role,
  has_candidate_profile BOOLEAN,
  has_candidate_directory_row BOOLEAN,
  has_hr_membership BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_email TEXT;
BEGIN
  IF target_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only admin or super_admin can be provisioned with this helper';
  END IF;

  SELECT u.email INTO target_email
  FROM auth.users u
  WHERE u.id = target_user_id;

  IF target_email IS NULL OR btrim(target_email) = '' THEN
    RAISE EXCEPTION 'Auth user with email is required before profile provisioning';
  END IF;

  DELETE FROM hr_members WHERE user_id = target_user_id;
  DELETE FROM candidate_profiles WHERE user_id = target_user_id;
  DELETE FROM candidates WHERE candidates.id = target_user_id;

  INSERT INTO profiles (id, role, email, full_name)
  VALUES (
    target_user_id,
    target_role,
    target_email,
    NULLIF(btrim(COALESCE(target_full_name, '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = now();

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.role,
    EXISTS (SELECT 1 FROM candidate_profiles cp WHERE cp.user_id = p.id),
    EXISTS (SELECT 1 FROM candidates c WHERE c.id = p.id),
    EXISTS (SELECT 1 FROM hr_members hm WHERE hm.user_id = p.id)
  FROM profiles p
  WHERE p.id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_platform_admin_profile(UUID, user_role, TEXT)
  FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
