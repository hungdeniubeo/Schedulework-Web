-- Add a case-sensitive public username while allowing existing pre-cutover
-- profiles to remain until the one-time runtime-data reset is performed.
alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  add constraint profiles_username_required_for_new_rows
  check (username is not null) not valid;

alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[A-Za-z0-9]{3,32}$') not valid;

create unique index if not exists profiles_username_exact_uidx
  on public.profiles (username);

-- Every newly provisioned employee must now receive a username. Remove the
-- old overload so no service-role caller can accidentally create an account
-- without the public login identity.
drop function if exists public.provision_employee_account(uuid, text);

create or replace function public.provision_employee_account(
  auth_user_id uuid,
  employee_name text,
  account_username text
)
returns public.employees
language plpgsql
security definer
set search_path = ''
as $$
declare
  provisioned public.employees;
begin
  if not exists (select 1 from auth.users where id = auth_user_id) then
    raise exception using errcode = '23503', message = 'AUTH_USER_NOT_FOUND';
  end if;
  if char_length(btrim(employee_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'INVALID_EMPLOYEE_NAME';
  end if;
  if account_username is null
    or account_username !~ '^[A-Za-z0-9]{3,32}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_USERNAME';
  end if;

  insert into public.profiles (user_id, username, role, must_change_password)
  values (auth_user_id, account_username, 'employee', true);

  insert into public.employees (user_id, name)
  values (auth_user_id, btrim(employee_name))
  returning * into provisioned;

  return provisioned;
end;
$$;

revoke all on function public.provision_employee_account(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.provision_employee_account(uuid, text, text)
  to service_role;
