-- Only active administrators can create, update, or delete jobs.
-- Workers retain read access to jobs assigned to them and can continue using
-- the existing schedule policies for those jobs.

drop policy if exists "jobs_insert_active_user" on public.jobs;
drop policy if exists "jobs_update_admin_or_creator" on public.jobs;
drop policy if exists "jobs_delete_admin_or_creator" on public.jobs;

create policy "jobs_insert_admin"
  on public.jobs for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_admin())
  );

create policy "jobs_update_admin"
  on public.jobs for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "jobs_delete_admin"
  on public.jobs for delete to authenticated
  using ((select private.is_admin()));
