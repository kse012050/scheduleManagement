-- Store the worker represented by each schedule.
-- Existing schedules remain valid with a null worker_id, while new app
-- registrations require an assigned worker.

alter table public.schedules
  add column if not exists worker_id uuid
  references public.profiles (id) on delete set null;

create index if not exists schedules_worker_index
  on public.schedules (worker_id);

create or replace function private.is_assigned_worker(
  target_job_id uuid,
  target_worker_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.job_assignments as assignment
    join public.profiles as profile
      on profile.id = assignment.worker_id
    where assignment.job_id = target_job_id
      and assignment.worker_id = target_worker_id
      and profile.role = 'worker'::public.user_role
      and profile.is_active = true
  );
$$;

revoke all on function private.is_assigned_worker(uuid, uuid) from public;
grant execute on function private.is_assigned_worker(uuid, uuid)
  to authenticated;

drop policy if exists "schedules_insert_visible_job" on public.schedules;
drop policy if exists "schedules_update_admin_or_creator" on public.schedules;
drop policy if exists "schedules_insert_assigned_worker" on public.schedules;
drop policy if exists "schedules_update_assigned_worker" on public.schedules;

create policy "schedules_insert_assigned_worker"
  on public.schedules for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_active_user())
    and (select private.can_view_job(job_id))
    and (select private.is_assigned_worker(job_id, worker_id))
    and (
      (select private.is_admin())
      or worker_id = (select auth.uid())
    )
  );

create policy "schedules_update_assigned_worker"
  on public.schedules for update to authenticated
  using (
    (select private.is_admin())
    or created_by = (select auth.uid())
  )
  with check (
    (select private.can_view_job(job_id))
    and (select private.is_assigned_worker(job_id, worker_id))
    and (
      (select private.is_admin())
      or (
        created_by = (select auth.uid())
        and worker_id = (select auth.uid())
        and (select private.is_active_user())
      )
    )
  );

comment on column public.schedules.worker_id is
  'Assigned worker represented by this schedule.';
