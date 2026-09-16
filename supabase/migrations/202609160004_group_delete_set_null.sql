alter table public.employees
  drop constraint if exists employees_group_id_fkey;

alter table public.employees
  add constraint employees_group_id_fkey
  foreign key (group_id)
  references public.groups(id)
  on delete set null;
