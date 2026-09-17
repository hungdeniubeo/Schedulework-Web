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

  update public.employees
  set group_id = null
  where group_id = target_group_id;

  delete from public.groups
  where id = target_group_id;
end;
$$;

revoke all on function public.delete_group_and_unassign_employees(uuid) from public, anon;
grant execute on function public.delete_group_and_unassign_employees(uuid) to authenticated;
