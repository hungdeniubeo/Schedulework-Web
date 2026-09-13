# ScheduleWork Web Engineering Rules

## Context

- React 19 + TypeScript + Vite static SPA with Supabase backend.
- Internal single-team scheduling tool for at most 20 employees.
- Roles are only `admin` and `employee`; there is no public signup.
- Package manager is npm and `package-lock.json` is authoritative.
- Default availability deadline is Friday 22:00 in `Asia/Ho_Chi_Minh`; runtime enforcement always uses `registration_weeks.lock_at`.

## Security

- Enable RLS and use explicit grants on every exposed table.
- Never put `SUPABASE_SERVICE_ROLE_KEY`, database credentials, or JWT secrets in frontend code or `VITE_*` variables.
- Use the `admin-users` Edge Function only for privileged Supabase Auth Admin operations, including authenticated employee password changes. Normal domain CRUD uses the browser client plus RLS.
- Employees may edit only their own availability before its deadline.
- Employees never modify official schedules and may read published schedules only.
- Keep `auth.users.id` separate from the permanent domain identifier `employees.id`.
- Deactivation must preserve history while blocking employee application access.
- Temporary passwords are returned once and never stored as plaintext.

## Engineering

- Preserve Vietnamese scheduling terms such as `Sáng`, `Trưa`, `Tối`, and `xếp lịch`.
- Prefer small focused modules and existing helpers. Avoid SaaS/multi-tenant abstractions, new state libraries, UI frameworks, or unnecessary dependencies.
- Keep availability separate from official schedule data.
- Keep employee UI mobile-first and the schedule grid desktop/tablet-first with horizontal scrolling on mobile.
- Do not commit generated files, local `.env`, `node_modules`, `dist`, coverage, or secrets.

## Validation

Run before completion:

```bash
npm test
npm run build
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts
git diff --check
```

Run `supabase test db` when a local Supabase stack is available. Report explicitly when database/RLS integration tests could not run.
