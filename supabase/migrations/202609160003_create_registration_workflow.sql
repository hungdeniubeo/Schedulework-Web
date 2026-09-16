insert into public.schedule_weeks (week_start, status)
select registration_week.week_start, 'draft'
from public.registration_weeks as registration_week
where not exists (
  select 1
  from public.schedule_weeks as schedule_week
  where schedule_week.week_start = registration_week.week_start
);

create or replace function public.create_registration_workflow(
  target_week_start date,
  target_lock_at timestamptz
)
returns public.registration_weeks
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_week public.registration_weeks;
begin
  if not (select private.is_admin()) then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_REQUIRED';
  end if;

  insert into public.registration_weeks (week_start, lock_at, status)
  values (target_week_start, target_lock_at, 'open')
  returning * into created_week;

  insert into public.schedule_weeks (week_start, status)
  values (target_week_start, 'draft');

  return created_week;
end;
$$;

revoke all on function public.create_registration_workflow(date, timestamptz)
from public, anon;

grant execute on function public.create_registration_workflow(date, timestamptz)
to authenticated;

comment on function public.create_registration_workflow(date, timestamptz) is
'Admin-only atomic creation of a registration week and its matching draft schedule.';

notify pgrst, 'reload schema';
