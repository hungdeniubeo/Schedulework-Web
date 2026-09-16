# Scheduler Reference Parity and Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the proven compact ScheduleWork scheduler presentation into `/admin/schedule`, remove publication from the user-facing flow, and keep Employee/Admin availability state fresh without manual reloads.

**Architecture:** Keep Supabase APIs and existing scheduling-domain helpers authoritative. Add one reusable page-activity refresh primitive, isolate employee portal refresh reconciliation, replace the interactive admin table markup with a legacy-parity presentational table plus separate daily summary, and keep `ScheduleGrid` responsible for DnD/interaction rather than persistence. Legacy `schedule_weeks.status` remains in the database; mutations normalize legacy non-draft rows to `draft` only when required by current RLS.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase/PostgREST, `@dnd-kit/core`, existing CSS modules/files, existing `html-to-image`/JPG export path.

**Spec:** `docs/superpowers/specs/2026-09-16-scheduler-reference-parity-and-refresh-design.md`

## Global Constraints

- All implementation changes stay on `feat/port-schedulework-scheduler`; do not modify or merge `main`.
- Do not restore `/app/team-schedule`.
- Do not add auto-scheduling/AI scheduling.
- Do not add a new state-management library or UI framework.
- `Schedulework` is the visual/interaction reference; `Schedulework-Web` Supabase data and domain helpers remain authoritative.
- Availability remains advisory and must never block a valid official assignment.
- No user-facing `Công bố lịch`, `Bản nháp`, or `Đã công bố` controls/copy remain in `/admin/schedule`.
- Do not drop legacy database schedule status values in this change.
- Route/query `?week=YYYY-MM-DD` remains the only week-navigation source of truth for the web scheduler.
- Export must exclude `ĐK` guidance, drag handles, delete controls, filters, palette, and transient notices.

---

### Task 1: Add a reusable focus/visibility/interval refresh primitive

**Files:**
- Create: `src/lib/pageRefresh.ts`
- Create: `src/lib/pageRefresh.test.ts`

**Interfaces:**
- Produces: `subscribePageRefresh(refresh: () => void, options?: { intervalMs?: number }): () => void`
- Consumers: `EmployeeRegistrationPage`, `MySchedulePage`, and `AdminScheduler` in later tasks.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/pageRefresh.test.ts` with deterministic DOM-event coverage:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribePageRefresh } from "./pageRefresh";

afterEach(() => {
  vi.useRealTimers();
});

describe("subscribePageRefresh", () => {
  it("refreshes when the window regains focus", () => {
    const refresh = vi.fn();
    const unsubscribe = subscribePageRefresh(refresh);
    window.dispatchEvent(new Event("focus"));
    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("refreshes when a hidden document becomes visible", () => {
    const refresh = vi.fn();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");
    const unsubscribe = subscribePageRefresh(refresh);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
    visibility.mockRestore();
  });

  it("runs the interval only while the document is visible", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");
    const unsubscribe = subscribePageRefresh(refresh, { intervalMs: 15_000 });
    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("hidden");
    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
    visibility.mockRestore();
  });

  it("removes listeners and timer on unsubscribe", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const unsubscribe = subscribePageRefresh(refresh, { intervalMs: 15_000 });
    unsubscribe();
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(30_000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/lib/pageRefresh.test.ts
```

Expected: FAIL because `./pageRefresh` does not exist.

- [ ] **Step 3: Implement the minimal subscription helper**

Create `src/lib/pageRefresh.ts`:

```ts
export function subscribePageRefresh(
  refresh: () => void,
  options: { intervalMs?: number } = {},
): () => void {
  const onFocus = () => refresh();
  const onVisibility = () => {
    if (document.visibilityState === "visible") refresh();
  };

  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);

  const timer = options.intervalMs
    ? window.setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, options.intervalMs)
    : null;

  return () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    if (timer !== null) window.clearInterval(timer);
  };
}
```

- [ ] **Step 4: Run the focused test and full type/build safety check**

Run:

```bash
npm test -- src/lib/pageRefresh.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pageRefresh.ts src/lib/pageRefresh.test.ts
git commit -m "feat: add page activity refresh helper"
```

---

### Task 2: Refresh Employee registration lifecycle without clobbering same-week edits

**Files:**
- Create: `src/employee/employeePortalRefresh.ts`
- Create: `src/employee/employeePortalRefresh.test.ts`
- Modify: `src/employee/EmployeeRegistrationPage.tsx`
- Modify: `src/employee/EmployeeRegistrationPage.test.ts`

**Interfaces:**
- Consumes: `subscribePageRefresh()` from Task 1, existing `EmployeePortalData`, draft-storage helpers, `normalizeAvailability`, `createEmptyAvailability`, `isRegistrationLocked`.
- Produces: `reconcileEmployeePortalRefresh(...)` pure decision helper and a page-level `refreshPortal()` callback.

- [ ] **Step 1: Write reconciliation tests first**

Create `src/employee/employeePortalRefresh.test.ts` around this interface:

```ts
import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import type { EmployeePortalData } from "../types/domain";
import { reconcileEmployeePortalRefresh } from "./employeePortalRefresh";

const portal = (weekId: string, locked = false): EmployeePortalData => ({
  employee: { id: "employee-1", name: "Hùng", active: true },
  week: {
    id: weekId,
    weekStart: weekId === "week-1" ? "2026-09-21" : "2026-09-28",
    lockAt: "2099-09-18T15:00:00.000Z",
    status: locked ? "locked" : "open",
    locked,
  },
  submission: null,
});

describe("reconcileEmployeePortalRefresh", () => {
  it("preserves unsaved edits when the same editable week is refreshed", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning");
    const result = reconcileEmployeePortalRefresh({
      currentContext: portal("week-1"),
      currentAvailability: availability,
      hasDraft: true,
      nextContext: portal("week-1"),
      nextDraft: null,
      now: new Date("2026-09-16T00:00:00Z"),
    });
    expect(result.availability).toBe(availability);
    expect(result.hasDraft).toBe(true);
  });

  it("replaces local edits when the same week becomes locked", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning");
    const result = reconcileEmployeePortalRefresh({
      currentContext: portal("week-1"),
      currentAvailability: availability,
      hasDraft: true,
      nextContext: portal("week-1", true),
      nextDraft: null,
      now: new Date("2026-09-16T00:00:00Z"),
    });
    expect(result.hasDraft).toBe(false);
    expect(result.availability.days["1"].status).toBe("off");
  });

  it("switches to the replacement week when lifecycle selection changes", () => {
    const result = reconcileEmployeePortalRefresh({
      currentContext: portal("week-1"),
      currentAvailability: createEmptyAvailability(),
      hasDraft: false,
      nextContext: portal("week-2"),
      nextDraft: null,
      now: new Date("2026-09-16T00:00:00Z"),
    });
    expect(result.context.week.id).toBe("week-2");
    expect(result.hasDraft).toBe(false);
  });
});
```

The implementation may use `nextContext.submission` plus `nextDraft` to choose the new-week initial value, but same-week editable refresh must preserve the exact current `Availability` object.

- [ ] **Step 2: Run the new test and verify RED**

```bash
npm test -- src/employee/employeePortalRefresh.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement `reconcileEmployeePortalRefresh`**

Create `src/employee/employeePortalRefresh.ts` with this signature:

```ts
export function reconcileEmployeePortalRefresh(input: {
  currentContext: EmployeePortalData | null;
  currentAvailability: Availability;
  hasDraft: boolean;
  nextContext: EmployeePortalData;
  nextDraft: Availability | null;
  now: Date;
}): {
  context: EmployeePortalData;
  availability: Availability;
  hasDraft: boolean;
  shouldClearDraft: boolean;
}
```

Decision order:

```ts
const sameWeek = input.currentContext?.week.id === input.nextContext.week.id;
const locked =
  input.nextContext.week.locked ||
  isRegistrationLocked(
    input.nextContext.week.status,
    input.nextContext.week.lockAt,
    input.now,
  );

if (sameWeek && !locked) {
  return {
    context: input.nextContext,
    availability: input.currentAvailability,
    hasDraft: input.hasDraft,
    shouldClearDraft: false,
  };
}

const submitted = input.nextContext.submission
  ? normalizeAvailability(input.nextContext.submission.availability)
  : createEmptyAvailability();
const selected = selectAvailabilityDraft(submitted, locked ? null : input.nextDraft, locked);

return {
  context: input.nextContext,
  availability: selected.availability,
  hasDraft: selected.restored,
  shouldClearDraft: locked || Boolean(input.nextDraft && !selected.restored),
};
```

- [ ] **Step 4: Refactor `EmployeeRegistrationPage` to use one initial load and one safe refresh callback**

In `EmployeeRegistrationPage.tsx`:

1. Extract the current portal-load side effects into an internal `applyPortalData(nextContext, mode)` function.
2. Add `refreshPortal()` using `loadEmployeePortal(employee)` and `reconcileEmployeePortalRefresh`.
3. Guard refresh with both `savingRef.current` and a `refreshingRef` so focus + visibility cannot create concurrent requests.
4. Subscribe after initial mount:

```ts
useEffect(() => {
  return subscribePageRefresh(() => {
    if (!savingRef.current) void refreshPortal();
  });
}, [refreshPortal]);
```

5. Clear stale `error` when refresh succeeds.
6. Change the empty/error `AppState` action from logout-only to a retry action; keep logout accessible through the existing Employee shell/navigation rather than using it as the only recovery action.

The retry action must be:

```ts
action={{ label: "Thử lại", onClick: () => void refreshPortal() }}
```

- [ ] **Step 5: Extend `EmployeeRegistrationPage.test.ts`**

Add focused tests for public helper behavior that can be exercised without mounting the whole app:

```ts
it("does not begin a lifecycle refresh while a save is active", () => {
  // Test the extracted boolean helper if introduced, or keep this assertion in
  // employeePortalRefresh.test.ts by exposing `canRefreshEmployeePortal`.
});
```

If a helper is introduced, use this exact API:

```ts
export function canRefreshEmployeePortal(saving: boolean, refreshing: boolean) {
  return !saving && !refreshing;
}
```

and assert all four boolean combinations.

- [ ] **Step 6: Run employee-focused tests**

```bash
npm test -- \
  src/employee/employeePortalRefresh.test.ts \
  src/employee/EmployeeRegistrationPage.test.ts \
  src/employee/registrationWeekSelection.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/employee/employeePortalRefresh.ts src/employee/employeePortalRefresh.test.ts src/employee/EmployeeRegistrationPage.tsx src/employee/EmployeeRegistrationPage.test.ts
git commit -m "feat: refresh employee registration lifecycle"
```

---

### Task 3: Refresh My Schedule when the employee returns to the tab

**Files:**
- Modify: `src/employee/ScheduleViews.tsx`
- Modify: `src/employee/scheduleApi.test.ts` or create `src/employee/ScheduleViews.test.tsx` if component-level coverage is clearer

**Interfaces:**
- Consumes: `subscribePageRefresh()` from Task 1 and existing `loadMyScheduleData(employeeId)`.
- Produces: `useMySchedule` refetches on focus/visibility while preserving `submissionRevision` immediate refresh behavior.

- [ ] **Step 1: Add a testable request-generation helper**

In `ScheduleViews.tsx`, replace `myScheduleRequestKey` with an explicit generation key:

```ts
export function myScheduleRequestKey(
  employeeId: string,
  submissionRevision: number,
  refreshRevision = 0,
): string {
  return `${employeeId}:${submissionRevision}:${refreshRevision}`;
}
```

Add tests:

```ts
expect(myScheduleRequestKey("e1", 2, 0)).toBe("e1:2:0");
expect(myScheduleRequestKey("e1", 2, 1)).not.toBe(
  myScheduleRequestKey("e1", 2, 0),
);
```

- [ ] **Step 2: Verify RED before changing the helper**

```bash
npm test -- src/employee/scheduleApi.test.ts
```

If those helper tests live in a new `ScheduleViews.test.tsx`, run that file instead. Expected: FAIL on the new third argument behavior.

- [ ] **Step 3: Add focus/visibility refresh to `useMySchedule`**

Use local state:

```ts
const [refreshRevision, setRefreshRevision] = useState(0);
const requestKey = myScheduleRequestKey(
  employeeId,
  submissionRevision,
  refreshRevision,
);

useEffect(
  () => subscribePageRefresh(() => setRefreshRevision((value) => value + 1)),
  [],
);
```

Keep the existing request cancellation (`active` boolean) and error reset. Do not add interval polling to My Schedule.

- [ ] **Step 4: Run My Schedule tests**

```bash
npm test -- src/employee/scheduleApi.test.ts src/employee/EmployeeRegistrationPage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/employee/ScheduleViews.tsx src/employee/scheduleApi.test.ts src/employee/ScheduleViews.test.tsx
git commit -m "feat: refresh my schedule on page activity"
```

Only add paths that exist after implementation.

---

### Task 4: Refresh scheduler `ĐK` data independently and remove publication UX

**Files:**
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminDashboard.test.tsx`
- Create: `src/admin/AdminSchedulerBehavior.test.tsx`
- Modify: `src/scheduling/publication.test.ts` only if obsolete tests assert user-facing publication behavior; keep pure legacy selector tests if still used elsewhere

**Interfaces:**
- Consumes: `subscribePageRefresh()` and existing `listScheduleAvailability`, `mapAvailabilityByEmployee`, `prepareScheduleWeekForEditing`.
- Produces: availability-only background refresh; scheduler toolbar without publication controls; legacy non-draft rows still normalize to draft before a mutation.

- [ ] **Step 1: Write failing source/behavior tests for publication removal**

Create `src/admin/AdminSchedulerBehavior.test.tsx` with at least:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/admin/AdminScheduler.tsx", "utf8");

describe("AdminScheduler workflow", () => {
  it("does not expose publication controls or publication status copy", () => {
    expect(source).not.toContain("Công bố lịch");
    expect(source).not.toContain("Đã công bố");
    expect(source).not.toContain("Bản nháp");
    expect(source).not.toContain("publishSchedule");
  });

  it("keeps legacy status normalization before protected schedule mutations", () => {
    expect(source).toContain("prepareScheduleWeekForEditing");
    expect(source).toContain("ensureDraftWeek");
  });
});
```

This test is intentionally a contract guard against future Codex work restoring the removed flow.

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/admin/AdminSchedulerBehavior.test.tsx
```

Expected: FAIL because publication strings/functions still exist.

- [ ] **Step 3: Remove publication UI and mutation path**

In `AdminScheduler.tsx`:

- delete `scheduleWeekStatusLabel`;
- delete `publishSchedule()`;
- keep `prepareScheduleWeekForEditing()` and `ensureDraftWeek()` because current RLS only allows schedule entry mutation when `schedule_weeks.status = 'draft'`;
- remove status badge rendering;
- remove `Công bố lịch` button;
- keep `findScheduleIssues` only for export validation;
- retain `Xuất JPG` and `Xóa lịch tuần`;
- change toolbar eyebrow/title copy from `Xếp lịch chính thức` to `Xếp lịch làm việc`.

- [ ] **Step 4: Add independent availability refresh subscription**

After `loadAvailability` is defined, subscribe without touching `entries`:

```ts
useEffect(() => {
  if (!weekStart) return;
  return subscribePageRefresh(() => {
    void loadAvailability().catch((reason) => {
      console.error(reason);
      setNotice("Không làm mới được lịch đăng ký. Lịch đang xếp vẫn được giữ nguyên.");
    });
  }, { intervalMs: 15_000 });
}, [loadAvailability, weekStart]);
```

Do not call `loadBase()` or `loadEntries()` from this automatic refresh path.

- [ ] **Step 5: Add a pure guard test for availability-only refresh**

Export a tiny helper from `AdminScheduler.tsx` or a new `src/admin/schedulerRefresh.ts`:

```ts
export function shouldRefreshScheduleAvailability(
  weekStart: string,
  visibilityState: DocumentVisibilityState,
): boolean {
  return Boolean(weekStart) && visibilityState === "visible";
}
```

Test valid/empty week start and visible/hidden states. Use the helper inside the interval callback if it improves clarity; otherwise the pageRefresh helper already handles visibility and only the `weekStart` guard is needed.

- [ ] **Step 6: Run scheduler behavior tests**

```bash
npm test -- \
  src/admin/AdminSchedulerBehavior.test.tsx \
  src/admin/AdminDashboard.test.tsx \
  src/scheduling/publication.test.ts
```

Expected: PASS. Pure publication utilities may remain only if still used by employee legacy code; no user-facing publication action may remain in Admin Scheduler.

- [ ] **Step 7: Commit**

```bash
git add src/admin/AdminScheduler.tsx src/admin/AdminSchedulerBehavior.test.tsx src/admin/AdminDashboard.test.tsx src/admin/schedulerRefresh.ts src/admin/schedulerRefresh.test.ts src/scheduling/publication.test.ts
git commit -m "feat: simplify scheduler lifecycle and refresh availability"
```

Only add paths that exist after implementation.

---

### Task 5: Build the legacy-parity admin schedule table as a focused presentational component

**Files:**
- Create: `src/admin/SchedulerTable.tsx`
- Create: `src/admin/SchedulerTable.test.tsx`
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify: `src/admin/ScheduleGrid.test.tsx`

**Interfaces:**
- Produces: `SchedulerTable` presentational component.
- Consumes: existing `CloudEmployee`, `Group`, `ScheduleEntry`, `ShiftType`, `weekStart`; optional render hooks for interactive DnD rows/cells.
- `ScheduleGrid` remains the DnD controller and passes interactive renderers to `SchedulerTable`.

Define the table props explicitly:

```ts
type SchedulerTableProps = {
  groups: Group[];
  employees: CloudEmployee[];
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  weekStart: string;
  renderCell?: (
    employee: CloudEmployee,
    day: number,
    entries: ScheduleEntry[],
  ) => ReactNode;
  renderGroupRow?: (
    group: Group,
    areaClass: string,
    children: ReactNode,
  ) => ReactNode;
  renderEmployeeRow?: (
    employee: CloudEmployee,
    group: Group,
    areaClass: string,
    children: ReactNode,
  ) => ReactNode;
  renderEmployeeHeader?: (employee: CloudEmployee, areaClass: string) => ReactNode;
  id?: string;
  className?: string;
};
```

- [ ] **Step 1: Write failing markup tests from the approved screenshot/reference**

Create `SchedulerTable.test.tsx` asserting:

```ts
expect(html).toContain("Tuần 4");
expect(html).toContain("Tháng 9, 2026");
expect(html).toContain("21/09");
expect(html).toContain("27/09");
expect(html).toContain("Thứ hai");
expect(html).toContain("Chủ nhật");
expect(html).toContain('class="scheduler-name-cell');
expect(html).toContain("Nguyễn Phi Hùng");
expect(html).toContain("Bếp trưởng");
expect(html).toContain("NEW");
expect(html).toContain('colspan="8"');
expect(html).toContain("MEAT");
```

Add a chronological ordering case with two entries whose `sortOrderInCell` conflicts with actual time:

```ts
expect(html.indexOf("10:00 – 14:00")).toBeLessThan(
  html.indexOf("17:00 – 23:00"),
);
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/admin/SchedulerTable.test.tsx
```

Expected: FAIL because `SchedulerTable` does not exist.

- [ ] **Step 3: Implement table metadata and chronological sorting**

Inside `SchedulerTable.tsx`:

- derive seven dates with `addDateOnlyDays(weekStart, index)`;
- derive `weekOfMonth` using existing `formatWeekOfMonth(weekStart)` and render it as `Tuần N`; do not invent a second calendar model;
- derive month/year from the date-only string without browser-local timezone conversion;
- use `formatDateShort` for the range and day dates;
- use `buildScheduleGroups` for ordered sections;
- use existing `rangesForEntry`/`entryLabel` to order cell entries by actual first start, then first end, then `sortOrderInCell`.

Create an exported helper for direct tests:

```ts
export function compareScheduleEntriesByTime(
  first: ScheduleEntry,
  second: ScheduleEntry,
  shifts: ShiftType[],
): number
```

- [ ] **Step 4: Implement dynamic employee-column width**

Export a deterministic helper that does not require canvas in tests:

```ts
export function employeeColumnWidthPx(employees: CloudEmployee[]): number {
  const longest = employees.reduce(
    (max, employee) => Math.max(max, employee.name.length),
    0,
  );
  return Math.min(320, Math.max(210, 140 + longest * 7));
}
```

Use it as a CSS variable on the table wrapper:

```tsx
style={{ "--scheduler-employee-width": `${employeeColumnWidthPx(employees)}px` } as CSSProperties}
```

Test minimum and cap explicitly.

- [ ] **Step 5: Implement approved table markup**

Required structure:

```tsx
<section className="legacy-scheduler-sheet">
  <header className="legacy-scheduler-heading">...</header>
  <table className="legacy-scheduler-table">
    <colgroup>
      <col className="legacy-employee-column" />
      {DAY_KEYS.map((key) => <col key={key} />)}
    </colgroup>
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</section>
```

Default read-only cell renderer must render official shifts only, with split labels as separate lines:

```tsx
{formatShiftLabel(label)
  .split(" / ")
  .map((part) => <span key={part}>{part}</span>)}
```

- [ ] **Step 6: Switch `ScheduleGrid` from `ScheduleSheet` to `SchedulerTable`**

Keep current `ScheduleCell`, `EmployeeDropRow`, `GroupDropRow`, DnD sensors/collision detection, availability popover, employee reorder, and assign/move/delete callbacks. Only replace the presentational table abstraction.

Employee header should render:

- quiet drag handle;
- group-color dot using `areaClass`;
- full employee name;
- `positionName` secondary text;
- `NEW` badge.

- [ ] **Step 7: Update `ScheduleGrid.test.tsx` to the new structure**

Keep existing assertions for `ĐK`, keyboard assignment, delete/trash DnD, and selection state. Replace the obsolete `<tfoot>` staffing assertion; staffing moves in Task 6.

Add:

```ts
expect(html).toContain("legacy-scheduler-table");
expect(html).toContain("scheduler-employee-dot");
expect(html).toContain("Bếp trưởng");
expect(html.indexOf("official-shifts")).toBeLessThan(
  html.indexOf("availability-detail"),
);
```

- [ ] **Step 8: Run table/grid tests**

```bash
npm test -- src/admin/SchedulerTable.test.tsx src/admin/ScheduleGrid.test.tsx src/admin/schedulerDnd.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/admin/SchedulerTable.tsx src/admin/SchedulerTable.test.tsx src/admin/ScheduleGrid.tsx src/admin/ScheduleGrid.test.tsx
git commit -m "feat: port legacy scheduler table structure"
```

---

### Task 6: Move staffing counts into the legacy-style `TỔNG CA` summary

**Files:**
- Create: `src/admin/ScheduleDailySummary.tsx`
- Create: `src/admin/ScheduleDailySummary.test.tsx`
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify: `src/admin/ScheduleGrid.test.tsx`

**Interfaces:**
- Consumes: `periodCounts(entries, shifts)`, `StaffingPeriod`, week dates, `countOverrides`.
- Produces: `ScheduleDailySummary` with optional editable override callback.

Define props:

```ts
type Props = {
  weekStart: string;
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  countOverrides?: Record<string, number>;
  editable?: boolean;
  onSetCountOverride?: (
    day: number,
    period: StaffingPeriod,
    value: string,
  ) => void;
};
```

- [ ] **Step 1: Write failing summary tests**

Required assertions:

```ts
expect(html).toContain("TỔNG CA");
expect(html).toContain("Theo buổi trong ngày");
expect(html).toContain("Sáng");
expect(html).toContain("Trưa");
expect(html).toContain("Tối");
expect(html).toContain("Thứ hai");
expect(html).toContain("21/09");
expect(html).not.toContain("<tfoot>");
```

For override `{"1:Đ": 4}` assert the day-1 evening input renders value `4`.

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/admin/ScheduleDailySummary.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement `ScheduleDailySummary`**

Use `periodCounts(entries, shifts)` for automatic values. For each day and period choose:

```ts
const value =
  countOverrides[`${day}:${period}`] ?? automaticCounts[day - 1][period];
```

Editable mode renders the existing number-input override semantics. Read-only mode renders plain numbers.

- [ ] **Step 4: Render the summary directly below `SchedulerTable` in `ScheduleGrid`**

The final structure inside the scroll/workspace area must be:

```tsx
<div className="schedule-table-scroll">
  <SchedulerTable ... />
  <ScheduleDailySummary
    weekStart={props.weekStart}
    entries={props.entries}
    shifts={props.shifts}
    countOverrides={props.countOverrides}
    editable={props.editable}
    onSetCountOverride={props.onSetCountOverride}
  />
</div>
```

Remove staffing rendering from the interactive table itself.

- [ ] **Step 5: Run staffing + grid regression tests**

```bash
npm test -- \
  src/admin/ScheduleDailySummary.test.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/scheduling/staffing.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/admin/ScheduleDailySummary.tsx src/admin/ScheduleDailySummary.test.tsx src/admin/ScheduleGrid.tsx src/admin/ScheduleGrid.test.tsx
git commit -m "feat: add legacy daily staffing summary"
```

---

### Task 7: Port the compact sidebar/toolbar relationship and legacy-parity CSS

**Files:**
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSchedule.css`
- Modify: `src/admin/ScheduleGrid.test.tsx`
- Modify: `src/admin/AdminSchedulerBehavior.test.tsx`

**Interfaces:**
- `ScheduleGrid` gains controlled sidebar props:

```ts
sidebarOpen?: boolean;
onSidebarOpenChange?: (open: boolean) => void;
```

If omitted, `ScheduleGrid` owns local sidebar state initialized to `true`.

- [ ] **Step 1: Write failing sidebar contract tests**

In `ScheduleGrid.test.tsx`, assert open markup includes the palette and a toggle:

```ts
expect(html).toContain('aria-label="Ẩn danh sách ca"');
expect(html).toContain("scheduler-palette");
```

Add a helper or controlled render for closed state and assert:

```ts
expect(closedHtml).toContain('aria-label="Hiện danh sách ca"');
expect(closedHtml).toContain("sidebar-hidden");
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/admin/ScheduleGrid.test.tsx
```

Expected: FAIL on sidebar toggle/closed-state contract.

- [ ] **Step 3: Implement sidebar toggle and compact workspace structure**

Follow the legacy relationship:

```tsx
<div className={`scheduler-workspace ${sidebarOpen ? "" : "sidebar-hidden"}`}>
  <section className="scheduler-table-column">...</section>
  {sidebarOpen && <aside className="scheduler-palette">...</aside>}
</div>
```

Put palette on the right on desktop to match the old repo's schedule-first emphasis. Do not add Month/Year/Week selectors.

- [ ] **Step 4: Compact the AdminScheduler filter row**

Keep only:

- employee search;
- group filter;
- manual refresh;
- optional `Xem lịch đăng ký` shortcut.

Do not reintroduce a schedule-week picker. Ensure the table header itself carries the visible week/range identity.

- [ ] **Step 5: Replace `AdminSchedule.css` table styles with the approved legacy-parity rules**

Implement these concrete desktop rules as the baseline:

```css
.scheduler-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 212px;
  gap: 10px;
  align-items: start;
}

.scheduler-workspace.sidebar-hidden {
  grid-template-columns: minmax(0, 1fr);
}

.legacy-scheduler-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.legacy-scheduler-table .legacy-employee-column {
  width: var(--scheduler-employee-width);
}

.legacy-scheduler-table th,
.legacy-scheduler-table td {
  min-height: 42px;
  padding: 4px;
  border: 1px solid #e1e6e3;
  vertical-align: middle;
}

.schedule-entry-chip {
  min-height: 30px;
  padding: 4px 8px;
  border-radius: 6px;
  line-height: 1.2;
}

.schedule-entry-chip > span {
  display: block;
}

.availability-hint {
  min-height: 20px;
  padding: 2px 6px;
  font-size: 0.58rem;
}
```

Use existing project tokens where they already match; do not add gradients/heavy animation.

Add responsive behavior:

```css
@media (max-width: 1100px) {
  .scheduler-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .scheduler-palette {
    position: static;
  }
}
```

Keep horizontal table scrolling when the viewport cannot fit the employee column + seven days.

- [ ] **Step 6: Run component tests and build**

```bash
npm test -- src/admin/ScheduleGrid.test.tsx src/admin/SchedulerTable.test.tsx src/admin/AdminSchedulerBehavior.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/admin/ScheduleGrid.tsx src/admin/AdminScheduler.tsx src/admin/AdminSchedule.css src/admin/ScheduleGrid.test.tsx src/admin/AdminSchedulerBehavior.test.tsx
git commit -m "style: match legacy scheduler workspace"
```

---

### Task 8: Make JPG export use the same compact official-schedule visual language without `ĐK`

**Files:**
- Create: `src/admin/AdminScheduleExport.tsx`
- Create: `src/admin/AdminScheduleExport.test.tsx`
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSchedule.css`

**Interfaces:**
- Produces: `AdminScheduleExport` read-only component using `SchedulerTable` + `ScheduleDailySummary`.
- Consumes: official groups/employees/entries/shifts/week/countOverrides only. It has no availability prop.

- [ ] **Step 1: Write failing export-markup tests**

Create:

```ts
const html = renderToStaticMarkup(<AdminScheduleExport ... />);
expect(html).toContain("legacy-scheduler-table");
expect(html).toContain("TỔNG CA");
expect(html).toContain("10:00 – 14:00");
expect(html).not.toContain("ĐK");
expect(html).not.toContain("availability-detail");
expect(html).not.toContain("schedule-entry-delete");
expect(html).not.toContain("schedule-employee-drag-handle");
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/admin/AdminScheduleExport.test.tsx
```

Expected: FAIL because the export component does not exist.

- [ ] **Step 3: Implement read-only export component**

```tsx
export function AdminScheduleExport(props: {
  id: string;
  groups: Group[];
  employees: CloudEmployee[];
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  weekStart: string;
  countOverrides: Record<string, number>;
}) {
  return (
    <div id={props.id} className="admin-schedule-export-sheet">
      <SchedulerTable {...props} />
      <ScheduleDailySummary
        weekStart={props.weekStart}
        entries={props.entries}
        shifts={props.shifts}
        countOverrides={props.countOverrides}
        editable={false}
      />
    </div>
  );
}
```

Do not pass `id` through the spread if TypeScript would collide; destructure explicitly in production code.

- [ ] **Step 4: Replace hidden `ScheduleSheet` export in `AdminScheduler`**

Use:

```tsx
<div className="schedule-export-stage" aria-hidden="true">
  <AdminScheduleExport
    id="cloud-schedule-export"
    groups={groups}
    employees={scheduleEmployees}
    entries={entries}
    shifts={shifts}
    weekStart={week.weekStart}
    countOverrides={week.countOverrides}
  />
</div>
```

Keep `exportScheduleJpg("cloud-schedule-export", week.weekStart)` unchanged.

- [ ] **Step 5: Run export regression tests**

```bash
npm test -- src/admin/AdminScheduleExport.test.tsx src/scheduling/ScheduleSheet.test.tsx
```

Expected: PASS. `ScheduleSheet` may remain for employee legacy/read-only code; Admin export no longer depends on its staffing-footer layout.

- [ ] **Step 6: Commit**

```bash
git add src/admin/AdminScheduleExport.tsx src/admin/AdminScheduleExport.test.tsx src/admin/AdminScheduler.tsx src/admin/AdminSchedule.css
git commit -m "feat: align admin schedule export with scheduler table"
```

---

### Task 9: Update focused CI coverage and run the complete regression suite

**Files:**
- Modify: `.github/workflows/port-scheduler-ci.yml`
- Modify: tests only if a stale assertion describes superseded publication/old-table behavior

**Interfaces:**
- Consumes all earlier tasks.
- Produces a CI gate covering refresh, scheduler parity, DnD, availability semantics, staffing, export, week lifecycle, and build/typecheck.

- [ ] **Step 1: Add the new focused tests to CI**

Add these files to `Scheduler focused tests`:

```text
src/lib/pageRefresh.test.ts
src/employee/employeePortalRefresh.test.ts
src/employee/ScheduleViews.test.tsx          # only if created
src/admin/AdminSchedulerBehavior.test.tsx
src/admin/schedulerRefresh.test.ts           # only if created
src/admin/SchedulerTable.test.tsx
src/admin/ScheduleDailySummary.test.tsx
src/admin/AdminScheduleExport.test.tsx
```

Keep all existing focused scheduler/week/availability/DnD tests.

- [ ] **Step 2: Run focused tests locally**

```bash
npm test -- \
  src/lib/pageRefresh.test.ts \
  src/employee/EmployeeRegistrationPage.test.ts \
  src/employee/employeePortalRefresh.test.ts \
  src/employee/registrationWeekSelection.test.ts \
  src/employee/scheduleApi.test.ts \
  src/admin/AdminSchedulerBehavior.test.tsx \
  src/admin/SchedulerTable.test.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/admin/ScheduleDailySummary.test.tsx \
  src/admin/AdminScheduleExport.test.tsx \
  src/admin/schedulerDnd.test.ts \
  src/scheduling/availabilityShiftMatch.test.ts \
  src/scheduling/availabilityNotice.test.ts \
  src/scheduling/overlap.test.ts \
  src/scheduling/merge.test.ts \
  src/scheduling/staffing.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full repository verification**

```bash
npm test
npm run build
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts
git diff --check origin/main...HEAD
```

Expected: all commands succeed.

- [ ] **Step 4: Perform the required browser smoke test against the approved screenshot**

At desktop width, verify in this exact order:

1. `/admin/schedule?week=<valid-week>` shows `Tuần N · Tháng M, YYYY` and exact Monday-Sunday range.
2. `Nhân viên` + seven days fit in one primary grid at a normal desktop width or use only necessary horizontal scroll.
3. Employee names are complete/readable; `positionName` and `NEW` remain visible.
4. Group separators span all eight columns and remain centered.
5. Single shifts render on one line; split shifts render on two lines inside one chip.
6. Official shifts are visually stronger than `ĐK` pills.
7. Clicking `ĐK` still opens full read-only availability detail/reason.
8. Selecting a palette shift then clicking a cell assigns it.
9. Drag palette -> cell, entry -> cell, entry -> trash, and employee reorder still work.
10. Overlap remains blocking; outside-availability/OFF remains informational only.
11. `TỔNG CA` is a separate section below the grid and manual override persists.
12. Sidebar toggle expands the table width when closed.
13. No `Công bố lịch`, `Bản nháp`, or `Đã công bố` UI is visible.
14. Employee `/app/availability` notices create/lock/reopen/archive/delete lifecycle changes after tab focus without F5.
15. `/app/my-schedule` refetches after tab focus and immediately after successful submission.
16. A new employee submission appears as updated `ĐK` guidance in Admin Scheduler within 15 seconds or immediately after refocus.
17. Exported JPG contains official shifts + staffing summary and does not contain `ĐK` or editing controls.

- [ ] **Step 5: Commit CI/test cleanup**

```bash
git add .github/workflows/port-scheduler-ci.yml src
git commit -m "ci: cover scheduler parity and refresh flows"
```

- [ ] **Step 6: Verify the final GitHub Actions run before claiming completion**

Use the workflow run for the final commit and confirm every step is green:

- `npm ci`
- `Scheduler focused tests`
- `Full test suite`
- `Build`
- `Deno shared tests`
- `Deno admin-users typecheck`
- `Diff whitespace check`

Do not report the work complete if the final run is pending or failing.

---

## Plan Self-Review Result

- **Spec coverage:** Employee lifecycle refresh, My Schedule refresh, scheduler availability refresh, publication removal, legacy-status compatibility, approved legacy table/header/group/shift layout, subordinate `ĐK`, separate staffing summary, sidebar behavior, DnD preservation, export cleanup, CI, and manual visual smoke test are each mapped to a task.
- **Placeholder scan:** No `TBD`, `TODO`, or unspecified implementation steps remain.
- **Type consistency:** `subscribePageRefresh`, `reconcileEmployeePortalRefresh`, `SchedulerTable`, `ScheduleDailySummary`, and `AdminScheduleExport` interfaces are defined before downstream tasks consume them.
