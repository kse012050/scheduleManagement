-- Shared jobs, worker assignments, and schedules.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  location text not null default '',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_assignments (
  job_id uuid not null references public.jobs (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (job_id, worker_id)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  start_date date not null,
  end_date date not null,
  note text not null default '',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_valid_date_range check (start_date <= end_date)
);

create index jobs_created_by_index on public.jobs (created_by);
create index job_assignments_worker_index on public.job_assignments (worker_id);
create index schedules_job_index on public.schedules (job_id);

create trigger set_jobs_updated_at
  before update on public.jobs
  for each row execute procedure public.set_profile_updated_at();

create trigger set_schedules_updated_at
  before update on public.schedules
  for each row execute procedure public.set_profile_updated_at();

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active = true
  );
$$;

create or replace function private.can_view_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_admin())
    or exists (
      select 1
      from public.jobs
      where id = target_job_id
        and created_by = (select auth.uid())
    )
    or exists (
      select 1
      from public.job_assignments
      where job_id = target_job_id
        and worker_id = (select auth.uid())
    );
$$;

revoke all on function private.is_active_user() from public;
revoke all on function private.can_view_job(uuid) from public;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.can_view_job(uuid) to authenticated;

alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.schedules enable row level security;

create policy "jobs_select_visible"
  on public.jobs for select to authenticated
  using ((select private.can_view_job(id)));

create policy "jobs_insert_active_user"
  on public.jobs for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_active_user())
  );

create policy "jobs_update_admin_or_creator"
  on public.jobs for update to authenticated
  using (
    (select private.is_admin())
    or created_by = (select auth.uid())
  )
  with check (
    (select private.is_admin())
    or created_by = (select auth.uid())
  );

create policy "jobs_delete_admin_or_creator"
  on public.jobs for delete to authenticated
  using (
    (select private.is_admin())
    or created_by = (select auth.uid())
  );

create policy "job_assignments_select_visible"
  on public.job_assignments for select to authenticated
  using ((select private.can_view_job(job_id)));

create policy "job_assignments_insert_admin"
  on public.job_assignments for insert to authenticated
  with check (
    (select private.is_admin())
    and assigned_by = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where id = worker_id
        and role = 'worker'::public.user_role
        and is_active = true
    )
  );

create policy "job_assignments_delete_admin"
  on public.job_assignments for delete to authenticated
  using ((select private.is_admin()));

create policy "schedules_select_visible_job"
  on public.schedules for select to authenticated
  using ((select private.can_view_job(job_id)));

create policy "schedules_insert_visible_job"
  on public.schedules for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_active_user())
    and (select private.can_view_job(job_id))
  );

create policy "schedules_update_admin_or_creator"
  on public.schedules for update to authenticated
  using (
    (select private.is_admin())
    or created_by = (select auth.uid())
  )
  with check (
    (select private.is_admin())
    or created_by = (select auth.uid())
  );

create policy "schedules_delete_admin_or_creator"
  on public.schedules for delete to authenticated
  using (
    (select private.is_admin())
    or created_by = (select auth.uid())
  );

revoke all on table public.jobs from anon;
revoke all on table public.job_assignments from anon;
revoke all on table public.schedules from anon;
grant select, insert, update, delete on table public.jobs to authenticated;
grant select, insert, delete on table public.job_assignments to authenticated;
grant select, insert, update, delete on table public.schedules to authenticated;
