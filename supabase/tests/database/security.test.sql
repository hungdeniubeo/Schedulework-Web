begin;

select plan(11);

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

select * from finish();
rollback;
