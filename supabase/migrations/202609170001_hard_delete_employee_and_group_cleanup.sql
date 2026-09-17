-- Permanent employee deletion is performed by deleting the employee's Auth user.
-- These cascades make that one operation remove the employee row and all
-- employee-owned registration/schedule data atomically in Postgres.

alter table public.employees
  drop constraint if exists employees_user_id_fkey;

alter table public.employees
  add constraint employees_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade;

alter table public.availability_submissions
  drop constraint if exists availability_submissions_employee_id_fkey;

alter table public.availability_submissions
  add constraint availability_submissions_employee_id_fkey
  foreign key (employee_id)
  references public.employees(id)
  on delete cascade;

alter table public.schedule_entries
  drop constraint if exists schedule_entries_employee_id_fkey;

alter table public.schedule_entries
  add constraint schedule_entries_employee_id_fkey
  foreign key (employee_id)
  references public.employees(id)
  on delete cascade;

-- Group deletion must never be blocked by current or previously soft-deleted
-- employees. They simply become ungrouped when the group disappears.
alter table public.employees
  drop constraint if exists employees_group_id_fkey;

alter table public.employees
  add constraint employees_group_id_fkey
  foreign key (group_id)
  references public.groups(id)
  on delete set null;

create or replace function public.delete_group_and_unassign_employees(
  target_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;

  delete from public.groups
  where id = target_group_id;
end;
$$;

revoke all on function public.delete_group_and_unassign_employees(uuid) from public, anon;
grant execute on function public.delete_group_and_unassign_employees(uuid) to authenticated;
