create schema if not exists private;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'employee')),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  active boolean not null default true,
  group_id uuid references public.groups(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_head_chef boolean not null default false,
  is_executive_chef boolean not null default false,
  is_manager boolean not null default false,
  is_full_time boolean not null default false,
  is_new boolean not null default false,
  role_label text check (role_label is null or char_length(role_label) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shift_types (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_preset boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.shift_types (label, color, is_preset) values
  ('10:00-14:00', '#70AD47', true),
  ('14:00-23:00', '#C55A5A', true),
  ('17:00-23:00', '#ED7D31', true),
  ('18:00-23:00', '#ED7D31', true),
  ('10h-14h/18h-23h', '#5B9BD5', true),
  ('11h-15h/18h-22h', '#5B9BD5', true),
  ('10h-14h/17h-23h', '#5B9BD5', true);

create table public.registration_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique check (extract(isodow from week_start) = 1),
  lock_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'locked', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.is_valid_availability(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  day_key text;
  day_value jsonb;
  start_type text;
  end_type text;
begin
  if jsonb_typeof(value) <> 'object'
    or value->>'version' <> '1'
    or jsonb_typeof(value->'days') <> 'object'
    or (select count(*) from jsonb_object_keys(value->'days')) <> 7
  then
    return false;
  end if;

  for day_key in select generate_series(1, 7)::text loop
    day_value := value->'days'->day_key;
    if day_value is null
      or jsonb_typeof(day_value) <> 'object'
      or not (day_value ?& array['status', 'periods', 'start', 'end'])
      or coalesce(day_value->>'status', '') not in ('available', 'off')
      or jsonb_typeof(day_value->'periods') <> 'array'
    then
      return false;
    end if;

    if exists (
      select 1 from jsonb_array_elements_text(day_value->'periods') as period(value)
      where period.value not in ('morning', 'afternoon', 'evening')
    ) or jsonb_array_length(day_value->'periods') <>
      (select count(distinct period.value) from jsonb_array_elements_text(day_value->'periods') as period(value))
    then
      return false;
    end if;

    start_type := jsonb_typeof(day_value->'start');
    end_type := jsonb_typeof(day_value->'end');
    if day_value->>'status' = 'off' then
      if jsonb_array_length(day_value->'periods') <> 0
        or start_type <> 'null'
        or end_type <> 'null'
      then
        return false;
      end if;
    else
      if start_type = 'null' and end_type = 'null' then
        if jsonb_array_length(day_value->'periods') = 0 then return false; end if;
      elsif start_type = 'string' and end_type = 'string' then
        if (day_value->>'start') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
          or (day_value->>'end') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
          or (day_value->>'start') >= (day_value->>'end')
        then
          return false;
        end if;
      else
        return false;
      end if;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function private.is_valid_availability(jsonb) from public;

create table public.availability_submissions (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.registration_weeks(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  availability jsonb not null check (private.is_valid_availability(availability)),
  note text check (note is null or char_length(note) <= 500),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, employee_id)
);

create table public.schedule_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique check (extract(isodow from week_start) = 1),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  count_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(count_overrides) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  schedule_week_id uuid not null references public.schedule_weeks(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  shift_type_id uuid not null references public.shift_types(id) on delete restrict,
  custom_start time,
  custom_end time,
  custom_label text check (custom_label is null or char_length(custom_label) <= 120),
  sort_order_in_cell integer not null default 0 check (sort_order_in_cell >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (custom_start is null and custom_end is null)
    or (custom_start is not null and custom_end is not null and custom_start < custom_end)
  )
);

create index groups_sort_idx on public.groups(sort_order);
create index employees_active_idx on public.employees(active);
create index employees_group_sort_idx on public.employees(group_id, sort_order);
create index shift_types_label_idx on public.shift_types(label);
create index registration_weeks_status_start_idx on public.registration_weeks(status, week_start);
create index availability_submissions_week_idx on public.availability_submissions(week_id);
create index availability_submissions_employee_idx on public.availability_submissions(employee_id);
create index schedule_weeks_status_start_idx on public.schedule_weeks(status, week_start);
create index schedule_entries_week_idx on public.schedule_entries(schedule_week_id);
create index schedule_entries_employee_idx on public.schedule_entries(employee_id);
create index schedule_entries_cell_idx on public.schedule_entries(schedule_week_id, employee_id, day_of_week, sort_order_in_cell);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger employees_set_updated_at before update on public.employees
for each row execute function private.set_updated_at();
create trigger groups_set_updated_at before update on public.groups
for each row execute function private.set_updated_at();
create trigger shift_types_set_updated_at before update on public.shift_types
for each row execute function private.set_updated_at();
create trigger registration_weeks_set_updated_at before update on public.registration_weeks
for each row execute function private.set_updated_at();
create trigger availability_submissions_set_updated_at before update on public.availability_submissions
for each row execute function private.set_updated_at();
create trigger schedule_weeks_set_updated_at before update on public.schedule_weeks
for each row execute function private.set_updated_at();
create trigger schedule_entries_set_updated_at before update on public.schedule_entries
for each row execute function private.set_updated_at();

create or replace function private.protect_published_shift_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.schedule_entries as entry
    join public.schedule_weeks as week on week.id = entry.schedule_week_id
    where entry.shift_type_id = old.id and week.status = 'published'
  ) then
    raise exception using errcode = '23503', message = 'SHIFT_USED_BY_PUBLISHED_SCHEDULE';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_published_shift_type() from public;
create trigger shift_types_protect_published before update or delete on public.shift_types
for each row execute function private.protect_published_shift_type();

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where user_id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_role()) = 'admin', false);
$$;

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
    and profile.role = 'employee'
    and profile.must_change_password = false;
$$;

create or replace function private.registration_is_open(target_week_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.registration_weeks
    where id = target_week_id
      and status = 'open'
      and clock_timestamp() < lock_at
  );
$$;

create or replace function private.schedule_is_draft(target_week_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.schedule_weeks
    where id = target_week_id and status = 'draft'
  );
$$;

revoke all on function private.current_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.current_employee_id() from public;
revoke all on function private.registration_is_open(uuid) from public;
revoke all on function private.schedule_is_draft(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_employee_id() to authenticated;
grant execute on function private.registration_is_open(uuid) to authenticated;
grant execute on function private.schedule_is_draft(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.employees enable row level security;
alter table public.shift_types enable row level security;
alter table public.registration_weeks enable row level security;
alter table public.availability_submissions enable row level security;
alter table public.schedule_weeks enable row level security;
alter table public.schedule_entries enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.groups from anon, authenticated;
revoke all on table public.employees from anon, authenticated;
revoke all on table public.shift_types from anon, authenticated;
revoke all on table public.registration_weeks from anon, authenticated;
revoke all on table public.availability_submissions from anon, authenticated;
revoke all on table public.schedule_weeks from anon, authenticated;
revoke all on table public.schedule_entries from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.groups to authenticated;
grant select (id, name, active, group_id, sort_order, is_head_chef, is_executive_chef, is_manager, is_full_time, is_new, role_label, created_at, updated_at) on table public.employees to authenticated;
grant insert, update, delete on table public.employees to authenticated;
grant select, insert, update, delete on table public.shift_types to authenticated;
grant select, insert, update, delete on table public.registration_weeks to authenticated;
grant select, insert, update, delete on table public.availability_submissions to authenticated;
grant select, insert, update, delete on table public.schedule_weeks to authenticated;
grant select, insert, update, delete on table public.schedule_entries to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated
using (user_id = (select auth.uid()));
create policy profiles_select_admin on public.profiles for select to authenticated
using ((select private.is_admin()));

create policy groups_select_employee on public.groups for select to authenticated
using ((select private.current_employee_id()) is not null);
create policy groups_select_admin on public.groups for select to authenticated
using ((select private.is_admin()));
create policy groups_insert_admin on public.groups for insert to authenticated
with check ((select private.is_admin()));
create policy groups_update_admin on public.groups for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy groups_delete_admin on public.groups for delete to authenticated
using ((select private.is_admin()));

create policy employees_select_own_active on public.employees for select to authenticated
using (user_id = (select auth.uid()) and active = true);
create policy employees_select_active_directory on public.employees for select to authenticated
using (active = true and (select private.current_role()) = 'employee' and (select private.current_employee_id()) is not null);
create policy employees_select_admin on public.employees for select to authenticated
using ((select private.is_admin()));
create policy employees_insert_admin on public.employees for insert to authenticated
with check ((select private.is_admin()));
create policy employees_update_admin on public.employees for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy employees_delete_admin on public.employees for delete to authenticated
using ((select private.is_admin()));

create policy shift_types_select_employee on public.shift_types for select to authenticated
using (
  (select private.current_employee_id()) is not null
  and exists (
    select 1
    from public.schedule_entries as entry
    join public.schedule_weeks as week on week.id = entry.schedule_week_id
    where entry.shift_type_id = shift_types.id and week.status = 'published'
  )
);
create policy shift_types_select_admin on public.shift_types for select to authenticated
using ((select private.is_admin()));
create policy shift_types_insert_admin on public.shift_types for insert to authenticated
with check ((select private.is_admin()));
create policy shift_types_update_admin on public.shift_types for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy shift_types_delete_admin on public.shift_types for delete to authenticated
using ((select private.is_admin()));

create policy registration_weeks_select_employee on public.registration_weeks for select to authenticated
using (
  status in ('open', 'locked')
  and (select private.current_role()) = 'employee'
  and (select private.current_employee_id()) is not null
);
create policy registration_weeks_select_admin on public.registration_weeks for select to authenticated
using ((select private.is_admin()));
create policy registration_weeks_insert_admin on public.registration_weeks for insert to authenticated
with check ((select private.is_admin()));
create policy registration_weeks_update_admin on public.registration_weeks for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy registration_weeks_delete_admin on public.registration_weeks for delete to authenticated
using ((select private.is_admin()));

create policy availability_submissions_select_own on public.availability_submissions for select to authenticated
using (employee_id = (select private.current_employee_id()));
create policy availability_submissions_insert_own_open on public.availability_submissions for insert to authenticated
with check (
  employee_id = (select private.current_employee_id())
  and (select private.registration_is_open(week_id))
);
create policy availability_submissions_update_own_open on public.availability_submissions for update to authenticated
using (employee_id = (select private.current_employee_id()))
with check (
  employee_id = (select private.current_employee_id())
  and (select private.registration_is_open(week_id))
);
create policy availability_submissions_select_admin on public.availability_submissions for select to authenticated
using ((select private.is_admin()));
create policy availability_submissions_insert_admin on public.availability_submissions for insert to authenticated
with check ((select private.is_admin()));
create policy availability_submissions_update_admin on public.availability_submissions for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy availability_submissions_delete_admin on public.availability_submissions for delete to authenticated
using ((select private.is_admin()));

create policy schedule_weeks_select_published_employee on public.schedule_weeks for select to authenticated
using (status = 'published' and (select private.current_employee_id()) is not null);
create policy schedule_weeks_select_admin on public.schedule_weeks for select to authenticated
using ((select private.is_admin()));
create policy schedule_weeks_insert_admin on public.schedule_weeks for insert to authenticated
with check ((select private.is_admin()));
create policy schedule_weeks_update_admin on public.schedule_weeks for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy schedule_weeks_delete_admin on public.schedule_weeks for delete to authenticated
using ((select private.is_admin()));

create policy schedule_entries_select_published_employee on public.schedule_entries for select to authenticated
using (
  (select private.current_employee_id()) is not null
  and exists (
    select 1 from public.schedule_weeks
    where id = schedule_week_id and status = 'published'
  )
);
create policy schedule_entries_select_admin on public.schedule_entries for select to authenticated
using ((select private.is_admin()));
create policy schedule_entries_insert_admin_draft on public.schedule_entries for insert to authenticated
with check ((select private.is_admin()) and (select private.schedule_is_draft(schedule_week_id)));
create policy schedule_entries_update_admin_draft on public.schedule_entries for update to authenticated
using ((select private.is_admin()) and (select private.schedule_is_draft(schedule_week_id)))
with check ((select private.is_admin()) and (select private.schedule_is_draft(schedule_week_id)));
create policy schedule_entries_delete_admin_draft on public.schedule_entries for delete to authenticated
using ((select private.is_admin()) and (select private.schedule_is_draft(schedule_week_id)));

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
  from public.employees as employee
  where employee.user_id = (select auth.uid()) and employee.active = true;
$$;

revoke all on function public.my_employee() from public, anon;
grant execute on function public.my_employee() to authenticated;

create or replace function public.clear_schedule_week(target_week_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;
  if not private.schedule_is_draft(target_week_id) then
    raise exception using errcode = '42501', message = 'SCHEDULE_NOT_DRAFT';
  end if;
  delete from public.schedule_entries where schedule_week_id = target_week_id;
  update public.schedule_weeks set count_overrides = '{}'::jsonb where id = target_week_id;
end;
$$;

revoke all on function public.clear_schedule_week(uuid) from public, anon;
grant execute on function public.clear_schedule_week(uuid) to authenticated;

create or replace function public.provision_employee_account(
  auth_user_id uuid,
  employee_name text
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

  insert into public.profiles (user_id, role, must_change_password)
  values (auth_user_id, 'employee', true);

  insert into public.employees (user_id, name)
  values (auth_user_id, btrim(employee_name))
  returning * into provisioned;

  return provisioned;
end;
$$;

revoke all on function public.provision_employee_account(uuid, text) from public, anon, authenticated;
grant execute on function public.provision_employee_account(uuid, text) to service_role;
