-- Postgres grants EXECUTE on new functions to PUBLIC, and PostgREST then
-- exposes them at /rest/v1/rpc/<name>. Trigger functions never need to be
-- callable by a client: a trigger runs them as part of the table operation
-- regardless of who holds EXECUTE.
revoke all on function public.handle_new_user()    from public, anon, authenticated;
revoke all on function public.guard_profile_role() from public, anon, authenticated;
revoke all on function public.ledger_guard()       from public, anon, authenticated;
revoke all on function public.set_updated_at()     from public, anon, authenticated;
revoke all on function public.deals_touch()        from public, anon, authenticated;
revoke all on function public.tasks_touch()        from public, anon, authenticated;

-- The role helpers are different: an RLS policy expression is evaluated as the
-- calling role, so a signed-in user genuinely needs EXECUTE on them. Anonymous
-- callers never reach those policies — every one is `to authenticated` — so
-- they get nothing.
--
-- Supabase's linter still flags my_role() as a SECURITY DEFINER function that
-- signed-in users can call. That is deliberate and harmless: it takes no
-- arguments and returns the caller's own role, which they already know.
revoke all on function public.my_role()   from public, anon;
revoke all on function public.is_admin()  from public, anon;
revoke all on function public.is_member() from public, anon;

grant execute on function public.my_role(), public.is_admin(), public.is_member()
  to authenticated;
