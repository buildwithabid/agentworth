-- SECURITY DEFECT, found by review and confirmed against production 2026-09-09.
--
-- public.target_state was created without security_invoker, so it ran with its
-- owner's privileges and bypassed row level security on public.targets. The
-- publishable key — which ships inside the dashboard's JavaScript bundle on the
-- PUBLIC agentworth.co site — could read every verified firm's name, email and
-- phone number: 399 rows, confirmed with a live unauthenticated request. The
-- base tables correctly refused the same key with 401.
--
-- security_invoker makes the view execute as the caller, so the targets_read
-- policy (public.is_member()) applies to it exactly as it does to the table.
alter view public.target_state set (security_invoker = on);

comment on view public.target_state is
  'security_invoker = on. Never create a view over the funnel tables without it: a definer-rights view bypasses RLS and exposes the whole lead list to the publishable key that ships in the public dashboard bundle.';
