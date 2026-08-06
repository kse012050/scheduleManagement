create extension if not exists btree_gist with schema extensions;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedules_worker_date_no_overlap'
      and conrelid = 'public.schedules'::regclass
  ) then
    if exists (
      select 1
      from public.schedules as first_schedule
      join public.schedules as second_schedule
        on first_schedule.worker_id = second_schedule.worker_id
       and first_schedule.id < second_schedule.id
       and daterange(
         first_schedule.start_date,
         first_schedule.end_date,
         '[]'
       ) && daterange(
         second_schedule.start_date,
         second_schedule.end_date,
         '[]'
       )
      where first_schedule.worker_id is not null
    ) then
      raise exception 'Existing worker schedules overlap. Resolve them before adding the constraint.';
    end if;

    alter table public.schedules
      add constraint schedules_worker_date_no_overlap
      exclude using gist (
        worker_id with =,
        daterange(start_date, end_date, '[]') with &&
      )
      where (worker_id is not null);
  end if;
end;
$$;
