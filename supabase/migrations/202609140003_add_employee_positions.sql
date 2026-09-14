create table public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (
    name = btrim(name)
    and char_length(name) between 1 and 80
  ),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index positions_name_unique_idx
on public.positions (lower(name));

create index positions_sort_idx on public.positions(sort_order);

create trigger positions_set_updated_at before update on public.positions
for each row execute function private.set_updated_at();

alter table public.employees
add column position_id uuid references public.positions(id) on delete restrict;

create index employees_position_idx on public.employees(position_id);

-- role_label was the explicit display title. The three legacy title flags
-- were display-only; when role_label is empty, preserve one title using the
-- old UI's specificity order for the new single-position domain model.
with legacy_employee_titles as (
  select
    case
      when nullif(btrim(role_label), '') is not null then btrim(role_label)
      when is_executive_chef then 'Tổng bếp trưởng'
      when is_head_chef then 'Bếp trưởng'
      when is_manager then 'Quản lý'
      else null
    end as name
  from public.employees
), legacy_titles as (
  select distinct on (lower(name)) name
  from legacy_employee_titles
  where name is not null
  order by lower(name), name
), ordered_titles as (
  select
    name,
    (row_number() over (order by lower(name)) - 1)::integer as sort_order
  from legacy_titles
)
insert into public.positions (name, sort_order)
select name, sort_order
from ordered_titles;

update public.employees as employee
set position_id = position.id
from public.positions as position
where lower(position.name) = lower(case
  when nullif(btrim(employee.role_label), '') is not null
    then btrim(employee.role_label)
  when employee.is_executive_chef then 'Tổng bếp trưởng'
  when employee.is_head_chef then 'Bếp trưởng'
  when employee.is_manager then 'Quản lý'
  else null
end);

do $$
begin
  if exists (
    select 1
    from public.employees
    where (
      nullif(btrim(role_label), '') is not null
      or is_executive_chef
      or is_head_chef
      or is_manager
    )
    and position_id is null
  ) then
    raise exception 'EMPLOYEE_POSITION_BACKFILL_INCOMPLETE';
  end if;
end;
$$;

alter table public.positions enable row level security;

revoke all on table public.positions from anon, authenticated;
grant select, insert, update, delete on table public.positions to authenticated;
grant select (position_id) on table public.employees to authenticated;

create policy positions_select_admin on public.positions for select
to authenticated using ((select private.is_admin()));
create policy positions_insert_admin on public.positions for insert
to authenticated with check ((select private.is_admin()));
create policy positions_update_admin on public.positions for update
to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy positions_delete_admin on public.positions for delete
to authenticated using ((select private.is_admin()));

create policy positions_select_employee_schedule on public.positions for select
to authenticated using (
  (select private.current_employee_id()) is not null
  and exists (
    select 1
    from public.employees as employee
    where employee.position_id = positions.id
  )
);

create function public.swap_position_sort_orders(
  first_position_id uuid,
  second_position_id uuid
)
returns void
language sql
set search_path = ''
as $$
  update public.positions as position
  set sort_order = case
    when position.id = first_position_id then (
      select sort_order from public.positions where id = second_position_id
    )
    when position.id = second_position_id then (
      select sort_order from public.positions where id = first_position_id
    )
  end
  where position.id in (first_position_id, second_position_id);
$$;

revoke all on function public.swap_position_sort_orders(uuid, uuid)
from public, anon;
grant execute on function public.swap_position_sort_orders(uuid, uuid)
to authenticated;

alter table public.employees
drop column role_label,
drop column is_head_chef,
drop column is_executive_chef,
drop column is_manager;
