create or replace function public.reorder_scheduler_employee(
  target_employee_id uuid,
  target_group_id uuid,
  before_employee_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_group_id uuid;
  target_index integer;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;

  if not exists (
    select 1 from public.groups where id = target_group_id
  ) then
    raise exception using errcode = 'P0002', message = 'TARGET_GROUP_NOT_FOUND';
  end if;

  select employee.group_id
  into source_group_id
  from public.employees as employee
  where employee.id = target_employee_id
    and employee.deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'EMPLOYEE_NOT_FOUND';
  end if;

  if before_employee_id = target_employee_id then
    return;
  end if;

  if before_employee_id is not null and not exists (
    select 1
    from public.employees as employee
    where employee.id = before_employee_id
      and employee.group_id = target_group_id
      and employee.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_BEFORE_EMPLOYEE';
  end if;

  -- Park the moved employee at the end of the target group while the two
  -- affected groups are normalized. Schedule entries keep their employee_id
  -- and are deliberately untouched by this operation.
  update public.employees
  set group_id = target_group_id,
      sort_order = 2147483647
  where id = target_employee_id;

  if source_group_id is distinct from target_group_id then
    with normalized as (
      select employee.id,
             row_number() over (
               order by employee.sort_order, employee.created_at, employee.id
             ) - 1 as next_order
      from public.employees as employee
      where employee.group_id is not distinct from source_group_id
        and employee.id <> target_employee_id
        and employee.deleted_at is null
    )
    update public.employees as employee
    set sort_order = normalized.next_order
    from normalized
    where employee.id = normalized.id;
  end if;

  with normalized as (
    select employee.id,
           row_number() over (
             order by employee.sort_order, employee.created_at, employee.id
           ) - 1 as next_order
    from public.employees as employee
    where employee.group_id = target_group_id
      and employee.id <> target_employee_id
      and employee.deleted_at is null
  )
  update public.employees as employee
  set sort_order = normalized.next_order
  from normalized
  where employee.id = normalized.id;

  if before_employee_id is null then
    target_index := 0;
  else
    select employee.sort_order
    into target_index
    from public.employees as employee
    where employee.id = before_employee_id
      and employee.group_id = target_group_id
      and employee.deleted_at is null;
  end if;

  update public.employees
  set sort_order = sort_order + 1
  where group_id = target_group_id
    and id <> target_employee_id
    and deleted_at is null
    and sort_order >= target_index;

  update public.employees
  set sort_order = target_index
  where id = target_employee_id;
end;
$$;

revoke all on function public.reorder_scheduler_employee(uuid, uuid, uuid)
from public, anon;
grant execute on function public.reorder_scheduler_employee(uuid, uuid, uuid)
to authenticated;

comment on function public.reorder_scheduler_employee(uuid, uuid, uuid) is
'Atomically reorders an active scheduler employee within or between groups without changing schedule entry ownership.';
