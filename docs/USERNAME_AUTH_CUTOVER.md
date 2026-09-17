# Username Authentication Cutover

This cutover changes the user-facing login identity from email to username. It deliberately resets only existing runtime/test data. It does **not** drop tables, functions, policies, groups, positions, shift types, or scheduler features.

## 1. Deploy the schema and Edge Functions

From an up-to-date checkout of the username-auth branch:

```bash
npx supabase db push
npx supabase functions deploy admin-users
npx supabase functions deploy username-login --no-verify-jwt
npx supabase functions deploy bootstrap-admin --no-verify-jwt
```

The frontend should not be promoted to production until the bootstrap flow has been tested successfully.

## 2. Reset existing runtime data

Run this once in Supabase SQL Editor when the old test data is no longer needed:

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

Old Supabase Auth users may also be deleted from **Authentication → Users** when they are no longer needed. No Auth user needs to be created manually for the new bootstrap flow.

## 3. Bootstrap the first Admin

Open the frontend Preview URL at:

```text
/setup
```

Enter only:

- **Tên đăng nhập**
- **Mật khẩu**

Then press **Tạo tài khoản Admin**.

The backend generates the hidden Supabase Auth identity automatically, creates the Admin profile, and redirects to `/admin/login`. No email, Auth UUID, or manual profile insert is required.

Username rules:

- 3-32 characters
- ASCII letters and digits only
- case-sensitive
- `Admin01` and `admin01` are different usernames

After the first Admin exists, `/setup` is locked and cannot create another Admin.

## 4. Validate username constraints

After old profiles are gone and the first Admin has been created:

```sql
alter table public.profiles
  validate constraint profiles_username_required_for_new_rows;

alter table public.profiles
  validate constraint profiles_username_format;
```

## 5. Validate the application

1. Open `/admin/login` and sign in with the exact Admin username and password created at `/setup`.
2. Open **Nhân viên**.
3. Create an employee using **Họ và tên + Tên đăng nhập**.
4. Confirm the one-time credentials card contains **Tên đăng nhập + Mật khẩu tạm**, not email.
5. Sign out and verify the employee can sign in at `/login` with username + temporary password.
6. Complete the existing forced password-change flow.
7. Verify username case sensitivity, for example `Hung01` must not be interchangeable with `hung01`.
8. Confirm Admin password reset, employee deletion, registration, scheduling, publishing, and team schedule still behave as before.

Only after this Preview test passes should the username-auth branch be merged to `main` for the normal Vercel Production deployment.
