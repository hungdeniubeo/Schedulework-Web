# Username Authentication Design

## Goal

Replace user-facing email login with **username + password** for both Admin and Employee while preserving all existing application features, authorization rules, scheduling behavior, reset-password flow, password-change flow, RLS policies, groups, positions, shift types, and scheduler business rules.

The requested reset removes only existing test/runtime data. It must not drop application tables, functions, policies, features, or scheduler logic.

## Approved Username Rules

- Username is assigned by an Admin.
- Length: 3 to 32 characters.
- Allowed characters: ASCII letters and digits only.
- Validation regex: `^[A-Za-z0-9]{3,32}$`.
- Usernames are case-sensitive.
- `Hung01` and `hung01` are distinct accounts.
- Username is immutable after account creation in this change.

## Architecture

Supabase Auth continues to provide password hashing, session issuance, refresh tokens, and JWTs. The app does not replace Supabase Auth.

Because Supabase password sign-in natively accepts email or phone, each Auth user keeps an internal technical email that is never shown in the ScheduleWork UI. The public identity is `public.profiles.username`.

### Login flow

1. User enters `username` and `password` on `/login` or `/admin/login`.
2. Frontend calls a public Edge Function, `username-login`, with the exact username and password.
3. The Edge Function validates username syntax without changing case.
4. Using a service-role client, the function performs an exact case-sensitive lookup in `public.profiles` to resolve `user_id`.
5. The function loads that Auth user by ID and reads the internal Auth email.
6. Using a non-privileged Supabase client, the function calls `auth.signInWithPassword({ email, password })`.
7. On success, the function returns only `accessToken` and `refreshToken`.
8. The frontend installs the session with `getSupabase().auth.setSession(...)`.
9. Existing role checks, RLS, Admin/Employee routing, and session behavior continue unchanged.

All login failures return the same user-facing message: `Tên đăng nhập hoặc mật khẩu không đúng.` The API must not reveal whether a username exists.

### Internal Auth email

Account creation generates a random internal email independent of the username, for example using a UUID under an application-only domain. The email is not derived from username, so case-sensitive usernames remain safe even though email identity handling may normalize case.

The internal email is only an implementation detail of Supabase Auth. It is not displayed in setup, login forms, employee management, temporary credentials, or normal application UI.

## Database Changes

Add `username text` to `public.profiles` with these constraints:

- `not null` after the reset/bootstrap sequence is complete.
- unique with normal PostgreSQL text equality, preserving case-sensitive uniqueness.
- check constraint: `username ~ '^[A-Za-z0-9]{3,32}$'`.

Do not use `citext`, `lower(username)`, or any case-folding index.

Update `public.provision_employee_account` so provisioning receives and stores the username together with the employee profile. The function must continue to create the `employee` profile with `must_change_password = true` and create the employee row exactly as before.

Add a service-role-only `public.bootstrap_first_admin(auth_user_id, account_username)` RPC. It must serialize bootstrap attempts with a transaction advisory lock, refuse creation when an Admin profile already exists, validate the exact username, and insert the first Admin profile with `must_change_password = false`.

Existing RLS semantics remain unchanged. Authenticated users may continue selecting only the profile rows already allowed by the existing policies. No anonymous read policy is added for usernames; public auth/setup Edge Functions perform required lookups server-side.

## Edge Functions

### `username-login`

Create `supabase/functions/username-login/index.ts`.

Requirements:

- `verify_jwt = false`, because callers do not yet have a session.
- Accept POST only.
- Accept `{ username, password }`.
- Validate username as exact-case ASCII alphanumeric, 3-32 characters.
- Resolve the exact username server-side.
- Never return the internal Auth email.
- Authenticate password using a non-service-role Supabase Auth client.
- Return only the tokens needed by `auth.setSession`.
- Return one generic authentication error for unknown username and wrong password.
- Add cache prevention headers.

### `bootstrap-admin`

Add a dedicated one-time bootstrap Edge Function for creating the first Admin without requiring the operator to create or enter any email.

Requirements:

- `verify_jwt = false`, because no Admin exists yet.
- Accept GET for setup availability and POST for creation.
- POST accepts `{ username, password }` only.
- Validate username with the approved case-sensitive ASCII alphanumeric rule.
- Require the same 8-character minimum password length used by the app.
- Before creating anything, check server-side whether any `public.profiles` row with `role = 'admin'` already exists.
- Generate a random internal Auth email server-side; the caller never sends or receives an email.
- Create the Supabase Auth user with the supplied password and confirmed internal email.
- Call the atomic `bootstrap_first_admin` RPC to insert `public.profiles(user_id, username, role='admin', must_change_password=false)`.
- If profile creation fails after Auth user creation, delete the newly created Auth user so bootstrap is atomic from the application's perspective.
- If a concurrent request wins first, reject the later request with `SETUP_COMPLETE` and roll back its newly created Auth user.
- Never return the internal email or service-role details.
- Return only a success indicator; the frontend then sends the user to `/admin/login` to authenticate normally with username + password.
- Add cache prevention headers.

The endpoint is permanently locked as soon as an Admin profile exists. It is not a general Admin-registration API.

### `admin-users`

Preserve all existing actions and behavior. Change only the account identifier fields:

- `create-employee`: input becomes `{ name, username }` instead of `{ name, email }`.
- Validate username with `^[A-Za-z0-9]{3,32}$` without lowercasing.
- Reject exact duplicate username with a conflict response.
- Generate a random internal Auth email server-side.
- Create the Auth user with the temporary password and confirmed internal email.
- Provision `profiles.username` through the database provisioning function.
- Response returns `username` and `temporaryPassword`, never email.
- `reset-employee-password`: return the employee's username and temporary password, preserving the existing reset logic and `must_change_password` behavior.
- `delete-employee`: unchanged except no email-oriented response copy.
- `change-password`: unchanged.

If provisioning fails after Auth user creation, keep the existing rollback behavior that removes the newly created Auth user.

## Frontend Changes

### Login

`src/components/AuthLoginPage.tsx`:

- State: `email` -> `username`.
- Label: `Email` -> `Tên đăng nhập`.
- Input type: `email` -> `text`.
- `autoComplete`: use `username`.
- Preserve password input and submit behavior.
- Replace direct `signInWithPassword({ email, password })` with a helper that invokes `username-login` and installs the returned Supabase session.
- Error copy becomes `Tên đăng nhập hoặc mật khẩu không đúng.`

Both Admin and Employee routes continue using the same component, so both login modes change together.

### First Admin setup

Add a one-time setup route, `/setup`.

Behavior:

- Shows only `Tên đăng nhập` and `Mật khẩu`.
- Contains no email field, email wording, or password-confirmation field.
- Checks `bootstrap-admin` first; if an Admin already exists, display a simple setup-complete state with an action to `/admin/login`.
- Submits the exact username and password to `bootstrap-admin`.
- On success, redirects to `/admin/login` so the normal username login flow is tested immediately.
- If the setup availability check fails, do not expose the setup form until availability can be confirmed.
- The route is only for initial system bootstrap and must not become a permanent public sign-up screen.

### Employee management

`src/admin/EmployeeManager.tsx`:

- New employee form changes from Email to `Tên đăng nhập`.
- Preserve the separate employee display name field.
- Credentials card shows `Tên đăng nhập` + temporary password.
- Copy-to-clipboard text uses username.
- Primary action wording should describe account creation, e.g. `Tạo tài khoản`/`Thêm nhân viên`, with no email terminology.
- No email field remains in the normal account-management UI.
- All group, position, reorder, reset-password, delete, active-state, and employee settings behavior remains unchanged.

### Client server API

`src/lib/serverApi.ts`:

- `TemporaryCredentials.email` -> `TemporaryCredentials.username`.
- `createEmployeeAccount` input changes from `email` to `username`.
- Add username-login request helper that calls the new Edge Function and then sets the session through the existing Supabase client.
- Add `getAdminBootstrapAvailability()` and `bootstrapAdmin(username, password)` helpers that call `bootstrap-admin` and never accept email.
- Existing reset/delete/change-password API behavior remains otherwise unchanged.

## One-Time Data Reset

The reset must be an explicit, one-time operation and **must not be embedded in a normal schema migration that automatically destroys data on every environment**.

Reset existing runtime/test data only:

- Auth users
- `public.profiles`
- `public.employees`
- `public.availability_submissions`
- `public.schedule_entries`
- `public.schedule_weeks`
- `public.registration_weeks`

Keep schema and reusable configuration data, including:

- tables
- functions
- RLS policies
- groups
- positions
- shift types
- scheduler functionality
- all application features

The reset sequence must respect foreign keys. Existing Auth users may be deleted separately through supported Supabase Admin tooling when desired; the normal username UI never asks for or exposes their technical emails.

## Bootstrap Admin

After the reset there is no Admin account. Bootstrap is handled entirely through ScheduleWork instead of requiring manual email creation in Supabase Dashboard.

Bootstrap process:

1. Deploy the username-auth schema and `bootstrap-admin`/`username-login` Edge Functions.
2. Open `/setup`.
3. Enter only the chosen case-sensitive Admin username and password.
4. Frontend calls `bootstrap-admin`.
5. Backend verifies that no Admin exists, generates the hidden Auth email, creates the Auth user, and atomically writes the Admin profile.
6. Browser goes to `/admin/login`.
7. Sign in using the exact username + password.
8. Use the normal Admin UI to create Employee accounts by username.

Once the first Admin exists, subsequent calls to the bootstrap endpoint are blocked. The hidden email remains an implementation detail only and is never part of the operator workflow.

## Testing Requirements

Use TDD for the implementation.

Required coverage:

- username validation accepts letters/digits and preserves case.
- username validation rejects spaces, punctuation, fewer than 3, and more than 32 characters.
- `Hung01` and `hung01` remain distinguishable.
- login UI renders `Tên đăng nhập` and no email input.
- login client sends username and installs returned tokens with `auth.setSession`.
- `/setup` renders only username/password fields with no email or confirmation field.
- bootstrap API accepts username/password only and never returns email.
- bootstrap is rejected after an Admin profile already exists.
- concurrent bootstrap is serialized so only one Admin can be created.
- bootstrap rollback removes a newly created Auth user if Admin profile insertion fails.
- employee create form sends username, not email.
- temporary credentials display/copy username, not email.
- server API types and payloads use username.
- migration contains case-sensitive unique username constraint and validation check.
- provisioning stores username while preserving role and password-change behavior.
- `admin-users` rejects duplicate/invalid username and returns username credentials.
- reset-password returns username credentials.
- existing scheduler, employee, admin, and security tests remain green.

Before completion run:

- `npm test`
- `npm run build`
- Deno checks/tests used by the repository for Supabase functions
- database/security checks used by CI

## Non-Goals

This change does not:

- redesign the scheduler.
- alter shift rules or availability behavior.
- change Admin vs Employee permissions.
- remove password reset/change functionality.
- add general public account registration.
- add username self-service editing.
- migrate old accounts or preserve their historical schedule data.
- expose internal Auth emails in the user-facing UI.
