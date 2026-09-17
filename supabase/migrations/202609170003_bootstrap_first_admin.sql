create or replace function public.bootstrap_first_admin(
  auth_user_id uuid,
  account_username text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  bootstrapped public.profiles;
begin
  perform pg_advisory_xact_lock(
    hashtext('schedulework-bootstrap-first-admin')::bigint
  );

  if exists (
    select 1
    from public.profiles
    where role = 'admin'
  ) then
    raise exception using errcode = 'P0001', message = 'ADMIN_ALREADY_EXISTS';
  end if;

  if not exists (select 1 from auth.users where id = auth_user_id) then
    raise exception using errcode = '23503', message = 'AUTH_USER_NOT_FOUND';
  end if;

  if account_username is null
    or account_username !~ '^[A-Za-z0-9]{3,32}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_USERNAME';
  end if;

  insert into public.profiles (user_id, username, role, must_change_password)
  values (auth_user_id, account_username, 'admin', false)
  returning * into bootstrapped;

  return bootstrapped;
end;
$$;

revoke all on function public.bootstrap_first_admin(uuid, text)
  from public, anon, authenticated;
grant execute on function public.bootstrap_first_admin(uuid, text)
  to service_role;
