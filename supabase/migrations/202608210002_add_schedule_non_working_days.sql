-- Exclude Saturdays, Sundays, and Korean public holidays from a schedule by
-- default. The date range is retained, and the client skips those dates when
-- rendering the schedule.

alter table public.schedules
  add column if not exists exclude_non_working_days boolean
  not null default true;

comment on column public.schedules.exclude_non_working_days is
  'When true, Saturdays, Sundays, and Korean public holidays are skipped.';
