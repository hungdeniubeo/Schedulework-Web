# Scheduling Flow Audit and Week Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing weekly scheduling flow so employee/position data stays consistent, registration dates and deadlines remain exact, employee submissions flow through all views, scheduler guidance is low-noise and synchronized with configured shifts, and deleting a week atomically removes the entire online workflow.

**Architecture:** Keep the existing Supabase-backed domain model and treat `registration_weeks` and `schedule_weeks` with the same `week_start` as one lifecycle without merging their tables. Add one Admin-only PostgreSQL RPC for atomic deletion, keep `availability_submissions` as the shared registration source of truth, add a pure exact-match helper for availability versus configured shifts, and make targeted UI changes in week management and scheduler cells. Preserve already-correct behavior rather than refactoring it.

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

### Create

- `supabase/migrations/202609160001_delete_registration_workflow.sql` — Admin-only transactional RPC that removes the matching schedule workflow and registration workflow by registration-week id.
- `src/scheduling/availabilityShiftMatch.ts` — pure exact-match helper between employee availability intervals and configured `ShiftType` ranges.
- `src/scheduling/availabilityShiftMatch.test.ts` — exact, split, unmatched, invalid, and OFF matching coverage.
- `src/admin/WeekDialogs.test.tsx` — destructive week-delete dialog copy/structure coverage.

### Modify

- `src/admin/api.ts`
- `src/admin/api.test.ts`
- `src/admin/AdminDashboard.tsx`
- `src/admin/adminWeekSelection.ts`
- `src/admin/adminWeekSelection.test.ts`
- `src/admin/WeekManager.tsx`
- `src/admin/WeekDialogs.tsx`
- `src/admin/RegistrationWeeks.css`
- `src/admin/registrationWeekUi.ts`
- `src/admin/registrationWeekUi.test.ts`
- `src/admin/ScheduleGrid.tsx`
- `src/admin/ScheduleGrid.test.tsx`
- `src/admin/AdminSchedule.css`
- `.github/workflows/port-scheduler-ci.yml`

### Audit without unnecessary production changes

The following already contain meaningful coverage and should remain unchanged unless the audit exposes a real bug:

- `src/admin/employeePositions.test.ts`
- `src/admin/EmployeeManager.test.tsx`
- `src/scheduling/api.test.ts`
- `src/lib/week.test.ts`
- `src/employee/registrationWeekSelection.test.ts`
- `src/employee/scheduleApi.test.ts`
- `src/employee/EmployeeRegistrationPage.test.ts`
- `src/admin/AdminAvailabilityPage.test.tsx`
- `src/admin/AdminSchedulePage.test.tsx`
- `src/admin/AdminMatrix.test.tsx`
- `src/app/router.test.ts`

---

### Task 1: Baseline Audit Gate — Prove Existing Flow Before Changing It

**Files:**
- Test only: existing audit files listed above
- No production modifications in this task

**Interfaces:**
- Consumes: existing employee/position helpers, soft-delete API, week helpers, employee schedule loaders, admin availability/schedule page behavior.
- Produces: evidence that the already-correct parts of the spec do not need refactoring.

- [ ] **Step 1: Run employee/position and soft-delete coverage**

```bash
npm test -- \
  src/admin/employeePositions.test.ts \
  src/admin/EmployeeManager.test.tsx \
  src/scheduling/api.test.ts
```

Expected: PASS, including position rename/assignment propagation, assigned-position delete protection, operational exclusion of soft-deleted employees, and history-aware published employee loading.

- [ ] **Step 2: Run week/date/time coverage**

```bash
npm test -- \
  src/lib/week.test.ts \
  src/employee/registrationWeekSelection.test.ts
```

Expected: PASS, including Monday validation, Monday-Sunday display, Friday 22:00 default deadline, exact lock boundary, and `Asia/Ho_Chi_Minh` conversion.

- [ ] **Step 3: Run employee-registration shared-data coverage**

```bash
npm test -- \
  src/employee/EmployeeRegistrationPage.test.ts \
  src/employee/scheduleApi.test.ts \
  src/admin/AdminMatrix.test.tsx
```

Expected: PASS, including notify-after-save sequencing, same-week `my-schedule` selection, and admin matrix rendering from `AvailabilitySubmission` data.

- [ ] **Step 4: Run admin route/explicit schedule creation coverage**

```bash
npm test -- \
  src/admin/AdminAvailabilityPage.test.tsx \
  src/admin/AdminSchedulePage.test.tsx \
  src/admin/adminWeekSelection.test.ts \
  src/app/router.test.ts
```

Expected: PASS, including explicit `Tạo lịch tuần này` behavior and continued absence of `/app/team-schedule`.

If any baseline test fails, stop implementation and fix that concrete bug first with TDD. Do not rewrite passing flows merely for consistency.

---

### Task 2: Add Atomic Full-Week Deletion and Route Admin Delete Through It

**Files:**
- Create: `supabase/migrations/202609160001_delete_registration_workflow.sql`
- Modify: `src/admin/api.ts`
- Modify/Test: `src/admin/api.test.ts`

**Interfaces:**
- Consumes: existing `private.is_admin()`, `registration_weeks.week_start`, `schedule_weeks -> schedule_entries` cascade, `registration_weeks -> availability_submissions` cascade.
- Produces: `public.delete_registration_workflow(target_registration_week_id uuid) returns date`; `deleteWeek(id: string): Promise<void>` keeps its current TypeScript signature.

- [ ] **Step 1: Replace the old direct-delete test with a failing RPC contract test**

In `src/admin/api.test.ts`, replace the current `deletes a registration week by id` test with:

```ts
it("deletes the complete weekly workflow through the transactional RPC", async () => {
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

Add error coverage:

```ts
it("surfaces atomic delete failure without falling back to direct deletes", async () => {
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

- [ ] **Step 2: Run the API test and verify RED**

```bash
npm test -- src/admin/api.test.ts
```

Expected: FAIL because `deleteWeek` still calls `.from("registration_weeks").delete()`.

- [ ] **Step 3: Add the transactional Admin-only PostgreSQL function**

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

  delete from public.schedule_weeks
  where week_start = target_week_start;

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

The function call is one PostgreSQL transaction. Deleting `schedule_weeks` cascades to `schedule_entries`; deleting `registration_weeks` cascades to `availability_submissions`. Any exception rolls back both deletes.

- [ ] **Step 4: Replace the frontend direct delete with the RPC**

Change `src/admin/api.ts`:

```ts
export async function deleteWeek(id: string): Promise<void> {
  const { error } = await getSupabase().rpc("delete_registration_workflow", {
    target_registration_week_id: id,
  });
  fail(error, "Không xóa được toàn bộ dữ liệu tuần đăng ký.");
}
```

Do not add a direct-delete fallback.

- [ ] **Step 5: Run API tests and SQL lint**

```bash
npm test -- src/admin/api.test.ts
npx supabase db lint
```

Expected: frontend test PASS; SQL lint reports no new migration error. If local Supabase services are unavailable, record that the SQL lint step could not connect; do not apply the migration to a remote database during this implementation task.

- [ ] **Step 6: Commit**

```bash
git add \
  supabase/migrations/202609160001_delete_registration_workflow.sql \
  src/admin/api.ts \
  src/admin/api.test.ts
git commit -m "feat: delete complete weekly workflow atomically"
```

---

### Task 3: Separate Archived Weeks and Redesign Full-Delete Confirmation/Toast

**Files:**
- Modify: `src/admin/registrationWeekUi.ts`
- Modify/Test: `src/admin/registrationWeekUi.test.ts`
- Modify: `src/admin/adminWeekSelection.ts`
- Modify/Test: `src/admin/adminWeekSelection.test.ts`
- Modify: `src/admin/WeekManager.tsx`
- Modify: `src/admin/WeekDialogs.tsx`
- Create/Test: `src/admin/WeekDialogs.test.tsx`
- Modify: `src/admin/RegistrationWeeks.css`
- Modify: `src/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: unchanged `onDelete(id): Promise<void>`, `onUpdate(id, changes)`, `RegistrationWeek.status`.
- Produces: `partitionRegistrationWeeks(weeks)`, archived-week exclusion from active URL selection, independent delete target, success toast.

- [ ] **Step 1: Write failing active/archive partition tests**

Add to `src/admin/registrationWeekUi.test.ts`:

```ts
import { partitionRegistrationWeeks } from "./registrationWeekUi";

it("keeps archived weeks out of the primary management list", () => {
  const open = { ...existingWeek, id: "open", status: "open" as const };
  const locked = {
    ...existingWeek,
    id: "locked",
    week_start: "2026-10-05",
    status: "locked" as const,
  };
  const archived = {
    ...existingWeek,
    id: "archived",
    week_start: "2026-09-21",
    status: "archived" as const,
  };

  const result = partitionRegistrationWeeks([open, locked, archived]);
  expect(result.active.map((week) => week.id)).toEqual(["open", "locked"]);
  expect(result.archived.map((week) => week.id)).toEqual(["archived"]);
});
```

- [ ] **Step 2: Write failing archived-query selection test**

In `src/admin/adminWeekSelection.test.ts`, add:

```ts
it("does not treat an archived week as an active requested admin week", () => {
  const archived = {
    ...week("archived", "2026-09-21"),
    status: "archived" as const,
  };
  const result = resolveAdminRegistrationWeek(
    [archived],
    archived.week_start,
  );
  expect(result).toEqual({ week: null, invalidRequestedWeek: true });
});
```

Use the test file's existing `week(...)` fixture shape.

- [ ] **Step 3: Write the destructive dialog render test**

Create `src/admin/WeekDialogs.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeleteWeekDialog } from "./WeekDialogs";

it("states that employee registrations and the official schedule are both deleted", () => {
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

- [ ] **Step 4: Run lifecycle UI tests and verify RED**

```bash
npm test -- \
  src/admin/registrationWeekUi.test.ts \
  src/admin/adminWeekSelection.test.ts \
  src/admin/WeekDialogs.test.tsx
```

Expected: FAIL because the partition helper/new dialog copy/archived URL rule are not implemented.

- [ ] **Step 5: Implement week partition and active requested-week rule**

Add to `src/admin/registrationWeekUi.ts`:

```ts
export function partitionRegistrationWeeks(weeks: RegistrationWeek[]) {
  return {
    active: weeks.filter((week) => week.status !== "archived"),
    archived: weeks.filter((week) => week.status === "archived"),
  };
}
```

Keep `registrationWeekActionState(...).canDelete === true` for archived weeks.

Change the requested-week branch in `resolveAdminRegistrationWeek`:

```ts
if (requestedWeekStart) {
  const week =
    weeks.find(
      (item) =>
        item.week_start === requestedWeekStart && item.status !== "archived",
    ) ?? null;
  return { week, invalidRequestedWeek: week === null };
}
```

This keeps archived weeks out of `/admin/availability` and `/admin/schedule` active-week flows while they remain visible/deletable in the independent archived list.

- [ ] **Step 6: Refactor `WeekManager` to use active weeks for the primary selector and archived weeks for a collapsed list**

Use:

```ts
const { active: activeWeeks, archived: archivedWeeks } =
  partitionRegistrationWeeks(weeks);
const selected = activeWeeks.find((week) => week.id === selectedId) ?? null;
const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
const [deleteTarget, setDeleteTarget] = useState<RegistrationWeek | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
```

Primary `CustomSelect` options must use `activeWeeks` only.

Render archived weeks below the primary manager:

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

The active selected week's delete button also calls `setDeleteTarget(selected)`.

- [ ] **Step 7: Add success toast behavior in `WeekManager`**

Import `useEffect` and `formatWeekRange`, then add:

```ts
useEffect(() => {
  if (!successMessage) return;
  const timer = window.setTimeout(() => setSuccessMessage(null), 2600);
  return () => window.clearTimeout(timer);
}, [successMessage]);
```

Pass a wrapper to the single delete dialog:

```tsx
{deleteTarget && (
  <DeleteWeekDialog
    week={deleteTarget}
    busy={busy}
    onClose={() => setDeleteTarget(null)}
    onDelete={async (id) => {
      const range = formatWeekRange(deleteTarget.week_start);
      await onDelete(id);
      setDeleteTarget(null);
      setSuccessMessage(
        `Đã xóa tuần ${range} và toàn bộ dữ liệu liên quan.`,
      );
    }}
  />
)}
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

- [ ] **Step 8: Replace delete dialog copy/visual structure**

In `WeekDialogs.tsx`, keep dismissal disabled while `busy` and render:

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
  {error && <div className="inline-error" role="alert">{error}</div>}
  <footer>
    <button className="button secondary" type="button" ...>Hủy</button>
    <button className="button danger" type="button" ...>
      {busy ? "Đang xóa..." : "Xóa toàn bộ tuần"}
    </button>
  </footer>
</section>
```

Use the existing concrete `disabled`, `autoFocus`, `onClick`, and `onClose` handlers from the current dialog; only the copy/classes/button label change.

- [ ] **Step 9: Navigate away after archiving the selected week**

In `AdminDashboard.tsx`, change `patchWeek` so archiving the selected week refreshes and resolves the next valid non-archived week:

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

Keep the current post-delete fallback logic; Task 2 changes only the backend operation it invokes.

- [ ] **Step 10: Add restrained archive/dialog/toast styles**

In `RegistrationWeeks.css`, add:

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

- [ ] **Step 11: Run tests/build and commit**

```bash
npm test -- \
  src/admin/registrationWeekUi.test.ts \
  src/admin/adminWeekSelection.test.ts \
  src/admin/WeekDialogs.test.tsx \
  src/admin/AdminDashboard.test.tsx
npm run build

git add \
  src/admin/registrationWeekUi.ts \
  src/admin/registrationWeekUi.test.ts \
  src/admin/adminWeekSelection.ts \
  src/admin/adminWeekSelection.test.ts \
  src/admin/WeekManager.tsx \
  src/admin/WeekDialogs.tsx \
  src/admin/WeekDialogs.test.tsx \
  src/admin/RegistrationWeeks.css \
  src/admin/AdminDashboard.tsx
git commit -m "feat: streamline registration week lifecycle"
```

Expected: tests/build PASS.

---

### Task 4: Add Exact Availability-to-Configured-Shift Matching

**Files:**
- Create: `src/scheduling/availabilityShiftMatch.ts`
- Create/Test: `src/scheduling/availabilityShiftMatch.test.ts`

**Interfaces:**
- Consumes: `getIntervals(day)`, `clockToMinutes(value)`, `shiftRangesFromLabel(label)`, `ShiftType`.
- Produces: `findExactShiftForAvailability(day, shifts): ShiftType | null`.

- [ ] **Step 1: Write failing tests**

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
    expect(findExactShiftForAvailability(createPresetDay("morning"), shifts)?.id)
      .toBe("morning");
  });

  it("matches split intervals across h and colon label formats", () => {
    expect(findExactShiftForAvailability(createPresetDay("full"), shifts)?.id)
      .toBe("split");
  });

  it("does not guess a nearby shift", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning_afternoon");
    expect(findExactShiftForAvailability(availability.days["1"], shifts))
      .toBeNull();
  });

  it("never matches OFF", () => {
    expect(findExactShiftForAvailability(createEmptyAvailability().days["1"], shifts))
      .toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/scheduling/availabilityShiftMatch.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement normalized exact range equality**

Create `src/scheduling/availabilityShiftMatch.ts`:

```ts
import { getIntervals } from "../lib/availability";
import type { DayAvailability } from "../types/domain";
import { clockToMinutes, shiftRangesFromLabel } from "./shiftStyle";
import type { ShiftType } from "./types";

type Range = { start: number; end: number };

function availabilityRanges(day: DayAvailability): Range[] {
  return getIntervals(day).flatMap(({ start, end }) => {
    const startMinutes = clockToMinutes(start);
    const endMinutes = clockToMinutes(end);
    return startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
      ? [{ start: startMinutes, end: endMinutes }]
      : [];
  });
}

function sorted(ranges: readonly Range[]): Range[] {
  return [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
}

function sameRanges(left: readonly Range[], right: readonly Range[]): boolean {
  if (left.length === 0 || left.length !== right.length) return false;
  const first = sorted(left);
  const second = sorted(right);
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
  return shifts.find(
    (shift) => sameRanges(source, shiftRangesFromLabel(shift.label)),
  ) ?? null;
}
```

- [ ] **Step 4: Run and verify GREEN**

```bash
npm test -- \
  src/scheduling/availabilityShiftMatch.test.ts \
  src/scheduling/shiftStyle.test.ts \
  src/lib/availability.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  src/scheduling/availabilityShiftMatch.ts \
  src/scheduling/availabilityShiftMatch.test.ts
git commit -m "feat: match registration intervals to configured shifts"
```

---

### Task 5: Render Official Shifts First and the Registration Pill Below

**Files:**
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify/Test: `src/admin/ScheduleGrid.test.tsx`
- Modify: `src/admin/AdminSchedule.css`

**Interfaces:**
- Consumes: `findExactShiftForAvailability`, `formatAvailabilityCell`, `getOffReason`, `formatShiftLabel`, `resolvedShiftColor`, `shiftStyle`.
- Produces: `.official-shifts` before `.availability-detail`; `.availability-hint.matched|neutral|off`; read-only click detail via native `<details>`.

- [ ] **Step 1: Add failing DOM-order and visual-source tests**

Extend `src/admin/ScheduleGrid.test.tsx`:

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

Add exact-match coverage using the existing `17:00-23:00` shift fixture:

```ts
it("uses the configured shift source for an exact registration match", () => {
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

Add unmatched neutral coverage:

```ts
it("uses a neutral pill when no configured shift matches exactly", () => {
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

Update the existing OFF test to require `availability-hint off`, compact `ĐK · Nghỉ`, and the full reason inside `availability-popover`.

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/admin/ScheduleGrid.test.tsx
```

Expected: FAIL because registration currently renders before official shifts and does not use matched/neutral detail structure.

- [ ] **Step 3: Compute matched/neutral/OFF registration presentation**

Import:

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

Do not use `semanticShiftColor(...)` for unmatched registration pills.

- [ ] **Step 4: Move registration UI below official shifts and make it read-only clickable detail**

Inside `.schedule-cell-stack`, render the existing `.official-shifts` block first, then:

```tsx
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

Do not add edit/save/delete callbacks to this detail.

- [ ] **Step 5: Style the pill as visually subordinate but preserve configured color identity**

In `AdminSchedule.css`:

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
  color: #66706b;
  background: #f5f7f6;
  border: 1px solid rgba(93, 106, 99, 0.16);
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
}

.scheduler-layout .availability-hint.matched {
  color: var(--shift-ink);
  background: var(--shift-bg);
  border-color: var(--shift-border);
  opacity: 0.68;
  filter: saturate(0.72);
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
  background: #fff;
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

Keep official shift chip opacity at its current full-strength value.

- [ ] **Step 6: Run scheduler tests/build and commit**

```bash
npm test -- \
  src/scheduling/availabilityShiftMatch.test.ts \
  src/admin/ScheduleGrid.test.tsx \
  src/scheduling/availabilityNotice.test.ts
npm run build

git add \
  src/admin/ScheduleGrid.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/admin/AdminSchedule.css
git commit -m "feat: show synced registration guidance in scheduler"
```

Expected: PASS; availability guidance remains non-blocking.

---

### Task 6: Focused CI and Final Verification

**Files:**
- Modify: `.github/workflows/port-scheduler-ci.yml`
- No unrelated production changes

**Interfaces:**
- Consumes: complete implementation from Tasks 2-5 and baseline audit from Task 1.
- Produces: focused CI coverage and completion evidence without merging to `main`.

- [ ] **Step 1: Add new lifecycle/matching tests to focused CI**

Keep every existing focused test and add:

```yaml
          src/admin/api.test.ts
          src/admin/registrationWeekUi.test.ts
          src/admin/WeekDialogs.test.tsx
          src/admin/employeePositions.test.ts
          src/admin/AdminMatrix.test.tsx
          src/employee/EmployeeRegistrationPage.test.ts
          src/employee/registrationWeekSelection.test.ts
          src/employee/scheduleApi.test.ts
          src/scheduling/availabilityShiftMatch.test.ts
```

- [ ] **Step 2: Run focused flow tests**

```bash
npm test -- \
  src/app/router.test.ts \
  src/admin/api.test.ts \
  src/admin/employeePositions.test.ts \
  src/admin/registrationWeekUi.test.ts \
  src/admin/adminWeekSelection.test.ts \
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

- [ ] **Step 3: Run full repository verification**

```bash
npm test
npm run build
npx --yes deno@latest test \
  --config supabase/functions/deno.json \
  supabase/functions/_shared/*_test.ts
npx --yes deno@latest check \
  --config supabase/functions/deno.json \
  supabase/functions/admin-users/index.ts
git diff --check origin/main...HEAD
git branch --show-current
```

Expected branch:

```text
feat/port-schedulework-scheduler
```

Do not merge or update `main`.

- [ ] **Step 4: Commit CI update**

```bash
git add .github/workflows/port-scheduler-ci.yml
git commit -m "test: protect complete weekly scheduling flow"
```

- [ ] **Step 5: Apply the migration only when intentionally targeting the development Supabase project**

After confirming the selected Supabase project is the intended development environment:

```bash
npx supabase db push
```

Then perform this disposable-data smoke test:

1. Create a Monday-start registration week.
2. Confirm employee `/app/availability` shows the exact Monday-Sunday range and Vietnam-time deadline.
3. Submit one employee registration.
4. Confirm `/app/my-schedule` shows that same registration.
5. Confirm `/admin/availability?week=YYYY-MM-DD` shows the same registration.
6. Click `Xếp lịch tuần này` and confirm `/admin/schedule?week=YYYY-MM-DD`.
7. Confirm the schedule week is not created until Admin clicks `Tạo lịch tuần này`.
8. Confirm an exact registered interval reuses the configured shift label/color in a lighter pill below official shifts.
9. Confirm an unmatched interval is neutral.
10. Confirm `ĐK · Nghỉ` opens its full reason read-only.
11. Add an official shift and confirm it remains above the registration pill.
12. Archive the week and confirm it moves to collapsed `Tuần đã lưu trữ`.
13. Delete the archived week and confirm the styled dialog warns that registrations and the official schedule will both be deleted.
14. Confirm the success toast appears.
15. Confirm the week disappears from registration management, admin availability, admin schedule selection, employee registration selection, and employee my-schedule selection.
16. Confirm an unrelated week remains intact.

Do not run the destructive smoke test against production data without explicit intent.

- [ ] **Step 6: Verify the final GitHub Actions run**

After the final feature-branch push, require every `Port scheduler CI` step to succeed:

```text
npm ci
Scheduler focused tests
Full test suite
Build
Deno shared tests
Deno admin-users typecheck
Diff whitespace check
```

- [ ] **Step 7: Completion report**

Report these facts explicitly:

```text
branch: feat/port-schedulework-scheduler
main modified by implementation: no
employee/position audit: pass/fail with evidence
week/timezone audit: pass/fail with evidence
employee -> my-schedule -> admin availability -> admin scheduler: pass/fail with evidence
atomic week deletion: pass/fail with evidence
archive UI: pass/fail with evidence
registration pill exact-match/neutral/OFF: pass/fail with evidence
automated tests/build/CI: exact results
Supabase migration applied to target environment: yes/no
```

Do not create or merge a PR unless the user explicitly asks.
