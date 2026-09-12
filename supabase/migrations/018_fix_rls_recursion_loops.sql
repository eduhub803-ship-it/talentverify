-- Fix RLS infinite recursion on candidate_profiles, applications, jobs
-- Error 42P17: infinite recursion detected in policy
--
-- Root cause: RLS policies query tables with their own RLS, creating loops:
-- - candidate_admin queries profiles, whose profile_select policy queries candidate_profiles
-- - jobs_candidate_open_select queries profiles, which queries candidate_profiles
-- - applications_hr_select queries jobs, which queries candidate_profiles
--
-- Solution: Move role/permission checks into SECURITY DEFINER functions with skip_rls=ON
-- so policy subqueries do not re-trigger RLS on dependent tables.

-- Helper: Check if user is admin, bypassing RLS to avoid recursion in candidate_admin policy
CREATE OR REPLACE FUNCTION public.is_admin_skip_rls()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin_skip_rls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_skip_rls() TO authenticated;

-- Helper: Check if user is candidate role, bypassing RLS to avoid recursion in jobs policy
CREATE OR REPLACE FUNCTION public.is_candidate_role_skip_rls()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'candidate'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_candidate_role_skip_rls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_candidate_role_skip_rls() TO authenticated;

-- Helper: Check if user is HR member (for applications), bypassing RLS
CREATE OR REPLACE FUNCTION public.is_job_creator_skip_rls(job_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_id_param AND j.created_by = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_job_creator_skip_rls(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_job_creator_skip_rls(UUID) TO authenticated;

-- Drop and recreate candidate_admin policy to use the skip_rls function
DROP POLICY candidate_admin ON candidate_profiles;
CREATE POLICY candidate_admin ON candidate_profiles FOR ALL USING (
  public.is_admin_skip_rls()
);

-- Drop and recreate jobs_candidate_open_select policy to use the skip_rls function
DROP POLICY jobs_candidate_open_select ON jobs;
CREATE POLICY jobs_candidate_open_select ON jobs FOR SELECT USING (
  status = 'open'
  AND public.is_candidate_role_skip_rls()
);

-- Drop and recreate applications_hr_select policy to use the skip_rls function
DROP POLICY applications_hr_select ON applications;
CREATE POLICY applications_hr_select ON applications FOR SELECT USING (
  public.is_job_creator_skip_rls(job_id)
);

-- Drop and recreate applications_hr_update policy to use the skip_rls function
DROP POLICY applications_hr_update ON applications;
CREATE POLICY applications_hr_update ON applications FOR UPDATE USING (
  public.is_job_creator_skip_rls(job_id)
) WITH CHECK (
  public.is_job_creator_skip_rls(job_id)
);
