drop policy if exists "schedules_insert_visible_job"
  on public.schedules;
drop policy if exists "schedules_insert_assigned_worker"
  on public.schedules;
drop policy if exists "schedules_insert_admin"
  on public.schedules;

create policy "schedules_insert_admin"
  on public.schedules for insert to authenticated
  with check (
    (select private.is_admin())
    and created_by = (select auth.uid())
    and (select private.is_active_user())
    and (select private.can_view_job(job_id))
    and exists (
      select 1
      from public.job_assignments as assignment
      where assignment.job_id = schedules.job_id
        and assignment.worker_id = schedules.worker_id
    )
  );
