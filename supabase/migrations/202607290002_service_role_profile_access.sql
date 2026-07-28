-- Edge Functions use the service_role only on the server.
-- New-table automatic grants are disabled for this project, so grant only
-- the profile permissions required by worker administration functions.

grant usage on schema public to service_role;
grant select on table public.profiles to service_role;
grant update (must_change_password, updated_at)
  on table public.profiles
  to service_role;
