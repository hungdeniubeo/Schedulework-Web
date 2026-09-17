# Username Authentication Cutover

This cutover changes the user-facing login identity from email to username. It deliberately resets only existing runtime/test data. It does **not** drop tables, functions, policies, groups, positions, shift types, or scheduler features.

## 1. Deploy the schema and Edge Functions

From an up-to-date checkout of the branch containing the username-auth changes:

```bash
npx supabase db push
npx supabase functions deploy admin-users
npx supabase functions deploy username-login --no-verify-jwt
```

The frontend should not be promoted to production until the reset/bootstrap steps below are complete.

## 2. Reset existing runtime data

Run this once in Supabase SQL Editor:

```sql
begin;

delete from public.schedule_entries;
delete from public.schedule_weeks;
delete from public.availability_submissions;
delete from public.registration_weeks;
delete from public.employees;
delete from public.profiles;

commit;
```

This intentionally keeps:

- `public.groups`
- `public.positions`
- `public.shift_types`
- database functions and triggers
- RLS policies
- scheduler/business-rule schema

Do not add this reset SQL to a normal migration.

## 3. Delete old Auth users

In Supabase Dashboard:

1. Open **Authentication → Users**.
2. Delete all old Admin/Employee Auth users.

The public runtime rows were already removed in step 2, so this only cleans up the old Auth identities.

## 4. Bootstrap the first Admin

There is intentionally no public Admin sign-up flow.

1. In **Authentication → Users**, create one Auth user.
2. Use a random technical email, for example `auth-<random-uuid>@schedulework.invalid`.
3. Choose the Admin password and enable/confirm the user immediately.
4. Copy the new Auth user's UUID.
5. Run the following SQL, replacing the UUID and username:

```sql
insert into public.profiles (
  user_id,
  username,
  role,
  must_change_password
)
values (
  'AUTH_USER_UUID',
  'Admin01',
  'admin',
  false
);
```

Username rules:

- 3-32 characters
- ASCII letters and digits only
- case-sensitive
- `Admin01` and `admin01` are different usernames

The technical Auth email is never shown in the ScheduleWork login/account UI.

## 5. Validate username constraints

After old profiles are gone and the Admin profile has been created:

```sql
alter table public.profiles
  validate constraint profiles_username_required_for_new_rows;

alter table public.profiles
  validate constraint profiles_username_format;
```

## 6. Deploy the frontend

After the migration/functions/reset/bootstrap steps have completed, deploy the frontend commit containing username login.

Validate manually:

1. Open `/admin/login`.
2. Sign in with the exact Admin username and password.
3. Open **Nhân viên**.
4. Create an employee using **Họ và tên + Tên đăng nhập**.
5. Confirm the one-time credentials card contains **Tên đăng nhập + Mật khẩu tạm**, not email.
6. Sign out and verify the employee can sign in at `/login` with username + temporary password.
7. Complete the existing forced password-change flow.
8. Confirm Admin password reset, employee deletion, registration, scheduling, publishing, and team schedule still behave as before.
