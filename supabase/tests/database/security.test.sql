begin;

select plan(27);

select is(
  (select count(*) from pg_class as relation join pg_namespace as namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'public' and relation.relname in ('profiles', 'groups', 'employees', 'shift_types', 'registration_weeks', 'availability_submissions', 'schedule_weeks', 'schedule_entries') and relation.relrowsecurity),
  8::bigint,
  'RLS is enabled on every exposed application table'
);

select is(
  (select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and table_name in ('profiles', 'groups', 'employees', 'shift_types', 'registration_weeks', 'availability_submissions', 'schedule_weeks', 'schedule_entries')),
  0::bigint,
  'anon has no direct table grants'
);

select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated clients cannot modify profiles'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'availability_submissions' and policyname in ('availability_submissions_insert_own_open', 'availability_submissions_update_own_open')),
  2::bigint,
  'employee availability writes have explicit open-week policies'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'availability_submissions' and policyname in ('availability_submissions_insert_admin', 'availability_submissions_update_admin')),
  2::bigint,
  'admin availability writes use separate policies'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'schedule_entries' and policyname = 'schedule_entries_select_published_employee'),
  1::bigint,
  'employees only receive the published schedule policy'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'employees' and policyname = 'employees_select_published_history'),
  1::bigint,
  'inactive employee metadata remains visible only for published history'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'schedule_entries' and policyname in ('schedule_entries_insert_admin_draft', 'schedule_entries_update_admin_draft', 'schedule_entries_delete_admin_draft')),
  3::bigint,
  'official schedule mutations require admin draft policies'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and roles @> array['anon'::name]),
  0::bigint,
  'no policy grants data access to anon'
);

select ok(
  private.is_valid_availability('{"version":1,"days":{"1":{"status":"off","periods":[],"start":null,"end":null},"2":{"status":"off","periods":[],"start":null,"end":null},"3":{"status":"off","periods":[],"start":null,"end":null},"4":{"status":"off","periods":[],"start":null,"end":null},"5":{"status":"off","periods":[],"start":null,"end":null},"6":{"status":"off","periods":[],"start":null,"end":null},"7":{"status":"off","periods":[],"start":null,"end":null}}}'::jsonb),
  'version 1 seven-day availability passes database validation'
);

select ok(
  has_function_privilege('authenticated', 'private.is_valid_availability(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.is_valid_availability(jsonb)', 'EXECUTE'),
  'only authenticated clients can execute availability validation during INSERT checks'
);

select ok(
  (
    select
      pg_get_expr(policy.polqual, policy.polrelid) like '%registration_is_open%'
      and pg_get_expr(policy.polwithcheck, policy.polrelid) like '%registration_is_open%'
    from pg_policy policy
    where policy.polname = 'availability_submissions_update_own_open'
  ),
  'employee availability updates require both original and target weeks to be open'
);

insert into auth.users (id)
values ('9a09b8d0-4903-4ceb-9a2d-71e7b55452e6');

insert into public.profiles (user_id, role, must_change_password)
values ('9a09b8d0-4903-4ceb-9a2d-71e7b55452e6', 'employee', false);

insert into public.employees (id, user_id, name)
values (
  '61ee3011-60e9-4694-bc4c-d6762e4f936d',
  '9a09b8d0-4903-4ceb-9a2d-71e7b55452e6',
  'Security test employee'
);

insert into public.registration_weeks (id, week_start, lock_at, status)
values
  ('91487e63-4a66-421f-8253-df34efcba0df', '2099-01-05', '2099-01-02T15:00:00Z', 'open'),
  ('ed243cdd-6145-487d-984e-82a41b6305ed', '2099-01-12', '2099-01-09T15:00:00Z', 'open'),
  ('4f81bbf8-d5ee-4c8f-86ed-2867f20b24b4', '2099-01-19', '2099-01-16T15:00:00Z', 'locked');

insert into public.availability_submissions (id, week_id, employee_id, availability, note)
values (
  'a2451242-0421-4f9b-8a27-31bcbf8e9d8a',
  '4f81bbf8-d5ee-4c8f-86ed-2867f20b24b4',
  '61ee3011-60e9-4694-bc4c-d6762e4f936d',
  '{"version":1,"days":{"1":{"status":"off","periods":[],"start":null,"end":null},"2":{"status":"off","periods":[],"start":null,"end":null},"3":{"status":"off","periods":[],"start":null,"end":null},"4":{"status":"off","periods":[],"start":null,"end":null},"5":{"status":"off","periods":[],"start":null,"end":null},"6":{"status":"off","periods":[],"start":null,"end":null},"7":{"status":"off","periods":[],"start":null,"end":null}}}'::jsonb,
  'locked-week submission'
);

select set_config('request.jwt.claim.sub', '9a09b8d0-4903-4ceb-9a2d-71e7b55452e6', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    insert into public.availability_submissions (week_id, employee_id, availability, note)
    values (
      '91487e63-4a66-421f-8253-df34efcba0df',
      '61ee3011-60e9-4694-bc4c-d6762e4f936d',
      '{"version":1,"days":{"1":{"status":"off","periods":[],"start":null,"end":null},"2":{"status":"off","periods":[],"start":null,"end":null},"3":{"status":"off","periods":[],"start":null,"end":null},"4":{"status":"off","periods":[],"start":null,"end":null},"5":{"status":"off","periods":[],"start":null,"end":null},"6":{"status":"off","periods":[],"start":null,"end":null},"7":{"status":"off","periods":[],"start":null,"end":null}}}'::jsonb,
      null
    )
  $$,
  'employee can insert valid availability into an open registration week'
);

update public.availability_submissions
set week_id = 'ed243cdd-6145-487d-984e-82a41b6305ed'
where id = 'a2451242-0421-4f9b-8a27-31bcbf8e9d8a';

reset role;

select is(
  (select week_id from public.availability_submissions where id = 'a2451242-0421-4f9b-8a27-31bcbf8e9d8a'),
  '4f81bbf8-d5ee-4c8f-86ed-2867f20b24b4'::uuid,
  'employee cannot move a locked-week submission into an open week'
);

select ok(
  (select relation.relrowsecurity
   from pg_class as relation
   join pg_namespace as namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public' and relation.relname = 'positions'),
  'RLS enabled on positions'
);

select ok(
  not has_table_privilege('anon', 'public.positions', 'SELECT')
    and not has_table_privilege('anon', 'public.positions', 'INSERT')
    and not has_table_privilege('anon', 'public.positions', 'UPDATE')
    and not has_table_privilege('anon', 'public.positions', 'DELETE'),
  'anon has no direct position grants'
);

select ok(
  has_table_privilege('authenticated', 'public.positions', 'SELECT')
    and has_table_privilege('authenticated', 'public.positions', 'INSERT')
    and has_table_privilege('authenticated', 'public.positions', 'UPDATE')
    and has_table_privilege('authenticated', 'public.positions', 'DELETE'),
  'authenticated position grants are explicitly gated by RLS'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'public'
     and tablename = 'positions'
     and policyname in (
       'positions_select_admin',
       'positions_insert_admin',
       'positions_update_admin',
       'positions_delete_admin'
     )),
  4::bigint,
  'position writes and admin reads use admin policies'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'public'
     and tablename = 'positions'
     and policyname = 'positions_select_employee_schedule'),
  1::bigint,
  'employees receive one read-only position policy'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'position_id'
      and is_nullable = 'YES'
  ),
  'employees have a nullable position reference'
);

select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public'
     and table_name = 'employees'
     and column_name in (
       'role_label',
       'is_head_chef',
       'is_executive_chef',
       'is_manager'
     )),
  0::bigint,
  'legacy display-role columns are removed after backfill'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.swap_position_sort_orders(uuid, uuid)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.swap_position_sort_orders(uuid, uuid)',
      'EXECUTE'
    ),
  'only authenticated users may call the RLS-checked position reorder function'
);

insert into auth.users (id)
values ('2ba42d24-1634-4b73-8c45-d50ef87a6182');

insert into public.profiles (user_id, role, must_change_password)
values ('2ba42d24-1634-4b73-8c45-d50ef87a6182', 'admin', false);

insert into public.positions (id, name, sort_order)
values
  ('d2dab8eb-1c02-4e89-99b9-73cc55cf1fa4', 'Bếp trưởng', 0),
  ('e5be9ad0-c88b-4e21-9137-2ad6f39a6c95', 'Phụ bếp', 1);

update public.employees
set position_id = 'd2dab8eb-1c02-4e89-99b9-73cc55cf1fa4'
where id = '61ee3011-60e9-4694-bc4c-d6762e4f936d';

select set_config(
  'request.jwt.claim.sub',
  '9a09b8d0-4903-4ceb-9a2d-71e7b55452e6',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select results_eq(
  $$
    select employee.name, position.name
    from public.employees as employee
    join public.positions as position on position.id = employee.position_id
    where employee.id = '61ee3011-60e9-4694-bc4c-d6762e4f936d'
  $$,
  $$ values ('Security test employee'::text, 'Bếp trưởng'::text) $$,
  'employee can read the assigned position through the employee relation'
);

select is(
  (select count(*) from public.positions),
  1::bigint,
  'employee cannot read an unassigned position'
);

update public.positions
set name = 'Không được phép'
where id = 'd2dab8eb-1c02-4e89-99b9-73cc55cf1fa4';

select public.swap_position_sort_orders(
  'd2dab8eb-1c02-4e89-99b9-73cc55cf1fa4',
  'e5be9ad0-c88b-4e21-9137-2ad6f39a6c95'
);

reset role;

select results_eq(
  $$
    select name, sort_order
    from public.positions
    order by sort_order
  $$,
  $$ values ('Bếp trưởng'::text, 0), ('Phụ bếp'::text, 1) $$,
  'employee cannot edit or reorder positions'
);

select set_config(
  'request.jwt.claim.sub',
  '2ba42d24-1634-4b73-8c45-d50ef87a6182',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.swap_position_sort_orders(
  'd2dab8eb-1c02-4e89-99b9-73cc55cf1fa4',
  'e5be9ad0-c88b-4e21-9137-2ad6f39a6c95'
);

reset role;

select results_eq(
  $$
    select name, sort_order
    from public.positions
    order by sort_order
  $$,
  $$ values ('Phụ bếp'::text, 0), ('Bếp trưởng'::text, 1) $$,
  'admin can reorder positions atomically'
);

select throws_ok(
  $$
    delete from public.positions
    where id = 'd2dab8eb-1c02-4e89-99b9-73cc55cf1fa4'
  $$,
  '23503',
  'update or delete on table "positions" violates foreign key constraint "employees_position_id_fkey" on table "employees"',
  'an assigned position cannot be deleted'
);

select * from finish();
rollback;
