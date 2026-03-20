-- Fix: org_members_see_each_other policy caused infinite recursion
-- because it subqueried organization_members which triggered the same policy.
-- Solution: use a SECURITY DEFINER function to bypass RLS during the check.

DROP POLICY IF EXISTS "org_members_see_each_other" ON organization_members;

CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$;

CREATE POLICY "org_members_see_each_other"
  ON organization_members
  FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));
