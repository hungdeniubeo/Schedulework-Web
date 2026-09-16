# Unified Week Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one Admin-created registration week automatically own a matching draft schedule so `/admin/schedule?week=YYYY-MM-DD` is immediately ready for shift assignment without a second week-creation step.

**Architecture:** Keep `registration_weeks` and `schedule_weeks` as separate tables, but enforce a 1:1 workflow by `week_start`. Creation moves into one admin-only transactional RPC that inserts both rows; a migration backfills missing schedule rows for existing registration weeks. The frontend treats `registration_weeks` as the lifecycle authority and removes all standalone schedule-week creation controls.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Vitest 3, Supabase/PostgreSQL migrations and RPCs.

**Spec:** `docs/superpowers/specs/2026-09-16-unified-week-workflow-design.md`

## Global Constraints

- All changes stay on `feat/port-schedulework-scheduler`; do not modify or merge `main`.
- Do not merge `registration_weeks` and `schedule_weeks` into one table.
- Creating a registration week must atomically create its matching `schedule_week` with status `draft`.
- Existing registration weeks missing a schedule row must be backfilled idempotently.
- `/admin/schedule` must never create a standalone schedule week.
- If no registration week exists, `/admin/schedule` shows `Chưa có tuần để xếp lịch` and a `Tạo tuần mới` CTA that navigates to `/admin/registration-weeks`.
- Keep Monday week starts, exact `week_start` string matching, and `Asia/Ho_Chi_Minh` registration-deadline behavior unchanged.
- Do not restore `/app/team-schedule`.
- Do not alter employee-position logic, availability semantics, shift matching, or JPG export unless a regression test proves the workflow change requires it.

---

## File Structure

- Create `supabase/migrations/202609160003_create_registration_workflow.sql`: backfill missing schedule rows and define the atomic `create_registration_workflow` RPC.
- Create `src/admin/UnifiedWeekWorkflowMigration.test.ts`: source-level regression coverage for the migration contract because CI does not run a live Postgres instance.
- Modify `src/admin/api.ts`: replace direct `registration_weeks` insert with the creation RPC and preserve actionable errors.
- Modify `src/admin/api.test.ts`: prove registration creation uses the RPC and does not fall back to direct table inserts.
- Modify `src/admin/AdminDashboard.tsx`: remove `scheduleBusy`, `createSelectedScheduleWeek`, and `addScheduleWeek`; pass only registration-week-driven props to the schedule page.
- Modify `src/admin/AdminSchedulePage.tsx`: remove the missing-schedule creation branch and replace the no-week state with the single `Tạo tuần mới` CTA.
- Modify `src/admin/AdminSchedulePage.test.tsx`: lock in the new empty state and valid-week behavior.
- Modify `src/admin/AdminScheduler.tsx`: remove all standalone schedule-week creation UI/state/imports while keeping route-scoped scheduling, filtering, availability pills, publication, export, and editing.
- Modify `src/admin/AdminSelects.test.tsx` and `src/admin/WeeklyFlowRegression.test.tsx`: remove expectations for standalone schedule creation and assert that routed scheduling stays week-scoped.
- Modify `src/scheduling/api.ts`: remove `addScheduleWeek` once no verified call sites remain.
- Modify `.github/workflows/port-scheduler-ci.yml`: include the new migration regression test in the focused scheduler suite.

---

### Task 1: Add the atomic week-creation database contract

**Files:**
- Create: `supabase/migrations/202609160003_create_registration_workflow.sql`
- Create: `src/admin/UnifiedWeekWorkflowMigration.test.ts`

**Interfaces:**
- Produces RPC: `public.create_registration_workflow(target_week_start date, target_lock_at timestamptz) returns public.registration_weeks`
- Guarantees: every created registration week has one matching `schedule_weeks.week_start` row in `draft` status.
- Guarantees: existing registration weeks without schedule rows are backfilled; existing schedule rows are not replaced.

- [ ] **Step 1: Write the failing migration contract test**

Create `src/admin/UnifiedWeekWorkflowMigration.test.ts` and import the SQL as raw text:

```ts
import { describe, expect, it } from "vitest";
import migrationSql from "../../supabase/migrations/202609160003_create_registration_workflow.sql?raw";

describe("unified week workflow migration", () => {
  it("backfills only registration weeks that do not already have a schedule", () => {
    expect(migrationSql).toContain("insert into public.schedule_weeks");
    expect(migrationSql).toContain("from public.registration_weeks");
    expect(migrationSql).toContain("not exists");
    expect(migrationSql).toContain("status");
    expect(migrationSql).toContain("'draft'");
  });

  it("creates registration and schedule rows in one admin-only RPC", () => {
    expect(migrationSql).toContain("create or replace function public.create_registration_workflow");
    expect(migrationSql).toContain("private.is_admin()");
    expect(migrationSql).toContain("insert into public.registration_weeks");
    expect(migrationSql).toContain("insert into public.schedule_weeks");
    expect(migrationSql).toContain("returning * into created_week");
    expect(migrationSql).toContain("grant execute on function public.create_registration_workflow(date, timestamptz)");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- src/admin/UnifiedWeekWorkflowMigration.test.ts
```

Expected: FAIL because `202609160003_create_registration_workflow.sql` does not exist yet.

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/202609160003_create_registration_workflow.sql` with this shape:

```sql
insert into public.schedule_weeks (week_start, status)
select registration_week.week_start, 'draft'
from public.registration_weeks as registration_week
where not exists (
  select 1
  from public.schedule_weeks as schedule_week
  where schedule_week.week_start = registration_week.week_start
);

create or replace function public.create_registration_workflow(
  target_week_start date,
  target_lock_at timestamptz
)
returns public.registration_weeks
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_week public.registration_weeks;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;

  insert into public.registration_weeks (week_start, lock_at, status)
  values (target_week_start, target_lock_at, 'open')
  returning * into created_week;

  insert into public.schedule_weeks (week_start, status)
  values (target_week_start, 'draft');

  return created_week;
end;
$$;

revoke all on function public.create_registration_workflow(date, timestamptz)
from public, anon;

grant execute on function public.create_registration_workflow(date, timestamptz)
to authenticated;

comment on function public.create_registration_workflow(date, timestamptz) is
'Admin-only atomic creation of a registration week and its matching draft schedule.';

notify pgrst, 'reload schema';
```

Rely on existing table constraints to reject invalid Monday/duplicate dates. Because the function is one PostgreSQL transaction, any failure in the schedule insert rolls back the registration insert automatically.

- [ ] **Step 4: Run the migration contract test and existing week tests**

Run:

```bash
npm test -- src/admin/UnifiedWeekWorkflowMigration.test.ts src/admin/api.test.ts src/admin/WeeklyFlowRegression.test.tsx
```

Expected: PASS for the new SQL contract test; existing frontend tests remain green at this task boundary.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609160003_create_registration_workflow.sql src/admin/UnifiedWeekWorkflowMigration.test.ts
git commit -m "feat: create registration weeks with schedules atomically"
```

---

### Task 2: Route Admin week creation through the transactional RPC

**Files:**
- Modify: `src/admin/api.test.ts`
- Modify: `src/admin/api.ts`

**Interfaces:**
- Consumes RPC from Task 1.
- Produces unchanged frontend function signature: `createWeek(weekStart: string, lockAt: string): Promise<RegistrationWeek>`.

- [ ] **Step 1: Replace the direct-insert test with an RPC test**

In `src/admin/api.test.ts`, change the creation test so no `.from("registration_weeks")` path is allowed:

```ts
it("creates registration and schedule weeks through the transactional RPC", async () => {
  const created: RegistrationWeek = {
    id: "week-new",
    week_start: "2026-10-05",
    lock_at: "2026-10-02T15:00:00.000Z",
    status: "open",
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
  };
  const rpc = vi.fn(async () => ({ data: created, error: null }));
  const from = vi.fn(() => {
    throw new Error("direct registration insert must not be used");
  });
  supabase.client = { rpc, from };

  await expect(
    createWeek("2026-10-05", "2026-10-02T15:00:00.000Z"),
  ).resolves.toEqual(created);

  expect(rpc).toHaveBeenCalledWith("create_registration_workflow", {
    target_week_start: "2026-10-05",
    target_lock_at: "2026-10-02T15:00:00.000Z",
  });
  expect(from).not.toHaveBeenCalled();
});
```

Add an error test that verifies failed RPC creation rejects and never pretends the week was created.

- [ ] **Step 2: Run the API test and verify RED**

Run:

```bash
npm test -- src/admin/api.test.ts
```

Expected: FAIL because `createWeek()` still inserts directly into `registration_weeks`.

- [ ] **Step 3: Implement the RPC-backed `createWeek()`**

Replace the direct insert in `src/admin/api.ts`:

```ts
export async function createWeek(
  weekStart: string,
  lockAt: string,
): Promise<RegistrationWeek> {
  const { data, error } = await getSupabase().rpc(
    "create_registration_workflow",
    {
      target_week_start: weekStart,
      target_lock_at: lockAt,
    },
  );
  if (error) {
    console.error(error);
    const detail = `${error.code ? `[${error.code}] ` : ""}${error.message}`.trim();
    throw new Error(
      `Không tạo được tuần đăng ký và lịch xếp tương ứng. ${detail}`,
    );
  }
  return data as RegistrationWeek;
}
```

Keep the return type unchanged so `CreateWeekDialog`, `WeekManager`, and `AdminDashboard.addWeek()` continue selecting the newly created week without interface churn.

- [ ] **Step 4: Run focused API/dialog tests**

Run:

```bash
npm test -- src/admin/api.test.ts src/admin/WeekDialogs.test.tsx src/admin/AdminSelects.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/api.ts src/admin/api.test.ts
git commit -m "refactor: create weekly workflow through rpc"
```

---

### Task 3: Make `/admin/schedule` registration-week driven only

**Files:**
- Modify: `src/admin/AdminSchedulePage.test.tsx`
- Modify: `src/admin/AdminSchedulePage.tsx`
- Modify: `src/admin/AdminDashboard.tsx`

**Interfaces:**
- `AdminSchedulePage` consumes `selectedWeek`, `invalidRequestedWeek`, `registrationWeekStarts`, and `navigate`.
- It no longer consumes `scheduleWeekStarts`, `busy`, or `onCreate`.
- `AdminDashboard` no longer owns a standalone schedule-week creation action.

- [ ] **Step 1: Rewrite the schedule-page tests for the new mental model**

Replace the old `requires an explicit action before creating a missing schedule week` test with:

```ts
it("sends Admin to week management when no registration week exists", () => {
  const navigate = vi.fn();
  const html = renderToStaticMarkup(
    <AdminSchedulePage
      selectedWeek={null}
      invalidRequestedWeek={false}
      registrationWeekStarts={[]}
      navigate={navigate}
    />,
  );

  expect(html).toContain("Chưa có tuần để xếp lịch");
  expect(html).toContain("Tạo tuần mới");
  expect(html).not.toContain("Tạo lịch tuần này");
});
```

Add a valid-week test:

```ts
it("renders the scheduler immediately for a valid registration week", () => {
  const html = renderToStaticMarkup(
    <AdminSchedulePage
      selectedWeek={week}
      invalidRequestedWeek={false}
      registrationWeekStarts={[week.week_start]}
      navigate={vi.fn()}
    />,
  );

  expect(html).toContain("Xếp lịch chính thức");
  expect(html).not.toContain("Tuần này chưa có lịch xếp");
  expect(html).not.toContain("Tạo lịch tuần này");
});
```

Keep the invalid requested week test.

- [ ] **Step 2: Run the page test and verify RED**

Run:

```bash
npm test -- src/admin/AdminSchedulePage.test.tsx
```

Expected: FAIL because the component still requires `scheduleWeekStarts`, `busy`, and `onCreate` and still renders the old missing-schedule branch.

- [ ] **Step 3: Simplify `AdminSchedulePage`**

Change its props to:

```ts
type Props = {
  selectedWeek: RegistrationWeek | null;
  invalidRequestedWeek: boolean;
  registrationWeekStarts: string[];
  navigate: (path: string) => void;
};
```

Delete the `scheduleWeekStarts.includes(...)` branch entirely.

For `!selectedWeek`, render:

```tsx
<section className="panel schedule-missing-week">
  <span className="eyebrow">Xếp lịch</span>
  <h2>Chưa có tuần để xếp lịch</h2>
  <p>
    Hãy tạo tuần đăng ký trước. Lịch xếp sẽ được tạo tự động cùng tuần.
  </p>
  <button
    type="button"
    className="button primary"
    onClick={() => navigate("/admin/registration-weeks")}
  >
    Tạo tuần mới
  </button>
</section>
```

A valid `selectedWeek` should immediately render `<AdminScheduler preferredWeekStart={selectedWeek.week_start} ... />`.

- [ ] **Step 4: Remove standalone schedule creation from `AdminDashboard`**

Delete:

```ts
addScheduleWeek,
scheduleBusy,
createSelectedScheduleWeek()
```

Keep `listScheduleWeeks()` because `AdminScheduler` still loads schedule records and other dashboard refresh logic may need them during this transition; if TypeScript proves `scheduleWeeks` is now unused in `AdminDashboard`, remove the state and load there too rather than keeping dead code.

Change the schedule-page render to:

```tsx
<AdminSchedulePage
  selectedWeek={selectedWeek}
  invalidRequestedWeek={invalidRequestedWeek}
  registrationWeekStarts={weeks.map((week) => week.week_start)}
  navigate={navigate}
/>
```

- [ ] **Step 5: Run schedule/dashboard tests**

Run:

```bash
npm test -- src/admin/AdminSchedulePage.test.tsx src/admin/AdminDashboard.test.tsx src/admin/AdminNavigation.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/admin/AdminSchedulePage.tsx src/admin/AdminSchedulePage.test.tsx src/admin/AdminDashboard.tsx
git commit -m "refactor: drive admin scheduling from registration weeks"
```

---

### Task 4: Remove the standalone schedule-week UI and API path completely

**Files:**
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSelects.test.tsx`
- Modify: `src/admin/WeeklyFlowRegression.test.tsx`
- Modify: `src/scheduling/api.ts`
- Modify: `src/scheduling/api.test.ts` only if an import/export assertion needs adjustment.

**Interfaces:**
- `AdminScheduler` remains route-scoped by `preferredWeekStart` in Admin flow.
- Preserve `selectScheduleWeekId()`, `prepareScheduleWeekForEditing()`, schedule CRUD, shift assignment, availability matching, publication, export, and clear-week behavior.
- Remove `addScheduleWeek()` as a public API if no call sites remain.

- [ ] **Step 1: Tighten regression tests before deleting UI code**

In `src/admin/WeeklyFlowRegression.test.tsx`, keep the route-scoped test and extend it:

```ts
expect(html).not.toContain('aria-label="Tuần xếp lịch"');
expect(html).not.toContain('aria-label="Tạo lịch tuần mới"');
expect(html).not.toContain("Tạo lịch tuần");
expect(html).not.toContain("Tuần bắt đầu từ Thứ Hai");
expect(html).toContain('aria-label="Tìm nhân viên"');
expect(html).toContain('aria-label="Lọc theo nhóm"');
```

In `src/admin/AdminSelects.test.tsx`, replace the generic non-route tests that require `Tuần xếp lịch` and `Tạo lịch tuần mới` with route-scoped expectations matching the actual Admin product flow:

```ts
const html = renderToStaticMarkup(
  <AdminScheduler
    preferredWeekStart="2026-09-21"
    registrationWeekStarts={["2026-09-21"]}
  />,
);
expect(html).not.toContain('aria-label="Tuần xếp lịch"');
expect(html).not.toContain('aria-label="Tạo lịch tuần mới"');
expect(html).toContain('aria-label="Lọc theo nhóm"');
```

- [ ] **Step 2: Run scheduler UI tests before implementation**

Run:

```bash
npm test -- src/admin/WeeklyFlowRegression.test.tsx src/admin/AdminSelects.test.tsx
```

Expected: tests that assert total removal of creation controls should fail while `AdminScheduler` still contains the non-route creation implementation/source.

- [ ] **Step 3: Delete standalone schedule creation code from `AdminScheduler.tsx`**

Remove imports used only by schedule creation:

```ts
type FormEvent
PlusIcon
DateTimePicker
isMondayDate
defaultRegistrationWindow
addScheduleWeek
```

Remove state:

```ts
creatingWeek
newWeekStart
```

Remove the `useEffect` that copies `preferredWeekStart` into `newWeekStart`.

Remove `createWeek(event)`.

Remove the non-route `Tạo lịch tuần` button, the schedule-week picker, and the create-schedule modal. Keep only:

- employee search;
- group filter;
- refresh;
- schedule status/actions;
- registration sync bar;
- shift palette and grid.

Because the Admin app always enters with `preferredWeekStart`, prefer simplifying the component instead of maintaining a hidden alternate lifecycle. If `routeScoped` becomes unnecessary after the removal, remove it and collapse the conditional copy/classes too.

- [ ] **Step 4: Remove the standalone API function**

Delete from `src/scheduling/api.ts`:

```ts
export async function addScheduleWeek(weekStart: string): Promise<void> { ... }
```

Search all branch call sites before deletion. Expected result after Tasks 2-4: no production import of `addScheduleWeek` remains.

- [ ] **Step 5: Run the scheduler-focused suite**

Run:

```bash
npm test -- \
  src/admin/AdminSchedulePage.test.tsx \
  src/admin/WeeklyFlowRegression.test.tsx \
  src/admin/AdminSelects.test.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/admin/schedulerDnd.test.ts \
  src/scheduling/api.test.ts \
  src/scheduling/availabilityShiftMatch.test.ts \
  src/scheduling/availabilityNotice.test.ts \
  src/scheduling/publication.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/admin/AdminScheduler.tsx src/admin/AdminSelects.test.tsx src/admin/WeeklyFlowRegression.test.tsx src/scheduling/api.ts src/scheduling/api.test.ts
git commit -m "refactor: remove standalone schedule week creation"
```

---

### Task 5: Protect the unified workflow in CI and verify the complete flow

**Files:**
- Modify: `.github/workflows/port-scheduler-ci.yml`
- Test: full existing test suite and build.

**Interfaces:**
- CI explicitly runs the migration contract test in the focused scheduling set.
- Manual Supabase deployment remains `npx supabase db push` after pulling the branch.

- [ ] **Step 1: Add the migration regression test to focused CI**

Add:

```yaml
src/admin/UnifiedWeekWorkflowMigration.test.ts
```

to the `Scheduler focused tests` command near `src/admin/api.test.ts` and `src/admin/WeeklyFlowRegression.test.tsx`.

- [ ] **Step 2: Run the focused suite locally/through the branch runner**

Run:

```bash
npm test -- \
  src/admin/UnifiedWeekWorkflowMigration.test.ts \
  src/admin/api.test.ts \
  src/admin/AdminSchedulePage.test.tsx \
  src/admin/WeeklyFlowRegression.test.tsx \
  src/admin/AdminSelects.test.tsx \
  src/admin/WeekDialogs.test.tsx \
  src/employee/EmployeeRegistrationPage.test.ts \
  src/employee/scheduleApi.test.ts \
  src/admin/ScheduleGrid.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run build
git diff --check origin/main...HEAD
```

Expected: all tests PASS, build succeeds, and whitespace check prints no errors.

- [ ] **Step 4: Commit CI coverage**

```bash
git add .github/workflows/port-scheduler-ci.yml
git commit -m "ci: protect unified week workflow"
```

- [ ] **Step 5: Apply the database migration and smoke-test the real flow**

After pulling the final feat branch on the user's machine:

```bash
npx supabase db push
npm run dev
```

Smoke test in this exact order:

1. Delete or use a disposable test week.
2. Open `/admin/registration-weeks` and create a Monday-start week.
3. Confirm only one create action is performed in the UI.
4. Navigate to `/admin/schedule?week=<same YYYY-MM-DD>`.
5. Confirm the scheduler grid opens immediately with no `Tạo lịch tuần này` step.
6. Select a shift and assign it to an employee/day.
7. Confirm the employee registration pill remains below the official shift.
8. Publish/export behavior remains functional.
9. Create another registration week and confirm it also has an immediately usable schedule.
10. For an older registration week that previously lacked a schedule, confirm the migration backfill makes it schedulable without recreating the week.
11. Delete a disposable week from `/admin/registration-weeks` and confirm the complete workflow disappears.

If any RPC fails, preserve the Supabase error code/message in the UI and debug that root cause rather than adding a direct-table fallback.

---

## Self-Review Results

- **Spec coverage:** atomic create, old-data backfill, no-week CTA, direct valid-week scheduling, removal of duplicate schedule creation, timezone preservation, delete lifecycle, and regression coverage are all mapped to tasks.
- **Placeholder scan:** no TODO/TBD/implementation-later placeholders remain.
- **Type consistency:** `createWeek(weekStart, lockAt): Promise<RegistrationWeek>` stays unchanged at the UI boundary; the new RPC returns the same `RegistrationWeek` shape; `AdminSchedulePage` drops only obsolete schedule-creation props.
- **Scope check:** employee/position, availability semantics, shift matching, and JPG export are intentionally preserved and only regression-tested.
