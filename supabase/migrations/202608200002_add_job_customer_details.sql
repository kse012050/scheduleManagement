-- Customer contact and temporary site access information for jobs.
-- Existing jobs RLS limits reads to administrators, creators, and assigned
-- workers. The application does not expose these fields in the job list.
-- entry_password is intentionally stored as plain text for on-site use.

alter table public.jobs
  add column if not exists customer_phone text not null default '',
  add column if not exists entry_password text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_customer_phone_format'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_customer_phone_format check (
        customer_phone = '' or customer_phone ~ '^0[0-9]{8,10}$'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_entry_password_length'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_entry_password_length check (
        length(entry_password) <= 50
      );
  end if;
end;
$$;

comment on column public.jobs.customer_phone is
  'Customer phone number shown only in an authorized job detail.';
comment on column public.jobs.entry_password is
  'Temporary site access password shown only in an authorized job detail.';
