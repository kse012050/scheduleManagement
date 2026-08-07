create table if not exists public.schedule_images (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null
    references public.schedules (id) on delete cascade,
  work_date date not null,
  storage_path text not null unique,
  original_name text not null default '',
  mime_type text not null check (mime_type like 'image/%'),
  uploaded_by uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists schedule_images_schedule_date_index
  on public.schedule_images (schedule_id, work_date, created_at desc);

alter table public.schedule_images enable row level security;

drop policy if exists "schedule_images_select_allowed"
  on public.schedule_images;
drop policy if exists "schedule_images_insert_own_schedule"
  on public.schedule_images;
drop policy if exists "schedule_images_delete_own"
  on public.schedule_images;

create policy "schedule_images_select_allowed"
  on public.schedule_images for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.schedules as schedule
      where schedule.id = schedule_images.schedule_id
        and schedule.worker_id = (select auth.uid())
    )
  );

create policy "schedule_images_insert_own_schedule"
  on public.schedule_images for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1
      from public.schedules as schedule
      where schedule.id = schedule_images.schedule_id
        and schedule.worker_id = (select auth.uid())
        and schedule_images.work_date between
          schedule.start_date and schedule.end_date
    )
  );

create policy "schedule_images_delete_own"
  on public.schedule_images for delete to authenticated
  using (
    uploaded_by = (select auth.uid())
    and exists (
      select 1
      from public.schedules as schedule
      where schedule.id = schedule_images.schedule_id
        and schedule.worker_id = (select auth.uid())
    )
  );

revoke all on table public.schedule_images from anon;
grant select, insert, delete on table public.schedule_images
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'schedule-images',
  'schedule-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "schedule_image_files_select_allowed"
  on storage.objects;
drop policy if exists "schedule_image_files_insert_own_schedule"
  on storage.objects;
drop policy if exists "schedule_image_files_delete_own"
  on storage.objects;

create policy "schedule_image_files_select_allowed"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'schedule-images'
    and exists (
      select 1
      from public.schedule_images as image
      join public.schedules as schedule
        on schedule.id = image.schedule_id
      where image.storage_path = storage.objects.name
        and (
          (select private.is_admin())
          or schedule.worker_id = (select auth.uid())
        )
    )
  );

create policy "schedule_image_files_insert_own_schedule"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'schedule-images'
    and exists (
      select 1
      from public.schedules as schedule
      where schedule.id::text = (storage.foldername(name))[1]
        and schedule.worker_id = (select auth.uid())
        and (storage.foldername(name))[2] between
          schedule.start_date::text and schedule.end_date::text
    )
  );

create policy "schedule_image_files_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'schedule-images'
    and exists (
      select 1
      from public.schedule_images as image
      join public.schedules as schedule
        on schedule.id = image.schedule_id
      where image.storage_path = storage.objects.name
        and image.uploaded_by = (select auth.uid())
        and schedule.worker_id = (select auth.uid())
    )
  );
