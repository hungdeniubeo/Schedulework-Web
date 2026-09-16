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

  select registration_week.week_start
  into target_week_start
  from public.registration_weeks as registration_week
  where registration_week.id = target_registration_week_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'REGISTRATION_WEEK_NOT_FOUND';
  end if;

  -- Delete children explicitly before their weekly parents. The existing
  -- foreign-key cascades remain a safety net, but the workflow no longer
  -- depends on them being the only cleanup mechanism.
  delete from public.schedule_entries
  where schedule_week_id in (
    select schedule_week.id
    from public.schedule_weeks as schedule_week
    where schedule_week.week_start = target_week_start
  );

  delete from public.availability_submissions
  where week_id = target_registration_week_id;

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

comment on function public.delete_registration_workflow(uuid) is
'Admin-only atomic cleanup for one registration week and its matching schedule workflow.';

-- Make the RPC visible to PostgREST immediately after this migration is applied.
notify pgrst, 'reload schema';
