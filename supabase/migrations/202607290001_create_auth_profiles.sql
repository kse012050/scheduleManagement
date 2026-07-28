-- Supabase Auth + application profile schema
--
-- The app accepts a login ID, but Supabase Auth signs in with an email internally.
-- Convert an ID to a deterministic internal email in the app:
--   worker01 -> worker01@login.local
--
-- Passwords must remain in Supabase Auth. Never store them in public.profiles.

create type public.user_role as enum ('admin', 'worker');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  login_id text not null,
  name text not null,
  role public.user_role not null default 'worker',
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_login_id_format check (
    login_id ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
  ),
  constraint profiles_name_not_blank check (length(trim(name)) > 0)
);

create unique index profiles_login_id_unique
  on public.profiles (lower(login_id));

create index profiles_role_index
  on public.profiles (role);

create schema if not exists private;

-- Keep authorization checks outside the exposed public schema.
create or replace function private.is_admin()
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
      and role = 'admin'::public.user_role
      and is_active = true
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- A newly created Auth user is always a worker.
-- Do not trust raw_user_meta_data.role because users can edit that metadata.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_login_id text;
  generated_name text;
begin
  generated_login_id := lower(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'login_id'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  );

  generated_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    generated_login_id
  );

  insert into public.profiles (
    id,
    login_id,
    name,
    role,
    must_change_password,
    is_active
  )
  values (
    new.id,
    generated_login_id,
    generated_name,
    'worker'::public.user_role,
    true,
    true
  );

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_profile_updated_at() from public;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_profile_updated_at();

alter table public.profiles enable row level security;

-- A user can read their own profile. An active admin can read every profile.
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or (select private.is_admin())
  );

-- Only non-privileged profile fields are granted for client-side updates.
-- Role and activation changes must be performed by a trusted server function.
create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  to authenticated
  using (
    (select auth.uid()) = id
    or (select private.is_admin())
  )
  with check (
    (select auth.uid()) = id
    or (select private.is_admin())
  );

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (name, must_change_password, updated_at)
  on table public.profiles
  to authenticated;

-- Separate read models while keeping one source-of-truth table.
-- security_invoker makes these views obey profiles RLS.
create view public.admins
with (security_invoker = true)
as
select
  id,
  login_id,
  name,
  must_change_password,
  is_active,
  created_at,
  updated_at
from public.profiles
where role = 'admin'::public.user_role;

create view public.workers
with (security_invoker = true)
as
select
  id,
  login_id,
  name,
  must_change_password,
  is_active,
  created_at,
  updated_at
from public.profiles
where role = 'worker'::public.user_role;

revoke all on table public.admins from anon;
revoke all on table public.workers from anon;
grant select on table public.admins to authenticated;
grant select on table public.workers to authenticated;

comment on table public.profiles is
  'Application profile linked one-to-one with auth.users.';
comment on column public.profiles.login_id is
  'Lowercase login ID shown to the user. Auth uses login_id@login.local internally.';
comment on column public.profiles.role is
  'Application authorization role: admin or worker.';

