create or replace function public.delete_registration_workflow(
  target_registration_week_id uuid
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_week_start date;
begin
  if not (select private.is_admin()) then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_REQUIRED';
  end if;

  select week.week_start
  into target_week_start
  from public.registration_weeks as week
  where week.id = target_registration_week_id;

  if target_week_start is null then
    raise exception using
      errcode = 'P0002',
      message = 'REGISTRATION_WEEK_NOT_FOUND';
  end if;

  delete from public.schedule_weeks
  where week_start = target_week_start;

  delete from public.registration_weeks
  where id = target_registration_week_id;

  return target_week_start;
end;
$$;

revoke all on function public.delete_registration_workflow(uuid)
from public, anon;

grant execute on function public.delete_registration_workflow(uuid)
to authenticated;
