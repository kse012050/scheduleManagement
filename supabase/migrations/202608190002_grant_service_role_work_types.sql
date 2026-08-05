-- Edge Functions use the service role to validate selected work types.

grant select on table public.work_types to service_role;
