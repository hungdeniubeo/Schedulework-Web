# Bootstrap Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-time internal `/setup` flow that creates the first Admin using only username + password, while keeping technical Supabase Auth email generation fully hidden.

**Architecture:** A public `bootstrap-admin` Edge Function accepts username/password only. It creates a hidden Auth user, then calls a service-role-only SQL RPC that serializes bootstrap with a transaction advisory lock, refuses creation when any Admin already exists, and inserts the Admin profile; any failed profile/bootstrap attempt rolls the Auth user back. The frontend exposes `/setup`, checks bootstrap availability, submits exactly username/password, and redirects to `/admin/login` after success.

**Tech Stack:** React 19, TypeScript, Vite, Supabase Auth/Postgres/Edge Functions, Vitest, Deno.

**Spec:** `docs/superpowers/specs/2026-09-17-username-auth-design.md`

## Global Constraints

- Setup UI accepts only username and password; no email and no password-confirm field.
- Username remains `^[A-Za-z0-9]{3,32}$` and is case-sensitive.
- The technical Auth email is generated server-side only and is never returned or shown.
- Bootstrap is available only while no `profiles.role = 'admin'` row exists.
- Concurrent bootstrap requests must not create multiple Admins.
- Existing Admin/Employee login, roles, RLS, scheduler, groups, positions, shifts, reset password, and password-change behavior stay unchanged.
- No service-role secret is exposed to the frontend.

---

### Task 1: Atomic first-Admin database bootstrap

**Files:**
- Create: `supabase/migrations/202609170003_bootstrap_first_admin.sql`
- Create: `src/auth/BootstrapAdminMigration.test.ts`

**Interfaces:**
- Produces RPC `public.bootstrap_first_admin(auth_user_id uuid, account_username text)` callable only by `service_role`.
- RPC inserts `public.profiles(user_id, username, role='admin', must_change_password=false)` only when no Admin exists.

- [ ] **Step 1: Write the failing migration test**

Assert the migration contains: exact username validation, `pg_advisory_xact_lock`, an existing-Admin guard, Admin profile insert, and service-role-only execution grant.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/auth/BootstrapAdminMigration.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the migration**

Create a security-definer SQL function that:

```sql
perform pg_advisory_xact_lock(hashtext('schedulework-bootstrap-first-admin'));

if exists (select 1 from public.profiles where role = 'admin') then
  raise exception using errcode = 'P0001', message = 'ADMIN_ALREADY_EXISTS';
end if;

if not exists (select 1 from auth.users where id = auth_user_id) then
  raise exception using errcode = '23503', message = 'AUTH_USER_NOT_FOUND';
end if;

if account_username is null or account_username !~ '^[A-Za-z0-9]{3,32}$' then
  raise exception using errcode = '22023', message = 'INVALID_USERNAME';
end if;

insert into public.profiles (user_id, username, role, must_change_password)
values (auth_user_id, account_username, 'admin', false);
```

Revoke from `public`, `anon`, `authenticated`; grant only to `service_role`.

- [ ] **Step 4: Run the migration test and verify GREEN**

Run: `npm test -- src/auth/BootstrapAdminMigration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609170003_bootstrap_first_admin.sql src/auth/BootstrapAdminMigration.test.ts
git commit -m "feat: add atomic admin bootstrap rpc"
```

---

### Task 2: Public bootstrap Edge Function

**Files:**
- Create: `supabase/functions/bootstrap-admin/logic.ts`
- Create: `supabase/functions/bootstrap-admin/logic_test.ts`
- Create: `supabase/functions/bootstrap-admin/index.ts`
- Modify: `supabase/config.toml`
- Modify: `.github/workflows/port-scheduler-ci.yml`

**Interfaces:**
- `GET /functions/v1/bootstrap-admin` returns `{ available: boolean }`.
- `POST /functions/v1/bootstrap-admin` consumes `{ username: string, password: string }` and returns `{ created: true }`.
- Does not return Auth email, user UUID, access token, or service-role details.

- [ ] **Step 1: Write failing Deno logic tests**

Cover username validation, password minimum length of 8 characters, `ADMIN_ALREADY_EXISTS` mapping, duplicate username mapping, and rollback-required outcomes.

- [ ] **Step 2: Run the focused Deno test and verify RED**

Run:

```bash
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/bootstrap-admin/logic_test.ts
```

Expected: FAIL because bootstrap logic does not exist.

- [ ] **Step 3: Implement minimal Edge Function**

GET uses a service-role query equivalent to:

```ts
admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "admin")
```

POST:

```ts
const username = requireUsername(body.username);
const password = requirePassword(body.password);
const internalEmail = createInternalAuthEmail();
const created = await admin.auth.admin.createUser({
  email: internalEmail,
  password,
  email_confirm: true,
});
```

Then call:

```ts
admin.rpc("bootstrap_first_admin", {
  auth_user_id: created.data.user.id,
  account_username: username,
});
```

If RPC fails, delete the newly created Auth user before returning an error. Map an already-existing Admin to HTTP 409 with code `SETUP_COMPLETE`. Never include the internal email in any response.

- [ ] **Step 4: Configure it as public-before-login**

Add:

```toml
[functions.bootstrap-admin]
verify_jwt = false
```

Add Deno test/typecheck steps for the new function to CI.

- [ ] **Step 5: Run Deno tests/typechecks and verify GREEN**

Run:

```bash
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/bootstrap-admin/logic_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/bootstrap-admin/index.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/bootstrap-admin supabase/config.toml .github/workflows/port-scheduler-ci.yml
git commit -m "feat: add one-time admin bootstrap endpoint"
```

---

### Task 3: Client bootstrap API

**Files:**
- Modify: `src/lib/serverApi.ts`
- Modify: `src/lib/serverApi.test.ts`

**Interfaces:**
- Produces `getAdminBootstrapAvailability(): Promise<boolean>`.
- Produces `bootstrapAdmin(username: string, password: string): Promise<void>`.

- [ ] **Step 1: Write failing client API tests**

Test GET calls `/functions/v1/bootstrap-admin` with `apikey`; POST sends exactly:

```json
{"username":"Admin01","password":"Password123"}
```

and no email field.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/serverApi.test.ts`

Expected: FAIL because the bootstrap helpers are missing.

- [ ] **Step 3: Implement the helpers**

Reuse `getPublicSupabaseConfig()`, JSON parsing, `ServerApiError`, and network error behavior already used by username login. POST success requires HTTP success plus `{ created: true }`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/serverApi.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/serverApi.ts src/lib/serverApi.test.ts
git commit -m "feat: add admin bootstrap client api"
```

---

### Task 4: `/setup` route and minimal setup page

**Files:**
- Create: `src/components/AdminSetupPage.tsx`
- Create: `src/components/AdminSetupPage.test.tsx`
- Modify: `src/app/router.ts`
- Modify: `src/app/router.test.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- `/setup` maps to `{ name: "setup" }`.
- `AdminSetupPage` receives `navigate(path: string): void`.

- [ ] **Step 1: Write failing route/UI tests**

Assert `/setup` resolves to `setup`. Render the setup page and assert it contains exactly one username field and one password field, no email label/input, no confirm-password field.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- src/app/router.test.ts src/components/AdminSetupPage.test.tsx
```

Expected: FAIL because setup route/page do not exist.

- [ ] **Step 3: Implement the minimal setup page**

On mount call `getAdminBootstrapAvailability()`.

States:
- loading: `Đang kiểm tra thiết lập...`
- unavailable: show `Hệ thống đã được thiết lập.` and button to `/admin/login`
- available: show only `Tên đăng nhập`, `Mật khẩu`, and button `Tạo tài khoản Admin`

Submit calls `bootstrapAdmin(username, password)`. On success navigate to `/admin/login`. Do not automatically log in; this keeps setup and login responsibilities separate and lets the normal username login path be tested immediately.

- [ ] **Step 4: Wire `/setup` into `App.tsx`**

Lazy-load `AdminSetupPage` and render it before Employee/Admin route handling.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/app/router.test.ts src/components/AdminSetupPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminSetupPage.tsx src/components/AdminSetupPage.test.tsx src/app/router.ts src/app/router.test.ts src/app/App.tsx
git commit -m "feat: add first admin setup page"
```

---

### Task 5: Cutover docs and complete verification

**Files:**
- Modify: `docs/USERNAME_AUTH_CUTOVER.md`
- Modify: `docs/superpowers/specs/2026-09-17-username-auth-design.md` only if wording still mentions manual Auth-user creation.

**Interfaces:**
- Operational setup becomes: deploy schema/functions -> open `/setup` -> create Admin with username/password -> log in via `/admin/login`.

- [ ] **Step 1: Remove manual email/Auth-user bootstrap instructions**

Document deployment commands:

```bash
npx supabase db push
npx supabase functions deploy admin-users
npx supabase functions deploy username-login --no-verify-jwt
npx supabase functions deploy bootstrap-admin --no-verify-jwt
```

Document `/setup` as the only first-Admin bootstrap path.

- [ ] **Step 2: Run complete frontend verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 3: Run complete Deno verification**

Run:

```bash
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/username-login/logic_test.ts
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/bootstrap-admin/logic_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/username-login/index.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/bootstrap-admin/index.ts
```

Expected: all pass.

- [ ] **Step 4: Run whitespace check**

Run:

```bash
git diff --check origin/main...HEAD
```

Expected: no output.

- [ ] **Step 5: Commit docs**

```bash
git add docs/USERNAME_AUTH_CUTOVER.md docs/superpowers/specs/2026-09-17-username-auth-design.md
git commit -m "docs: simplify first admin setup"
```
