# Scheduling Flow Audit and Week Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing weekly scheduling flow so employee/position data stays consistent, registration dates and deadlines remain exact, employee submissions flow through all views, scheduler guidance is low-noise and synchronized with configured shifts, and deleting a week atomically removes the entire online workflow.

**Architecture:** Keep the existing Supabase-backed domain model and treat `registration_weeks` and `schedule_weeks` with the same `week_start` as one lifecycle without merging their tables. Add one Admin-only PostgreSQL RPC for atomic deletion, keep `availability_submissions` as the shared registration source of truth, add a small pure helper for exact availability-to-shift matching, and make targeted UI changes in week management and scheduler cells. Preserve already-correct behavior rather than refactoring it.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Vitest 3, Supabase/PostgreSQL, `@supabase/supabase-js`, `@dnd-kit/core`.

**Spec:** `docs/superpowers/specs/2026-09-16-scheduling-flow-audit-and-week-lifecycle-design.md`

## Global Constraints

- All implementation work stays on `feat/port-schedulework-scheduler`; do not change `main`.
- Do not merge `registration_weeks` and `schedule_weeks` into one table.
- Do not auto-create a `schedule_week` when a registration week is created.
- Do not restore `/app/team-schedule`.
- Availability remains guidance only; outside-availability and OFF-day scheduling are informational, not blocking.
- Missing registration produces no scheduler warning.
- Existing overlap and invalid-time checks remain blocking.
- Registration weeks start on Monday and cover Monday through Sunday.
- Registration deadline interpretation remains `Asia/Ho_Chi_Minh`.
- Default deadline remains Friday 22:00 before the work week unless Admin explicitly edits it.
- Do not auto-create a shift type from employee registration data.
- Exact registration/shift matching means exact equality of normalized one- or two-interval time ranges; never choose a nearest shift.
- Official scheduled shifts render before registration guidance in scheduler cells.
- Registration guidance must remain visually lighter than official scheduled shifts.
- Archived weeks stay deletable but move to a separate collapsed archive section.
- Permanent week deletion must be atomic: no partial deletion may survive an error.
- Employee deletion remains soft deletion so historical schedule data remains available.
- Use existing CSS files/design patterns; do not introduce a broad unrelated admin redesign.

---

## File Structure

### New files

- `supabase/migrations/202609160001_delete_registration_workflow.sql` — Admin-only transactional RPC that removes the matching schedule workflow and registration workflow by registration-week id.
- `src/scheduling/availabilityShiftMatch.ts` — pure exact-match helper between employee availability intervals and configured `ShiftType` ranges.
- `src/scheduling/availabilityShiftMatch.test.ts` — exact, split, unmatched, invalid, and OFF matching coverage.
- `src/admin/WeekDialogs.test.tsx` — destructive week-delete dialog copy/structure regression coverage.

### Existing files to modify

- `src/admin/api.ts` — replace direct `registration_weeks.delete()` with `delete_registration_workflow` RPC.
- `src/admin/api.test.ts` — assert deletion uses the RPC and not a direct table delete.
- `src/admin/AdminDashboard.tsx` — after archive/delete, resolve navigation to a valid non-archived week; preserve current selected-week/query behavior.
- `src/admin/AdminDashboard.test.tsx` — regression coverage for fallback selection after lifecycle changes where practical through extracted pure helper coverage or existing page behavior.
- `src/admin/WeekManager.tsx` — separate active and archived weeks, target deletion to any week row, show success toast.
- `src/admin/RegistrationWeeks.css` — style archived section, destructive dialog emphasis, and success toast.
- `src/admin/WeekDialogs.tsx` — styled destructive confirmation copy and action label `Xóa toàn bộ tuần`.
- `src/admin/RegistrationWeeksPage.tsx` — keep page shell simple; only adjust composition if required by archive section/toast layout.
- `src/admin/registrationWeekUi.ts` / `src/admin/registrationWeekUi.test.ts` — preserve action rules and add any pure active/archive partition helper only if it keeps `WeekManager` simpler.
- `src/admin/ScheduleGrid.tsx` — official shifts first; interactive registration pill below; exact configured-shift color/label reuse; OFF and neutral fallbacks.
- `src/admin/ScheduleGrid.test.tsx` — assert DOM ordering and all registration visual cases.
- `src/admin/AdminSchedule.css` — muted registration pill and read-only detail popover styling.
- `src/employee/registrationWeekSelection.test.ts` — lock in create/delete/archived selection behavior.
- `src/employee/scheduleApi.test.ts` — lock in same-week employee `my-schedule` behavior.
- `src/admin/AdminAvailabilityPage.test.tsx` — lock in same-week navigation to scheduler.
- `src/admin/AdminSchedulePage.test.tsx` — lock in explicit schedule creation and same-week scheduler behavior.
- `src/admin/employeePositions.test.ts` if present; otherwise create it only when helper behavior is not already directly covered — position rename/assignment source-of-truth regression.
- `.github/workflows/port-scheduler-ci.yml` — add new focused tests so the branch workflow protects the new lifecycle/matching behavior.

---

### Task 1: Lock Down the Already-Correct Flow Before Changing Production Code

**Files:**
- Test: `src/admin/employeePositions.test.ts` (create if absent)
- Modify: `src/employee/registrationWeekSelection.test.ts`
- Modify: `src/employee/scheduleApi.test.ts`
- Modify: `src/admin/AdminAvailabilityPage.test.tsx`
- Modify: `src/admin/AdminSchedulePage.test.tsx`
- Reference only: `src/lib/week.test.ts`
- Reference only: `src/scheduling/api.test.ts`

**Interfaces:**
- Consumes: `employeesWithRenamedPosition`, `employeesWithUpdatedPosition`, `selectEmployeeRegistrationWeek`, `selectSubmittedAvailability`, `adminWeekPath` behavior already present in the codebase.
- Produces: regression coverage proving the baseline flow is already correct before lifecycle/UI changes begin.

- [ ] **Step 1: Add employee-position linkage regression tests**

Create or extend `src/admin/employeePositions.test.ts` with direct pure-helper assertions:

```ts
import { describe, expect, it } from "vitest";
import type { CloudEmployee, Position } from "../scheduling/types";
import {
  employeesWithRenamedPosition,
  employeesWithUpdatedPosition,
} from "./employeePositions";

const positions: Position[] = [
  { id: "position-a", name: "Bếp trưởng", sortOrder: 0 },
  { id: "position-b", name: "Phụ bếp", sortOrder: 1 },
];

const employee: CloudEmployee = {
  id: "employee-1",
  name: "Nguyễn Phi Hùng",
  active: true,
  groupId: "group-1",
  positionId: "position-a",
  positionName: "Bếp trưởng",
  sortOrder: 0,
  isNew: false,
};

describe("employee position linkage", () => {
  it("updates the employee position id and visible position name together", () => {
    expect(
      employeesWithUpdatedPosition([employee], employee.id, "position-b", positions)[0],
    ).toMatchObject({ positionId: "position-b", positionName: "Phụ bếp" });
  });

  it("propagates a renamed position to assigned employees only", () => {
    const renamed = { ...positions[0], name: "Bếp chính" };
    const result = employeesWithRenamedPosition([employee], renamed);
    expect(result[0]).toMatchObject({
      positionId: "position-a",
      positionName: "Bếp chính",
    });
  });
});
```

- [ ] **Step 2: Extend week-selection regression coverage for exact lifecycle behavior**

Add assertions to `src/employee/registrationWeekSelection.test.ts` proving:

```ts
it("never selects a deleted week because it is no longer present in the source list", () => {
  const remaining = [week("week-next", "2026-09-28")];
  expect(selectEmployeeRegistrationWeek(remaining, now)?.id).toBe("week-next");
});

it("prefers the nearest still-open week instead of a later open week", () => {
  expect(
    selectEmployeeRegistrationWeek(
      [week("later", "2026-10-05"), week("near", "2026-09-28")],
      now,
    )?.id,
  ).toBe("near");
});
```

Keep the existing archived-week assertion.

- [ ] **Step 3: Extend same-week employee/admin flow tests without changing implementation**

In `src/employee/scheduleApi.test.ts`, retain the existing `selectedWeek.week_start` assertion and add a case where a submission exists only for another week; with a preferred/current open week, expected result is `null` rather than leaking another week's submission.

In `src/admin/AdminAvailabilityPage.test.tsx`, assert the `Xếp lịch tuần này` callback navigates to exactly:

```ts
expect(navigate).toHaveBeenCalledWith(
  "/admin/schedule?week=2026-09-21",
);
```

In `src/admin/AdminSchedulePage.test.tsx`, assert a selected registration week without a schedule week renders `Tạo lịch tuần này` and does not render `AdminScheduler` implicitly.

- [ ] **Step 4: Run the baseline regression set**

Run:

```bash
npm test -- \
  src/admin/employeePositions.test.ts \
  src/employee/registrationWeekSelection.test.ts \
  src/employee/scheduleApi.test.ts \
  src/admin/AdminAvailabilityPage.test.tsx \
  src/admin/AdminSchedulePage.test.tsx \
  src/lib/week.test.ts \
  src/scheduling/api.test.ts
```

Expected: PASS. These tests describe behavior intentionally preserved by the spec. If one fails, stop and fix the discovered baseline bug before starting Task 2; do not weaken the assertion.

- [ ] **Step 5: Commit baseline regression coverage**

```bash
git add \
  src/admin/employeePositions.test.ts \
  src/employee/registrationWeekSelection.test.ts \
  src/employee/scheduleApi.test.ts \
  src/admin/AdminAvailabilityPage.test.tsx \
  src/admin/AdminSchedulePage.test.tsx
git commit -m "test: lock down scheduling flow baseline"
```

---

### Task 2: Add Atomic Full-Week Deletion in Supabase and Route the Admin API Through It

**Files:**
- Create: `supabase/migrations/202609160001_delete_registration_workflow.sql`
- Modify: `src/admin/api.ts`
- Modify/Test: `src/admin/api.test.ts`

**Interfaces:**
- Consumes: existing `private.is_admin()`, `registration_weeks.week_start`, cascade from `schedule_weeks -> schedule_entries`, cascade from `registration_weeks -> availability_submissions`.
- Produces: `public.delete_registration_workflow(target_registration_week_id uuid) returns date`; frontend `deleteWeek(id: string): Promise<void>` continues to expose the same TypeScript signature.

- [ ] **Step 1: Write the failing frontend API test**

Add a test to `src/admin/api.test.ts` that stubs `supabase.rpc` and proves `deleteWeek` calls the transactional RPC instead of `.from("registration_weeks").delete()`:

```ts
it("deletes a registration workflow through the transactional RPC", async () => {
  const rpc = vi.fn(async () => ({ data: "2026-09-21", error: null }));
  const from = vi.fn(() => {
    throw new Error("direct table delete must not be used");
  });
  supabase.client = { rpc, from };

  await expect(deleteWeek("week-1")).resolves.toBeUndefined();
  expect(rpc).toHaveBeenCalledWith("delete_registration_workflow", {
    target_registration_week_id: "week-1",
  });
  expect(from).not.toHaveBeenCalled();
});
```

Also add an RPC-error assertion:

```ts
it("surfaces an atomic delete failure without falling back to direct deletes", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  supabase.client = {
    rpc: vi.fn(async () => ({
      data: null,
      error: { message: "REGISTRATION_WEEK_NOT_FOUND" },
    })),
  };

  await expect(deleteWeek("missing")).rejects.toThrow(
    "Không xóa được toàn bộ dữ liệu tuần đăng ký.",
  );
});
```

- [ ] **Step 2: Run the API test to verify RED**

Run:

```bash
npm test -- src/admin/api.test.ts
```

Expected: FAIL because `deleteWeek` still performs a direct table delete.

- [ ] **Step 3: Add the PostgreSQL migration with one atomic Admin-only function**

Create `supabase/migrations/202609160001_delete_registration_workflow.sql`:

```sql
create or replace function public.delete_registration_workflow(
  target_registration_week_id uuid
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_week_start date;
begin
  if not (select private.is_admin()) then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_REQUIRED';
  end if;

  select week.week_start
  into target_week_start
  from public.registration_weeks as week
  where week.id = target_registration_week_id;

  if target_week_start is null then
    raise exception using
      errcode = 'P0002',
      message = 'REGISTRATION_WEEK_NOT_FOUND';
  end if;

  -- schedule_entries are removed by schedule_weeks ON DELETE CASCADE.
  delete from public.schedule_weeks
  where week_start = target_week_start;

  -- availability_submissions are removed by registration_weeks ON DELETE CASCADE.
  delete from public.registration_weeks
  where id = target_registration_week_id;

  return target_week_start;
end;
$$;

revoke all on function public.delete_registration_workflow(uuid)
from public, anon;

grant execute on function public.delete_registration_workflow(uuid)
to authenticated;
```

The PostgreSQL function call is one transaction; an exception rolls back both deletes.

- [ ] **Step 4: Replace the direct frontend delete with the RPC**

Change `src/admin/api.ts` to:

```ts
export async function deleteWeek(id: string): Promise<void> {
  const { error } = await getSupabase().rpc("delete_registration_workflow", {
    target_registration_week_id: id,
  });
  fail(error, "Không xóa được toàn bộ dữ liệu tuần đăng ký.");
}
```

Do not add a fallback direct delete.

- [ ] **Step 5: Run the API tests to verify GREEN**

Run:

```bash
npm test -- src/admin/api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify migration syntax against the local Supabase CLI if Docker/local stack is available**

Run:

```bash
npx supabase db lint
```

Expected: no new SQL errors from `202609160001_delete_registration_workflow.sql`.

If the repository environment does not have a running local Supabase stack, do not mutate a remote database from this task; keep the migration committed and rely on repository SQL review plus the frontend RPC contract test.

- [ ] **Step 7: Commit the atomic delete backend/API change**

```bash
git add \
  supabase/migrations/202609160001_delete_registration_workflow.sql \
  src/admin/api.ts \
  src/admin/api.test.ts
git commit -m "feat: delete complete weekly workflow atomically"
```

---

### Task 3: Redesign Registration-Week Lifecycle UI, Archive Area, Delete Dialog, and Success Toast

**Files:**
- Modify: `src/admin/WeekManager.tsx`
- Modify: `src/admin/WeekDialogs.tsx`
- Create/Test: `src/admin/WeekDialogs.test.tsx`
- Modify: `src/admin/RegistrationWeeks.css`
- Modify: `src/admin/AdminDashboard.tsx`
- Modify: `src/admin/registrationWeekUi.ts`
- Modify/Test: `src/admin/registrationWeekUi.test.ts`

**Interfaces:**
- Consumes: unchanged `onDelete(id): Promise<void>`, `onUpdate(id, changes)`, `RegistrationWeek.status`.
- Produces: `partitionRegistrationWeeks(weeks)` returning `{ active: RegistrationWeek[]; archived: RegistrationWeek[] }`; styled `DeleteWeekDialog`; archive list; success toast.

- [ ] **Step 1: Write failing pure partition tests**

Add to `src/admin/registrationWeekUi.test.ts`:

```ts
import { partitionRegistrationWeeks } from "./registrationWeekUi";

it("separates archived weeks from the primary week list", () => {
  const result = partitionRegistrationWeeks([
    week("open", "2026-09-21", "open"),
    week("locked", "2026-09-28", "locked"),
    week("archived", "2026-09-14", "archived"),
  ]);

  expect(result.active.map((item) => item.id)).toEqual(["open", "locked"]);
  expect(result.archived.map((item) => item.id)).toEqual(["archived"]);
});
```

Use the test file's existing `week(...)` fixture shape or add the complete `RegistrationWeek` fixture there.

- [ ] **Step 2: Write the failing destructive dialog render test**

Create `src/admin/WeekDialogs.test.tsx` using `renderToStaticMarkup`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeleteWeekDialog } from "./WeekDialogs";

it("states that the whole weekly workflow is permanently deleted", () => {
  const html = renderToStaticMarkup(
    <DeleteWeekDialog
      week={{
        id: "week-1",
        week_start: "2026-10-05",
        lock_at: "2026-10-02T15:00:00.000Z",
        status: "archived",
        created_at: "",
        updated_at: "",
      }}
      busy={false}
      onClose={() => undefined}
      onDelete={async () => undefined}
    />,
  );

  expect(html).toContain("Xóa toàn bộ tuần");
  expect(html).toContain("đăng ký nhân viên");
  expect(html).toContain("lịch đã xếp");
  expect(html).toContain("05/10 – 11/10");
});
```

- [ ] **Step 3: Run the lifecycle UI tests to verify RED**

Run:

```bash
npm test -- \
  src/admin/registrationWeekUi.test.ts \
  src/admin/WeekDialogs.test.tsx
```

Expected: FAIL because partition helper and new destructive copy do not exist yet.

- [ ] **Step 4: Implement the pure partition helper**

Add to `src/admin/registrationWeekUi.ts`:

```ts
export function partitionRegistrationWeeks(weeks: RegistrationWeek[]): {
  active: RegistrationWeek[];
  archived: RegistrationWeek[];
} {
  return {
    active: weeks.filter((week) => week.status !== "archived"),
    archived: weeks.filter((week) => week.status === "archived"),
  };
}
```

Keep `registrationWeekActionState(...).canDelete` true for all statuses.

- [ ] **Step 5: Refactor `WeekManager` to support independent delete targets and a collapsed archive section**

Use this state shape rather than tying deletion to `selected`:

```ts
const { active: activeWeeks, archived: archivedWeeks } =
  partitionRegistrationWeeks(weeks);
const selected = activeWeeks.find((week) => week.id === selectedId) ?? null;
const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
const [deleteTarget, setDeleteTarget] = useState<RegistrationWeek | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
```

The primary `CustomSelect` options must come from `activeWeeks`, not all weeks.

Render archived weeks below the main card using native collapsed details:

```tsx
{archivedWeeks.length > 0 && (
  <details className="archived-weeks">
    <summary>
      <span>Tuần đã lưu trữ</span>
      <small>{archivedWeeks.length} tuần</small>
    </summary>
    <div className="archived-week-list">
      {archivedWeeks.map((week) => (
        <div className="archived-week-row" key={week.id}>
          <div>
            <strong>{formatWeekDisplay(week.week_start)}</strong>
            <span className="status-badge archived">Đã lưu trữ</span>
          </div>
          <button
            type="button"
            className="button ghost danger compact"
            disabled={busy}
            onClick={() => setDeleteTarget(week)}
          >
            Xóa
          </button>
        </div>
      ))}
    </div>
  </details>
)}
```

For the active week delete action, call `setDeleteTarget(selected)`.

Render one dialog from `deleteTarget`:

```tsx
{deleteTarget && (
  <DeleteWeekDialog
    week={deleteTarget}
    busy={busy}
    onClose={() => setDeleteTarget(null)}
    onDelete={async (id) => {
      const label = formatWeekRange(deleteTarget.week_start);
      await onDelete(id);
      setDeleteTarget(null);
      setSuccessMessage(
        `Đã xóa tuần ${label} và toàn bộ dữ liệu liên quan.`,
      );
    }}
  />
)}
```

Add a 2.6-second auto-dismiss effect for `successMessage`, matching the employee save toast timing:

```ts
useEffect(() => {
  if (!successMessage) return;
  const timer = window.setTimeout(() => setSuccessMessage(null), 2600);
  return () => window.clearTimeout(timer);
}, [successMessage]);
```

Render:

```tsx
<div className="admin-toast-region" aria-live="polite" aria-atomic="true">
  {successMessage && (
    <div className="admin-success-toast" role="status">
      {successMessage}
    </div>
  )}
</div>
```

Update the import to include `useEffect` and `formatWeekRange`.

- [ ] **Step 6: Replace the delete dialog copy and structure**

In `src/admin/WeekDialogs.tsx`, keep the no-dismiss-while-busy behavior and change the destructive dialog body to explicitly say both datasets are removed:

```tsx
<section
  className="confirm-dialog week-delete-dialog"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="delete-registration-week-title"
  aria-describedby="delete-registration-week-description"
>
  <div className="week-delete-warning-icon" aria-hidden="true">!</div>
  <header>
    <span className="eyebrow">Thao tác không thể hoàn tác</span>
    <h2 id="delete-registration-week-title">Xóa toàn bộ tuần?</h2>
  </header>
  <div className="week-delete-target">
    <strong>{formatWeekDisplay(week.week_start)}</strong>
  </div>
  <p id="delete-registration-week-description">
    Toàn bộ đăng ký nhân viên và lịch đã xếp của tuần này sẽ bị xóa vĩnh viễn.
    Ảnh JPG đã xuất trước đó không bị ảnh hưởng.
  </p>
  ...
  <button className="button danger" ...>
    {busy ? "Đang xóa..." : "Xóa toàn bộ tuần"}
  </button>
</section>
```

Do not claim the official schedule is preserved.

- [ ] **Step 7: Resolve navigation away from an archived selected week**

In `src/admin/AdminDashboard.tsx`, after `updateWeek(id, changes)` and `refreshBase()`, when the selected week was archived, navigate to the next non-archived week selected by the existing resolver or to `/admin/registration-weeks`:

```ts
async function patchWeek(
  id: string,
  changes: { status?: RegistrationWeekStatus; lock_at?: string },
) {
  setWeekBusy(true);
  try {
    const archivingSelected =
      changes.status === "archived" && selectedWeekId === id;
    await updateWeek(id, changes);
    const { nextWeeks } = await refreshBase();
    if (archivingSelected) {
      const next = resolveAdminRegistrationWeek(nextWeeks, null).week;
      navigate(
        next
          ? adminWeekPath("/admin/registration-weeks", next.week_start)
          : "/admin/registration-weeks",
      );
    }
  } finally {
    setWeekBusy(false);
  }
}
```

Keep the existing delete fallback logic, now backed by the atomic RPC.

- [ ] **Step 8: Add restrained styles for the archive area, destructive dialog, and toast**

In `src/admin/RegistrationWeeks.css`, add classes with these visual rules:

```css
.archived-weeks {
  margin-top: 18px;
  border: 1px solid rgba(76, 92, 84, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
}

.archived-weeks > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  list-style: none;
}

.archived-week-list {
  display: grid;
  gap: 8px;
  padding: 0 12px 12px;
}

.archived-week-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  background: #f7f8f7;
  border: 1px solid rgba(76, 92, 84, 0.1);
  border-radius: 10px;
}

.week-delete-dialog {
  max-width: 520px;
  text-align: left;
}

.week-delete-warning-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  color: #8b352e;
  background: #fff0ee;
  border: 1px solid #efd1cd;
  font-weight: 900;
}

.week-delete-target {
  padding: 10px 12px;
  background: #f7f8f7;
  border-radius: 9px;
}

.admin-toast-region {
  position: fixed;
  z-index: 90;
  right: 20px;
  bottom: 20px;
  pointer-events: none;
}

.admin-success-toast {
  max-width: min(420px, calc(100vw - 32px));
  padding: 11px 14px;
  color: #314139;
  background: #f2f8f4;
  border: 1px solid #cfe0d5;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(31, 43, 37, 0.12);
}
```

Adapt selectors to existing CSS specificity if needed, but keep the same restrained visual intent.

- [ ] **Step 9: Run week lifecycle tests and build**

Run:

```bash
npm test -- \
  src/admin/registrationWeekUi.test.ts \
  src/admin/WeekDialogs.test.tsx \
  src/admin/AdminDashboard.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 10: Commit week lifecycle UI**

```bash
git add \
  src/admin/WeekManager.tsx \
  src/admin/WeekDialogs.tsx \
  src/admin/WeekDialogs.test.tsx \
  src/admin/RegistrationWeeks.css \
  src/admin/AdminDashboard.tsx \
  src/admin/registrationWeekUi.ts \
  src/admin/registrationWeekUi.test.ts
git commit -m "feat: streamline registration week lifecycle"
```

---

### Task 4: Add Exact Availability-to-Configured-Shift Matching

**Files:**
- Create: `src/scheduling/availabilityShiftMatch.ts`
- Create/Test: `src/scheduling/availabilityShiftMatch.test.ts`
- Reference: `src/lib/availability.ts`
- Reference: `src/scheduling/shiftStyle.ts`

**Interfaces:**
- Consumes: `getIntervals(day)`, `clockToMinutes(value)`, `shiftRangesFromLabel(label)`, `ShiftType`.
- Produces: `findExactShiftForAvailability(day, shifts): ShiftType | null`.

- [ ] **Step 1: Write failing exact-match tests**

Create `src/scheduling/availabilityShiftMatch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import type { ShiftType } from "./types";
import { findExactShiftForAvailability } from "./availabilityShiftMatch";

const shifts: ShiftType[] = [
  { id: "morning", label: "10:00-14:00", color: "#70AD47", isPreset: false },
  { id: "night", label: "17h-23h", color: "#ED7D31", isPreset: false },
  { id: "split", label: "10h-14h/17h-23h", color: "#5B9BD5", isPreset: false },
];

describe("findExactShiftForAvailability", () => {
  it("matches one exact interval", () => {
    const day = createPresetDay("morning");
    expect(findExactShiftForAvailability(day, shifts)?.id).toBe("morning");
  });

  it("matches split intervals across h and colon label formats", () => {
    const day = createPresetDay("full");
    expect(findExactShiftForAvailability(day, shifts)?.id).toBe("split");
  });

  it("does not guess a nearby configured shift", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning_afternoon");
    const day = availability.days["1"];
    expect(findExactShiftForAvailability(day, shifts)).toBeNull();
  });

  it("never matches an OFF day", () => {
    expect(findExactShiftForAvailability(createEmptyAvailability().days["1"], shifts))
      .toBeNull();
  });
});
```

- [ ] **Step 2: Run the helper test to verify RED**

Run:

```bash
npm test -- src/scheduling/availabilityShiftMatch.test.ts
```

Expected: FAIL because the module/function does not exist.

- [ ] **Step 3: Implement exact normalized range equality**

Create `src/scheduling/availabilityShiftMatch.ts`:

```ts
import { getIntervals } from "../lib/availability";
import type { DayAvailability } from "../types/domain";
import { clockToMinutes, shiftRangesFromLabel } from "./shiftStyle";
import type { ShiftType } from "./types";

function availabilityRanges(day: DayAvailability) {
  return getIntervals(day).flatMap(({ start, end }) => {
    const startMinutes = clockToMinutes(start);
    const endMinutes = clockToMinutes(end);
    return startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
      ? [{ start: startMinutes, end: endMinutes }]
      : [];
  });
}

function sameRanges(
  left: ReadonlyArray<{ start: number; end: number }>,
  right: ReadonlyArray<{ start: number; end: number }>,
): boolean {
  if (left.length !== right.length || left.length === 0) return false;
  const sort = (ranges: ReadonlyArray<{ start: number; end: number }>) =>
    [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const first = sort(left);
  const second = sort(right);
  return first.every(
    (range, index) =>
      range.start === second[index].start && range.end === second[index].end,
  );
}

export function findExactShiftForAvailability(
  day: DayAvailability,
  shifts: ShiftType[],
): ShiftType | null {
  if (day.status !== "available") return null;
  const source = availabilityRanges(day);
  if (source.length === 0) return null;
  return (
    shifts.find((shift) => sameRanges(source, shiftRangesFromLabel(shift.label))) ??
    null
  );
}
```

- [ ] **Step 4: Run matching tests to verify GREEN**

Run:

```bash
npm test -- \
  src/scheduling/availabilityShiftMatch.test.ts \
  src/scheduling/shiftStyle.test.ts \
  src/lib/availability.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the pure matching helper**

```bash
git add \
  src/scheduling/availabilityShiftMatch.ts \
  src/scheduling/availabilityShiftMatch.test.ts
git commit -m "feat: match registration intervals to configured shifts"
```

---

### Task 5: Render Official Shifts First and a Muted Interactive Registration Pill Below

**Files:**
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify/Test: `src/admin/ScheduleGrid.test.tsx`
- Modify: `src/admin/AdminSchedule.css`
- Consumes helper: `src/scheduling/availabilityShiftMatch.ts`

**Interfaces:**
- Consumes: `findExactShiftForAvailability(day, shifts)`, `formatAvailabilityCell`, `getOffReason`, `formatShiftLabel`, `shiftStyle`, configured `ShiftType.color`.
- Produces: scheduler cell markup with `.official-shifts` before `.availability-detail`; `.availability-hint.matched|neutral|off`; read-only `.availability-popover`.

- [ ] **Step 1: Replace the old expectation with failing scheduler-cell hierarchy tests**

Extend `src/admin/ScheduleGrid.test.tsx` with:

```ts
it("renders official shifts before registration guidance", () => {
  const availability = createEmptyAvailability();
  availability.days["1"] = createPresetDay("morning");
  const html = render({ [employee.id]: availability });

  expect(html.indexOf("official-shifts")).toBeLessThan(
    html.indexOf("availability-detail"),
  );
});
```

Add exact configured-shift styling test using an availability that equals the existing `shift` fixture or add a morning shift fixture:

```ts
it("reuses a configured shift label/color source for an exact registration match", () => {
  const availability = createEmptyAvailability();
  availability.days["1"] = {
    status: "available",
    preset: "evening",
    intervals: [{ start: "17:00", end: "23:00" }],
    offReason: null,
  };
  const html = render({ [employee.id]: availability });

  expect(html).toContain("availability-hint matched");
  expect(html).toContain("ĐK");
  expect(html).toContain("17:00 – 23:00");
});
```

Add neutral unmatched test:

```ts
it("uses a neutral registration pill when no configured shift matches exactly", () => {
  const availability = createEmptyAvailability();
  availability.days["1"] = {
    status: "available",
    preset: "morning_afternoon",
    intervals: [{ start: "10:00", end: "18:00" }],
    offReason: null,
  };
  const html = render({ [employee.id]: availability });

  expect(html).toContain("availability-hint neutral");
  expect(html).toContain("10h–18h");
});
```

Update the existing OFF reason test to assert the reason is inside `.availability-popover` and the compact summary remains `ĐK · Nghỉ`.

- [ ] **Step 2: Run scheduler tests to verify RED**

Run:

```bash
npm test -- src/admin/ScheduleGrid.test.tsx
```

Expected: FAIL because registration currently renders before official shifts and has no matched/neutral detail structure.

- [ ] **Step 3: Refactor `ScheduleCell` to compute the registration visual model**

In `src/admin/ScheduleGrid.tsx`, import:

```ts
import { findExactShiftForAvailability } from "../scheduling/availabilityShiftMatch";
```

Inside `ScheduleCell`:

```ts
const availabilityLabel = availability ? formatAvailabilityCell(availability) : "";
const offReason = availability ? getOffReason(availability) : "";
const matchedShift = availability
  ? findExactShiftForAvailability(availability, shifts)
  : null;
const registrationLabel = matchedShift
  ? formatShiftLabel(matchedShift.label)
  : availabilityLabel;
const registrationKind = !availability
  ? null
  : availability.status === "off"
    ? "off"
    : matchedShift
      ? "matched"
      : "neutral";
```

Do not use `semanticShiftColor(...)` for unmatched registrations anymore; unmatched means neutral by design.

- [ ] **Step 4: Move registration guidance below official shifts and use native `details` for click-to-view context**

The order inside `.schedule-cell-stack` must be:

```tsx
<div className="official-shifts">
  {entries.map(...)}
</div>

{availability && registrationKind && (
  <details
    className={`availability-detail ${registrationKind}`}
    onClick={(event) => event.stopPropagation()}
  >
    <summary
      className={`availability-hint ${registrationKind}`}
      style={
        matchedShift
          ? shiftStyle(
              resolvedShiftColor(matchedShift.label, matchedShift.color),
            )
          : undefined
      }
    >
      <span>ĐK</span> · {registrationLabel}
    </summary>
    <div className="availability-popover">
      <strong>Đăng ký của nhân viên</strong>
      <span>{availabilityLabel}</span>
      {matchedShift && (
        <small>Khớp ca: {formatShiftLabel(matchedShift.label)}</small>
      )}
      {offReason && <small>Lý do: {offReason}</small>}
    </div>
  </details>
)}
```

Keep the pill read-only. Do not add mutation callbacks.

- [ ] **Step 5: Add low-noise pill and popover styles**

In `src/admin/AdminSchedule.css`, replace/extend the existing availability hint treatment so the official chip remains visually dominant:

```css
.scheduler-layout .schedule-cell-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.availability-detail {
  position: relative;
  width: fit-content;
  max-width: 100%;
  margin-inline: auto;
}

.availability-detail > summary {
  list-style: none;
}

.availability-detail > summary::-webkit-details-marker {
  display: none;
}

.scheduler-layout .availability-hint {
  display: inline-flex;
  width: auto;
  max-width: 100%;
  min-height: 22px;
  align-items: center;
  justify-content: center;
  padding: 3px 7px;
  border: 1px solid rgba(93, 106, 99, 0.16);
  border-radius: 999px;
  color: #66706b;
  background: #f5f7f6;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
}

.scheduler-layout .availability-hint.matched {
  color: color-mix(in srgb, var(--shift-ink) 72%, #ffffff);
  background: color-mix(in srgb, var(--shift-bg) 55%, #ffffff);
  border-color: color-mix(in srgb, var(--shift-border) 45%, #ffffff);
}

.scheduler-layout .availability-hint.off {
  color: #746b68;
  background: #f7f4f3;
  border-color: #e3dad7;
}

.availability-popover {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  left: 50%;
  display: grid;
  width: max-content;
  max-width: 240px;
  gap: 4px;
  padding: 9px 10px;
  color: #3f4944;
  background: #ffffff;
  border: 1px solid #dce2df;
  border-radius: 9px;
  box-shadow: 0 10px 26px rgba(31, 43, 37, 0.14);
  transform: translateX(-50%);
  text-align: left;
}

.availability-detail:not([open]) .availability-popover {
  display: none;
}
```

If `color-mix()` conflicts with the app's browser support target during verification, replace those three matched declarations with existing CSS variables at reduced opacity using a pseudo/background wrapper; do not revert to semantic guessed colors.

- [ ] **Step 6: Run scheduler/matching tests and build**

Run:

```bash
npm test -- \
  src/scheduling/availabilityShiftMatch.test.ts \
  src/admin/ScheduleGrid.test.tsx \
  src/scheduling/availabilityNotice.test.ts
npm run build
```

Expected: PASS. `availabilityNotice.test.ts` confirms this visual change did not turn guidance into a blocking rule.

- [ ] **Step 7: Commit scheduler guidance UI**

```bash
git add \
  src/admin/ScheduleGrid.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/admin/AdminSchedule.css
git commit -m "feat: show synced registration guidance in scheduler"
```

---

### Task 6: Protect the End-to-End Weekly Flow in Focused CI

**Files:**
- Modify: `.github/workflows/port-scheduler-ci.yml`
- Modify as needed only for regression assertions: `src/admin/AdminMatrix.test.tsx`
- Modify as needed only for regression assertions: `src/employee/EmployeeRegistrationPage.test.ts`
- Reference/Test: `src/app/router.test.ts`

**Interfaces:**
- Consumes: all production behavior from Tasks 1-5.
- Produces: focused branch CI that runs the lifecycle and shift-matching tests on every push to `feat/port-schedulework-scheduler`.

- [ ] **Step 1: Add any missing direct same-source assertions**

In `src/admin/AdminMatrix.test.tsx`, ensure the rendered matrix maps an `AvailabilitySubmission.employee_id` to the matching employee row and week start, rather than synthesizing separate state.

In `src/employee/EmployeeRegistrationPage.test.ts`, retain or add the save-notify contract:

```ts
it("notifies the app only after the availability save succeeds", async () => {
  const events: string[] = [];
  await saveAvailabilityThenNotify(
    async () => {
      events.push("saved");
      return "result";
    },
    () => events.push("notified"),
  );
  expect(events).toEqual(["saved", "notified"]);
});
```

This protects `/app/my-schedule` refresh sequencing without adding a new state layer.

- [ ] **Step 2: Confirm the removed team schedule route remains absent**

Run:

```bash
npm test -- src/app/router.test.ts src/employee/EmployeeApp.test.tsx
```

Expected: PASS with no `/app/team-schedule` route restored.

- [ ] **Step 3: Add new files to the focused CI command**

Update `.github/workflows/port-scheduler-ci.yml` so `Scheduler focused tests` includes at least:

```yaml
          src/admin/WeekDialogs.test.tsx
          src/admin/registrationWeekUi.test.ts
          src/admin/employeePositions.test.ts
          src/admin/AdminMatrix.test.tsx
          src/employee/EmployeeRegistrationPage.test.ts
          src/employee/registrationWeekSelection.test.ts
          src/employee/scheduleApi.test.ts
          src/scheduling/availabilityShiftMatch.test.ts
```

Keep all existing focused test entries.

- [ ] **Step 4: Run the full flow-focused set locally**

Run:

```bash
npm test -- \
  src/app/router.test.ts \
  src/admin/employeePositions.test.ts \
  src/admin/registrationWeekUi.test.ts \
  src/admin/WeekDialogs.test.tsx \
  src/admin/AdminAvailabilityPage.test.tsx \
  src/admin/AdminSchedulePage.test.tsx \
  src/admin/AdminMatrix.test.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/employee/EmployeeRegistrationPage.test.ts \
  src/employee/registrationWeekSelection.test.ts \
  src/employee/scheduleApi.test.ts \
  src/lib/week.test.ts \
  src/scheduling/api.test.ts \
  src/scheduling/availabilityShiftMatch.test.ts \
  src/scheduling/availabilityNotice.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit CI protection**

```bash
git add \
  .github/workflows/port-scheduler-ci.yml \
  src/admin/AdminMatrix.test.tsx \
  src/employee/EmployeeRegistrationPage.test.ts
git commit -m "test: cover complete weekly scheduling flow"
```

Only include test files that actually changed in the `git add` command.

---

### Task 7: Final Verification and Manual Flow Checklist

**Files:**
- No production files should be introduced in this task.
- Verify all files changed by Tasks 1-6.

**Interfaces:**
- Consumes: complete implementation.
- Produces: evidence that tests, build, SQL checks, branch scope, and user-facing flow are coherent before claiming completion.

- [ ] **Step 1: Run the complete automated test suite**

```bash
npm test
```

Expected: all Vitest tests PASS.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: TypeScript build and Vite build succeed.

- [ ] **Step 3: Run existing Deno checks used by CI**

```bash
npx --yes deno@latest test \
  --config supabase/functions/deno.json \
  supabase/functions/_shared/*_test.ts

npx --yes deno@latest check \
  --config supabase/functions/deno.json \
  supabase/functions/admin-users/index.ts
```

Expected: PASS.

- [ ] **Step 4: Run whitespace and branch-scope checks**

```bash
git diff --check origin/main...HEAD
git status --short
git branch --show-current
```

Expected:

```text
feat/port-schedulework-scheduler
```

`git diff --check` must print no whitespace errors. Do not merge or push changes to `main`.

- [ ] **Step 5: Apply the migration only in the intended development Supabase environment, then perform the deletion smoke test**

When the engineer has the correct Supabase project selected and is intentionally ready to mutate that development database, run:

```bash
npx supabase db push
```

Then smoke-test with disposable data:

1. Create a registration week beginning on a Monday.
2. Submit one employee registration for that week.
3. Open `/admin/availability?week=YYYY-MM-DD` and confirm the same registration appears.
4. Click `Xếp lịch tuần này`; confirm `/admin/schedule?week=YYYY-MM-DD` opens.
5. Create the schedule week explicitly.
6. Confirm a matching registered interval uses the configured shift color/label in a lighter pill below official shifts.
7. Confirm an unmatched interval is neutral.
8. Confirm `ĐK · Nghỉ` opens its reason in the read-only detail popover.
9. Add one official shift and confirm the registration pill remains below it.
10. Export JPG if desired.
11. Archive the registration week and confirm it moves into the collapsed `Tuần đã lưu trữ` section.
12. Delete that archived week and confirm the styled dialog says registrations and official schedule will both be deleted.
13. Confirm the success toast appears.
14. Confirm the week disappears from registration weeks, availability, schedule selection, and employee registration/my-schedule selection.
15. Confirm unrelated weeks remain intact.

Do not run this smoke test against production data without explicit intent.

- [ ] **Step 6: Verify GitHub Actions for the final feature-branch commit**

After pushing the final `feat/port-schedulework-scheduler` commit, inspect the `Port scheduler CI` run and require all steps to succeed:

```text
npm ci
Scheduler focused tests
Full test suite
Build
Deno shared tests
Deno admin-users typecheck
Diff whitespace check
```

- [ ] **Step 7: Report completion without merging**

The completion report must state:

```text
- branch: feat/port-schedulework-scheduler
- main was not modified by the implementation work
- employee/position linkage audit result
- week/timezone audit result
- employee -> my-schedule -> admin availability -> admin scheduler flow result
- atomic week deletion result
- archive UI result
- registration pill exact-match/neutral/OFF result
- automated test/build/CI evidence
- whether the Supabase migration has or has not been applied to the user's target environment
```

Do not create or merge a PR unless the user explicitly asks.
