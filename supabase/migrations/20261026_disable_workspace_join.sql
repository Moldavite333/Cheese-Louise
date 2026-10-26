-- Cheese Louise HQ is private to its two existing members.
-- A join code must never grant access to a new authenticated user.
-- Keep the function for legacy code compatibility, but make it inaccessible
-- through the public/authenticated API. Existing memberships are unchanged.
revoke execute on function public.join_workspace(text) from public;
revoke execute on function public.join_workspace(text) from anon;
revoke execute on function public.join_workspace(text) from authenticated;
