# Username Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all user-facing email login/account provisioning with case-sensitive alphanumeric usernames for Admin and Employee, while preserving Supabase Auth sessions, RLS, scheduler behavior, and every non-auth feature.

**Architecture:** Keep Supabase Auth as the password/session/JWT provider. Store the public username in `public.profiles.username`; Auth users receive a random internal email that is never exposed in the ScheduleWork UI. A public `username-login` Edge Function resolves the exact username with the service role, authenticates the password through a non-privileged Supabase client, and returns access/refresh tokens for the frontend to install with `setSession`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase JS 2.116, Supabase Edge Functions/Deno, PostgreSQL migrations.

**Spec:** `docs/superpowers/specs/2026-09-17-username-auth-design.md`

## Global Constraints

- Admin and Employee both log in with username + password.
- Username is Admin-assigned, immutable in this change, case-sensitive, 3-32 chars, ASCII letters/digits only: `^[A-Za-z0-9]{3,32}$`.
- `Hung01` and `hung01` must remain distinct usernames.
- Email must disappear from user-facing login/account-management UI.
- Supabase Auth remains responsible for password hashing, sessions, refresh tokens, and JWTs.
- Do not change scheduler rules, RLS semantics, groups, positions, shift types, reset-password behavior, change-password behavior, delete-employee behavior, or routing beyond the login transport.
- Existing runtime/test data is reset separately; migrations must not contain destructive wipes of production data.

---

### Task 1: Enable CI for the feature branch

**Files:**
- Modify: `.github/workflows/port-scheduler-ci.yml`

**Interfaces:**
- Consumes: existing GitHub Actions test/build workflow.
- Produces: pushes to `feat/username-auth` run the same full test/build/Deno checks as the scheduler feature branch.

- [ ] **Step 1: Add `feat/username-auth` to the existing `on.push.branches` list.**

Expected YAML:

```yaml
on:
  push:
    branches:
      - feat/port-schedulework-scheduler
      - feat/username-auth
```

- [ ] **Step 2: Push only this workflow change and verify a workflow run is created.**

Expected: current suite passes before username behavior changes.

---

### Task 2: Add username primitives and database schema

**Files:**
- Create: `supabase/functions/_shared/username.ts`
- Create: `supabase/functions/_shared/username_test.ts`
- Create: `supabase/migrations/202609170002_username_auth.sql`
- Create: `src/auth/UsernameAuthMigration.test.ts`

**Interfaces:**
- Produces: `isValidUsername(username: string): boolean`, `createInternalAuthEmail(): string`, `public.profiles.username`, updated `public.provision_employee_account(auth_user_id uuid, employee_name text, account_username text)`.

- [ ] **Step 1: Write failing Deno tests for username validation and internal email generation.**

Test cases:

```ts
Deno.test("username accepts case-sensitive ASCII letters and digits", () => {
  assertEquals(isValidUsername("Hung01"), true);
  assertEquals(isValidUsername("hung01"), true);
});

Deno.test("username rejects punctuation, spaces, and invalid lengths", () => {
  for (const value of ["ab", "A".repeat(33), "hung_01", "hung.01", "hung 01", "Hùng01"]) {
    assertEquals(isValidUsername(value), false);
  }
});

Deno.test("internal auth email is opaque and valid-shaped", () => {
  const email = createInternalAuthEmail();
  assertMatch(email, /^auth-[0-9a-f-]+@schedulework\.invalid$/);
});
```

- [ ] **Step 2: Add a failing migration source test.**

Assertions must require the migration to contain:

```text
add column if not exists username text
^[A-Za-z0-9]{3,32}$
unique
provision_employee_account(
account_username text
```

and must assert the migration does **not** contain destructive `delete from auth.users` or `truncate` statements.

- [ ] **Step 3: Implement `_shared/username.ts`.**

Required implementation shape:

```ts
const USERNAME_PATTERN = /^[A-Za-z0-9]{3,32}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export function createInternalAuthEmail(): string {
  return `auth-${crypto.randomUUID()}@schedulework.invalid`;
}
```

- [ ] **Step 4: Add migration `202609170002_username_auth.sql`.**

The migration must:

```sql
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
```

Replace `public.provision_employee_account` with a 3-argument version that validates the exact username, inserts `(user_id, username, role, must_change_password)`, creates the employee row, and remains executable only by `service_role`. Drop/revoke the old 2-argument overload so new provisioning cannot bypass username assignment.

- [ ] **Step 5: Run Deno shared tests and frontend migration test; verify GREEN.**

Commands:

```bash
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts
npm test -- src/auth/UsernameAuthMigration.test.ts
```

---

### Task 3: Add public username login Edge Function

**Files:**
- Create: `supabase/functions/username-login/index.ts`
- Create: `supabase/functions/username-login/index_test.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: `profiles.username`, Supabase service-role lookup, internal Auth email, Supabase password sign-in.
- Produces: unauthenticated POST `/functions/v1/username-login` with `{ username, password }`, success `{ accessToken, refreshToken }`, generic auth failure `{ code: "INVALID_CREDENTIALS" }`.

- [ ] **Step 1: Write failing tests around request validation and error normalization by extracting pure helpers from the function module.**

Required behaviors:
- invalid username syntax -> HTTP 400 / `INVALID_USERNAME`
- missing password -> HTTP 400 / `INVALID_REQUEST`
- missing profile, missing internal Auth email, or bad password -> same HTTP 401 / `INVALID_CREDENTIALS`
- exact username string is passed to lookup without lowercasing or uppercasing.

- [ ] **Step 2: Configure the function as public.**

Add:

```toml
[functions.username-login]
verify_jwt = false
```

Keep `[functions.admin-users] verify_jwt = true` unchanged.

- [ ] **Step 3: Implement the Edge Function.**

Algorithm:
1. Accept only `POST`/`OPTIONS`.
2. Validate username with `isValidUsername` and password as a non-empty bounded string.
3. Create service-role client with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
4. Query `profiles` with exact `.eq("username", username).maybeSingle()`.
5. `admin.auth.admin.getUserById(user_id)` and read its internal email.
6. Create non-privileged client with `SUPABASE_URL` + `SUPABASE_ANON_KEY`.
7. Call `auth.signInWithPassword({ email, password })`.
8. Return only `accessToken` and `refreshToken`; never return email or user existence details.
9. Use the same `INVALID_CREDENTIALS` response for lookup/auth failures.

- [ ] **Step 4: Run Deno tests/typecheck and verify GREEN.**

```bash
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/username-login/index_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/username-login/index.ts
```

---

### Task 4: Convert employee provisioning/reset APIs from email to username

**Files:**
- Modify: `supabase/functions/admin-users/index.ts`
- Modify: `src/lib/serverApi.ts`
- Modify: `src/lib/serverApi.test.ts`

**Interfaces:**
- `TemporaryCredentials = { username: string; temporaryPassword: string }`
- `createEmployeeAccount({ name, username, accessToken })`
- reset password returns username, not email.

- [ ] **Step 1: Update `src/lib/serverApi.test.ts` first so it expects `username` in create payload/results and no user-facing `email` field. Verify RED.**

- [ ] **Step 2: Update `admin-users` employee creation.**

Required behavior:
- input field `username`
- validate using `isValidUsername`
- generate `internalEmail = createInternalAuthEmail()`
- create Auth user with internal email + temporary password + `email_confirm: true`
- call `provision_employee_account` with `auth_user_id`, `employee_name`, `account_username`
- map unique username conflict to HTTP 409 `USERNAME_EXISTS`
- delete the just-created Auth user if provisioning fails
- return `{ employee, username, temporaryPassword }`

- [ ] **Step 3: Update reset-password behavior.**

Load `profiles.username` by user ID and return:

```ts
{ username, temporaryPassword }
```

Keep `must_change_password` rollback and password update logic unchanged.

- [ ] **Step 4: Update `src/lib/serverApi.ts` types/payloads.**

- [ ] **Step 5: Run `serverApi` tests and Deno typecheck; verify GREEN.**

```bash
npm test -- src/lib/serverApi.test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts
```

---

### Task 5: Convert login and employee-management UI to username

**Files:**
- Create: `src/components/AuthLoginPage.test.tsx`
- Modify: `src/components/AuthLoginPage.tsx`
- Modify: `src/admin/EmployeeManager.test.tsx`
- Modify: `src/admin/EmployeeManager.tsx`
- Modify: call site(s) that provide `EmployeeManager.onAdd`

**Interfaces:**
- Login form displays `Tên đăng nhập`, not `Email`.
- Employee creation displays `Tên đăng nhập` and validates `^[A-Za-z0-9]{3,32}$`.
- Credentials card displays username + temporary password.

- [ ] **Step 1: Write failing login UI test.**

Assert static/source output contains:

```text
Tên đăng nhập
Tên đăng nhập hoặc mật khẩu không đúng.
```

and does not contain the login label `Email` or `type="email"`.

- [ ] **Step 2: Write failing EmployeeManager assertions.**

Require:
- credentials text `Tên đăng nhập`
- creation input `name="username"` or equivalent username state
- `minLength={3}`, `maxLength={32}`, `pattern="[A-Za-z0-9]+"`
- no user-facing `Email` label.

- [ ] **Step 3: Add frontend username login transport.**

In `src/lib/serverApi.ts` add:

```ts
export async function signInWithUsername(username: string, password: string): Promise<void>
```

It POSTs to `/functions/v1/username-login` with the publishable key, receives `accessToken`/`refreshToken`, then calls:

```ts
getSupabase().auth.setSession({
  access_token: accessToken,
  refresh_token: refreshToken,
});
```

Map any login failure to `Tên đăng nhập hoặc mật khẩu không đúng.` in the UI.

- [ ] **Step 4: Update `AuthLoginPage.tsx`.**

Use username state, `type="text"`, `autoComplete="username"`, `minLength={3}`, `maxLength={32}`, `pattern="[A-Za-z0-9]+"`, and preserve exact case.

- [ ] **Step 5: Update EmployeeManager + onAdd call chain.**

Rename email state/props to username, preserve name field, and leave all group/position/reset/delete behavior untouched.

- [ ] **Step 6: Run focused frontend tests and build; verify GREEN.**

```bash
npm test -- src/components/AuthLoginPage.test.tsx src/admin/EmployeeManager.test.tsx src/lib/serverApi.test.ts
npm run build
```

---

### Task 6: Document the one-time data reset and bootstrap Admin procedure

**Files:**
- Create: `docs/USERNAME_AUTH_CUTOVER.md`

**Interfaces:**
- Produces an operator-safe cutover procedure; does not embed destructive reset in normal migrations.

- [ ] **Step 1: Document deployment order.**

Required order:
1. Deploy schema migration and Edge Functions.
2. Confirm code branch tests/build are green.
3. In Supabase SQL Editor delete runtime rows only from schedule/registration/employee/profile tables in dependency-safe order; do not drop tables/functions/policies.
4. In Supabase Authentication UI delete all old Auth users.
5. Create one technical Auth user for the initial Admin using a random internal email and chosen password.
6. Insert `public.profiles(user_id, username, role, must_change_password)` for that Auth user with role `admin` and the chosen case-sensitive username.
7. Validate the username-required constraint after old profiles are gone.
8. Deploy frontend.
9. Sign in at `/admin/login` with username + password and create employees from the Admin UI.

- [ ] **Step 2: Include exact reset SQL that deletes data only, not schema.**

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

Do not delete `groups`, `positions`, or `shift_types`.

- [ ] **Step 3: Include exact Admin profile SQL using a copied Auth user UUID.**

```sql
insert into public.profiles (user_id, username, role, must_change_password)
values ('AUTH_USER_UUID', 'Admin01', 'admin', false);
```

- [ ] **Step 4: Include validation SQL.**

```sql
alter table public.profiles
  validate constraint profiles_username_required_for_new_rows;

alter table public.profiles
  validate constraint profiles_username_format;
```

---

### Task 7: Full regression verification

**Files:**
- Review all changed files only; no unrelated refactor.

**Interfaces:**
- Produces evidence that auth changed without scheduler/business-rule regression.

- [ ] **Step 1: Run full frontend suite.**

```bash
npm test
```

Expected: zero failures.

- [ ] **Step 2: Run build.**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 3: Run Deno shared tests and both Edge Function typechecks.**

```bash
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/username-login/index.ts
```

- [ ] **Step 4: Run diff whitespace check.**

```bash
git diff --check origin/main...HEAD
```

- [ ] **Step 5: Review the final diff against the spec.**

Confirm there are no changes to scheduler behavior, RLS semantics, group/position/shift logic, or unrelated UI.
