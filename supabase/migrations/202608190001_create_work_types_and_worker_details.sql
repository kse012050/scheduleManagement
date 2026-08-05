-- Worker phone numbers and selectable work types.

create table if not exists public.work_types (
  id bigint generated always as identity primary key,
  name text not null unique,
  note text,
  color_hex text not null,
  sort_order integer not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint work_types_name_not_blank check (length(trim(name)) > 0),
  constraint work_types_color_hex_format check (
    color_hex ~ '^#[0-9A-Fa-f]{6}$'
  )
);

insert into public.work_types (name, note, color_hex, sort_order)
values
  ('철거', null, '#64748B', 1),
  ('확장', null, '#0EA5E9', 2),
  ('설비', null, '#14B8A6', 3),
  ('샷시', null, '#0891B2', 4),
  ('목공', null, '#A16207', 5),
  ('타일', null, '#7C3AED', 6),
  ('페인트', null, '#DB2777', 7),
  ('마루', null, '#B45309', 8),
  ('필름', null, '#8B5CF6', 9),
  ('도배', null, '#EA580C', 10),
  ('가구', null, '#92400E', 11),
  ('전기', null, '#CA8A04', 12),
  ('욕실공사', null, '#2563EB', 13)
on conflict (name) do update
set
  note = excluded.note,
  color_hex = excluded.color_hex,
  sort_order = excluded.sort_order,
  is_active = true;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists work_type_id bigint references public.work_types (id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_phone_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_phone_format check (
        phone is null or phone ~ '^01[016789][0-9]{7,8}$'
      );
  end if;
end;
$$;

create index if not exists profiles_work_type_id_index
  on public.profiles (work_type_id);

alter table public.work_types enable row level security;

drop policy if exists "work_types_select_authenticated"
  on public.work_types;

create policy "work_types_select_authenticated"
  on public.work_types
  for select
  to authenticated
  using (true);

revoke all on table public.work_types from anon;
revoke all on table public.work_types from authenticated;
grant select on table public.work_types to authenticated;

-- Include the new fields when Auth creates the matching profile.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_login_id text;
  generated_name text;
  generated_phone text;
  generated_work_type_id bigint;
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

  generated_phone := nullif(
    regexp_replace(
      coalesce(new.raw_user_meta_data ->> 'phone', ''),
      '[^0-9]',
      '',
      'g'
    ),
    ''
  );

  generated_work_type_id := case
    when coalesce(new.raw_user_meta_data ->> 'work_type_id', '') ~ '^[0-9]+$'
      then (new.raw_user_meta_data ->> 'work_type_id')::bigint
    else null
  end;

  insert into public.profiles (
    id,
    login_id,
    name,
    role,
    must_change_password,
    is_active,
    phone,
    work_type_id
  )
  values (
    new.id,
    generated_login_id,
    generated_name,
    'worker'::public.user_role,
    true,
    true,
    generated_phone,
    generated_work_type_id
  );

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

create or replace view public.admins
with (security_invoker = true)
as
select
  id,
  login_id,
  name,
  must_change_password,
  is_active,
  created_at,
  updated_at,
  phone,
  work_type_id
from public.profiles
where role = 'admin'::public.user_role;

create or replace view public.workers
with (security_invoker = true)
as
select
  id,
  login_id,
  name,
  must_change_password,
  is_active,
  created_at,
  updated_at,
  phone,
  work_type_id
from public.profiles
where role = 'worker'::public.user_role;

revoke all on table public.admins from anon;
revoke all on table public.workers from anon;
grant select on table public.admins to authenticated;
grant select on table public.workers to authenticated;
