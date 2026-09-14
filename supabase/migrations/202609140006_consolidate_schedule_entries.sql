create or replace function public.consolidate_schedule_entry(
  keeper_entry_id uuid,
  target_employee_id uuid,
  target_day_of_week smallint,
  target_shift_type_id uuid,
  target_custom_label text,
  target_sort_order integer,
  remove_entry_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_week_id uuid;
begin
  update public.schedule_entries
  set employee_id = target_employee_id,
      day_of_week = target_day_of_week,
      shift_type_id = target_shift_type_id,
      custom_start = null,
      custom_end = null,
      custom_label = target_custom_label,
      sort_order_in_cell = target_sort_order
  where id = keeper_entry_id
  returning schedule_week_id into target_week_id;

  if target_week_id is null then
    raise exception using errcode = 'P0002', message = 'SCHEDULE_ENTRY_NOT_FOUND';
  end if;

  delete from public.schedule_entries
  where id = any(coalesce(remove_entry_ids, array[]::uuid[]))
    and id <> keeper_entry_id
    and schedule_week_id = target_week_id;
end;
$$;

revoke all on function public.consolidate_schedule_entry(
  uuid, uuid, smallint, uuid, text, integer, uuid[]
) from public, anon;
grant execute on function public.consolidate_schedule_entry(
  uuid, uuid, smallint, uuid, text, integer, uuid[]
) to authenticated;

comment on function public.consolidate_schedule_entry(
  uuid, uuid, smallint, uuid, text, integer, uuid[]
) is 'Atomically keeps one consolidated entry and removes superseded entries in a draft schedule cell; table RLS remains enforced.';
