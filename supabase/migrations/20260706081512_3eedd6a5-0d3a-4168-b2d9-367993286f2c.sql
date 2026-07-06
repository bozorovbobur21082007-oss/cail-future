
-- handle_new_user is a SECURITY DEFINER trigger function called only by the
-- auth trigger, never by API clients. Revoke EXECUTE from public roles so
-- anon/authenticated cannot call it directly via PostgREST/RPC.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
