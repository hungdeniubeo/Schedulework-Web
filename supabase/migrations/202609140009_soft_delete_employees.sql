-- Employees are retired without deleting Auth, profile, availability, or schedule history.
alter table public.employees
  add column deleted_at timestamptz;

alter table public.employees
  add constraint employees_deleted_inactive_check
  check (deleted_at is null or active = false) not valid;

alter table public.employees
  validate constraint employees_deleted_inactive_check;

alter table public.availability_submissions
  drop constraint availability_submissions_employee_id_fkey;

alter table public.availability_submissions
  add constraint availability_submissions_employee_id_fkey
  foreign key (employee_id) references public.employees(id) on delete restrict;

grant select (deleted_at) on table public.employees to authenticated;
revoke delete on table public.employees from authenticated;
drop policy employees_delete_admin on public.employees;

create or replace function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select employee.id
  from public.employees employee
  join public.profiles profile on profile.user_id = employee.user_id
  where employee.user_id = (select auth.uid())
    and employee.active = true
    and employee.deleted_at is null
    and profile.role = 'employee'
    and profile.must_change_password = false;
$$;

drop policy employees_select_own_active on public.employees;
create policy employees_select_own_active
on public.employees for select to authenticated
using (
  user_id = (select auth.uid())
  and active = true
  and deleted_at is null
);

drop policy employees_select_active_directory on public.employees;
create policy employees_select_active_directory
on public.employees for select to authenticated
using (
  active = true
  and deleted_at is null
  and (select private.current_role()) = 'employee'
  and (select private.current_employee_id()) is not null
);

create or replace function public.my_employee()
returns table (
  id uuid,
  name text,
  active boolean,
  group_id uuid,
  sort_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select employee.id, employee.name, employee.active, employee.group_id, employee.sort_order
  from public.employees employee
  where employee.user_id = (select auth.uid())
    and employee.active = true
    and employee.deleted_at is null;
$$;
