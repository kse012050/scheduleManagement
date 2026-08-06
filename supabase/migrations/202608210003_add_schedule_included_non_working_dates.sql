-- Optional weekend and public-holiday work dates inside a schedule range.

alter table public.schedules
  add column if not exists included_non_working_dates date[]
  not null default '{}';

comment on column public.schedules.included_non_working_dates is
  'Weekend or public-holiday dates explicitly included in the schedule.';
