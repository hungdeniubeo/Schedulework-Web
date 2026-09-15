# Admin Registration Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split registration-week management from employee availability viewing, synchronize the selected week through the URL, polish admin navigation, and make the scheduler table easier to read without changing established scheduling behavior.

**Architecture:** Keep the existing `AdminDashboard` as the coordinator, but make the `week` query parameter the source of truth for the selected registration week. Reuse `WeekManager` on a dedicated registration-weeks page and `AdminMatrix` as the sole availability content. `AdminScheduler` receives the resolved week start and explicitly handles the case where no schedule draft exists yet. Styling stays component/page-scoped.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Vitest 3, Supabase JS 2, existing custom routing and `dnd-kit` scheduler.

**Spec:** `docs/superpowers/specs/2026-09-15-admin-registration-flow-redesign.md`

## Global Constraints

- Keep `/app/team-schedule` removed; it must remain `not-found`.
- Do not auto-create a schedule week when the selected registration week has no schedule week.
- Do not change availability business semantics or existing drag/drop scheduling behavior.
- Reuse `WeekManager`, `WeekDialogs`, `AdminMatrix`, existing APIs, and existing schedule-week creation APIs; do not duplicate their business logic.
- Use `?week=YYYY-MM-DD` as the cross-page selected-week source of truth.
- If `?week=` references no registration week, show a clear state instead of silently switching weeks.
- Keep presentation CSS in focused CSS files; only existing shift-color CSS-variable inline styles are allowed.
- No Supabase schema change is expected for this redesign.

---

### Task 1: Make browser navigation query-aware and add the registration-weeks route

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/router.ts`
- Modify: `src/app/router.test.ts`
- Modify: `src/admin/AdminApp.tsx`

**Interfaces:**
- Produces admin section `"registration-weeks"`.
- Produces `search: string` passed from `App` -> `AdminApp` -> later `AdminDashboard` work.
- Preserves `navigate(path: string): void` while making query-only navigation rerender correctly.

- [ ] **Step 1: Write the failing route test**

Add this assertion in the admin route test:

```ts
expect(matchRoute("/admin/registration-weeks")).toEqual({
  name: "admin",
  section: "registration-weeks",
});
```

Keep the existing assertion that `/app/team-schedule` returns `not-found`.

- [ ] **Step 2: Run the route test and confirm red**

Run:

```bash
npm test -- src/app/router.test.ts
```

Expected: FAIL because `registration-weeks` is not currently recognized.

- [ ] **Step 3: Add the new admin section to routing/types**

Update the admin route union and regex:

```ts
section:
  | "dashboard"
  | "availability"
  | "registration-weeks"
  | "schedule"
  | "employees"
  | "groups"
  | "shifts";
```

and:

```ts
/^\/admin\/(availability|registration-weeks|schedule|employees|groups|shifts)$/
```

Mirror the same section union in `AdminApp.tsx`.

- [ ] **Step 4: Make `App.tsx` track both pathname and search**

Replace pathname-only state with browser-location state:

```ts
type BrowserLocation = { pathname: string; search: string };

function readLocation(): BrowserLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

const [location, setLocation] = useState(readLocation);
```

Update `popstate` to call `setLocation(readLocation())`. Update navigation to push the URL then read the actual browser location:

```ts
const navigate = useCallback((path: string) => {
  window.history.pushState({}, "", path);
  setLocation(readLocation());
}, []);
```

Route only on `location.pathname`:

```ts
const route = matchRoute(location.pathname);
```

Pass query text into admin:

```tsx
<AdminApp
  loginRoute={route.name === "admin-login"}
  section={route.name === "admin" ? route.section : "dashboard"}
  search={location.search}
  navigate={navigate}
/>
```

Add `search: string` to `AdminApp` props and pass it to `AdminDashboard`.

- [ ] **Step 5: Run route tests and build**

Run:

```bash
npm test -- src/app/router.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx src/app/router.ts src/app/router.test.ts src/admin/AdminApp.tsx
git commit -m "feat: add query-aware admin week routing"
```

---

### Task 2: Add pure helpers for selected registration week and week-preserving URLs

**Files:**
- Create: `src/admin/adminWeekSelection.ts`
- Create: `src/admin/adminWeekSelection.test.ts`

**Interfaces:**
- Produces `weekStartFromSearch(search: string): string | null`.
- Produces `resolveAdminRegistrationWeek(weeks, requestedWeekStart)` returning `{ week, invalidRequestedWeek }`.
- Produces `adminWeekPath(path: string, weekStart: string): string`.
- Reuses `selectEmployeeRegistrationWeek` for no-query fallback semantics.

- [ ] **Step 1: Write failing helper tests**

Create tests covering explicit selection, default selection, invalid selection, no weeks, and path encoding:

```ts
import { describe, expect, it } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import {
  adminWeekPath,
  resolveAdminRegistrationWeek,
  weekStartFromSearch,
} from "./adminWeekSelection";

const weeks: RegistrationWeek[] = [
  {
    id: "week-open",
    week_start: "2026-09-21",
    lock_at: "2099-09-18T15:00:00.000Z",
    status: "open",
    created_at: "",
    updated_at: "",
  },
  {
    id: "week-old",
    week_start: "2026-09-14",
    lock_at: "2026-09-11T15:00:00.000Z",
    status: "locked",
    created_at: "",
    updated_at: "",
  },
];

describe("admin week selection", () => {
  it("reads the week query", () => {
    expect(weekStartFromSearch("?week=2026-09-21")).toBe("2026-09-21");
    expect(weekStartFromSearch("")).toBeNull();
  });

  it("uses an explicitly requested existing registration week", () => {
    expect(resolveAdminRegistrationWeek(weeks, "2026-09-14")).toEqual({
      week: weeks[1],
      invalidRequestedWeek: false,
    });
  });

  it("falls back to the current relevant week only when no week was requested", () => {
    expect(resolveAdminRegistrationWeek(weeks, null).week?.id).toBe("week-open");
  });

  it("marks an unknown requested week invalid instead of falling back", () => {
    expect(resolveAdminRegistrationWeek(weeks, "2026-10-05")).toEqual({
      week: null,
      invalidRequestedWeek: true,
    });
  });

  it("builds a week-preserving admin path", () => {
    expect(adminWeekPath("/admin/schedule", "2026-09-21"))
      .toBe("/admin/schedule?week=2026-09-21");
  });
});
```

- [ ] **Step 2: Run tests and confirm red**

```bash
npm test -- src/admin/adminWeekSelection.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement helpers**

Use the existing registration-week default-selection policy:

```ts
import { selectEmployeeRegistrationWeek } from "../employee/registrationWeekSelection";
import type { RegistrationWeek } from "../types/domain";

export function weekStartFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("week")?.trim();
  return value || null;
}

export function resolveAdminRegistrationWeek(
  weeks: RegistrationWeek[],
  requestedWeekStart: string | null,
): { week: RegistrationWeek | null; invalidRequestedWeek: boolean } {
  if (requestedWeekStart) {
    const week = weeks.find((item) => item.week_start === requestedWeekStart) ?? null;
    return { week, invalidRequestedWeek: week === null };
  }
  return {
    week: selectEmployeeRegistrationWeek(weeks),
    invalidRequestedWeek: false,
  };
}

export function adminWeekPath(path: string, weekStart: string): string {
  return `${path}?week=${encodeURIComponent(weekStart)}`;
}
```

- [ ] **Step 4: Run helper tests**

```bash
npm test -- src/admin/adminWeekSelection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/adminWeekSelection.ts src/admin/adminWeekSelection.test.ts
git commit -m "feat: centralize admin registration week selection"
```

---

### Task 3: Create the dedicated registration-weeks page and simplify availability to the matrix only

**Files:**
- Create: `src/admin/RegistrationWeeksPage.tsx`
- Create: `src/admin/RegistrationWeeks.css`
- Create: `src/admin/AdminNavigation.css`
- Modify: `src/admin/AdminDashboard.tsx`
- Modify: `src/admin/AdminDashboard.test.tsx`
- Modify: `src/admin/AdminAvailability.css`

**Interfaces:**
- `AdminDashboard` consumes `search: string` from `AdminApp`.
- `RegistrationWeeksPage` consumes existing `WeekManager` props without reimplementing week business rules.
- `AdminMatrix.onOpenScheduler` navigates to `/admin/schedule?week=<selected-week>`.
- Admin tabs preserve the selected week for `registration-weeks`, `availability`, and `schedule`.

- [ ] **Step 1: Add failing navigation/page-responsibility tests**

Extend `AdminDashboard.test.tsx` with static-render tests that assert:

```ts
expect(markup).toContain("Tuần đăng ký");
expect(markup).toContain('/admin/registration-weeks');
```

For an availability-page render with preloaded/purely-renderable props or an extracted page renderer, assert the source/markup no longer includes week-management copy such as `Quản lý tuần đăng ký`, `Tạo tuần mới`, `Tiến độ tuần`, or `Tổng quan tuần`, while it still includes `Lịch nhân viên đăng ký` and `Xếp lịch tuần này`.

If `AdminDashboard` is too stateful to static-render a loaded availability state cleanly, extract only the view selection into a small exported `AdminAvailabilityPage` component in `AdminDashboard.tsx` or a focused `AdminAvailabilityPage.tsx`; do not mock Supabase to test presentation.

- [ ] **Step 2: Run the targeted admin tests and confirm red**

```bash
npm test -- src/admin/AdminDashboard.test.tsx src/app/router.test.ts
```

Expected: FAIL because the new tab/page is not wired yet.

- [ ] **Step 3: Add `RegistrationWeeksPage` as a thin wrapper around `WeekManager`**

Use a page shell, not duplicated actions:

```tsx
import "./RegistrationWeeks.css";
import type { RegistrationWeek, RegistrationWeekStatus } from "../types/domain";
import { WeekManager } from "./WeekManager";

type Props = {
  weeks: RegistrationWeek[];
  selectedId: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onCreate: (weekStart: string, lockAt: string) => Promise<RegistrationWeek>;
  onUpdate: (
    id: string,
    changes: { status?: RegistrationWeekStatus; lock_at?: string },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function RegistrationWeeksPage(props: Props) {
  return (
    <div className="registration-weeks-page">
      <header className="registration-weeks-heading">
        <span className="eyebrow">Thiết lập đăng ký</span>
        <h1>Tuần đăng ký</h1>
        <p>Tạo, chọn và quản lý thời gian nhận đăng ký của nhân viên.</p>
      </header>
      <WeekManager {...props} />
    </div>
  );
}
```

`RegistrationWeeks.css` should style only this page shell and WeekManager placement.

- [ ] **Step 4: Refactor `AdminDashboard` selection to use URL state**

Add `search: string` to props and derive:

```ts
const requestedWeekStart = weekStartFromSearch(search);
const { week: selectedWeek, invalidRequestedWeek } =
  resolveAdminRegistrationWeek(weeks, requestedWeekStart);
const selectedWeekId = selectedWeek?.id ?? "";
```

Remove `selectedWeekId` as independent React state. After creating a week, refresh and navigate to:

```ts
adminWeekPath("/admin/registration-weeks", created.week_start)
```

When WeekManager selects an ID, look up its week and navigate to its `week_start` query instead of storing the ID only.

Include `registration-weeks` in base-data loading. Continue submission polling only for `dashboard` and `availability`.

- [ ] **Step 5: Add the new admin tab and preserve week across week-sensitive tabs**

Import `./AdminNavigation.css` from `AdminDashboard.tsx`.

Use nav entries in this order:

```ts
[
  ["dashboard", "/admin", "Trang chủ"],
  ["availability", "/admin/availability", "Đăng ký nhân viên"],
  ["registration-weeks", "/admin/registration-weeks", "Tuần đăng ký"],
  ["schedule", "/admin/schedule", "Xếp lịch"],
  ["employees", "/admin/employees", "Nhân viên"],
  ["groups", "/admin/groups", "Nhóm"],
  ["shifts", "/admin/shifts", "Ca làm"],
]
```

For `availability`, `registration-weeks`, and `schedule`, append the selected week query when `selectedWeek` exists. Keep other tabs query-free.

Style `.admin-tabs` in `AdminNavigation.css` with:
- a rounded containing surface;
- rounded tab buttons;
- an elevated active tab with a subtle bottom/inner indicator;
- `transform: translateY(-1px)` only on hover-capable devices;
- `transition` for background, transform, color, and box-shadow;
- visible `:focus-visible` outline;
- horizontal overflow on small screens rather than wrapped/overlapping tabs.

Do not modify the admin header structure.

- [ ] **Step 6: Make `/admin/availability` matrix-only**

Delete the availability hero, progress card, WeekManager block, and weekly summary from this route.

Rendering rules:

```tsx
if (invalidRequestedWeek) {
  // clear state: requested week does not exist
} else if (!selectedWeek) {
  // clear state: no registration weeks; button -> /admin/registration-weeks
} else {
  return (
    <AdminMatrix
      employees={employees}
      groups={groups}
      submissions={submissions}
      weekStart={selectedWeek.week_start}
      onOpenScheduler={() =>
        navigate(adminWeekPath("/admin/schedule", selectedWeek.week_start))
      }
    />
  );
}
```

Keep `AdminMatrix` itself intact except CSS alignment changes. In `AdminAvailability.css`, center `.schedule-group-row th` and `.schedule-group-label`, and add a small matrix-only page spacing rule if necessary.

- [ ] **Step 7: Render `/admin/registration-weeks` using the wrapper**

Pass existing `weeks`, `weekBusy`, `addWeek`, `patchWeek`, and `removeWeek`. On selection, update the URL query. On deletion of the selected week, after refresh navigate to the newly resolved default week if one exists; otherwise navigate to `/admin/registration-weeks` with no query.

- [ ] **Step 8: Run admin tests and build**

```bash
npm test -- src/admin/AdminDashboard.test.tsx src/admin/AdminSelects.test.tsx src/admin/adminWeekSelection.test.ts src/app/router.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/admin/AdminDashboard.tsx src/admin/AdminDashboard.test.tsx src/admin/RegistrationWeeksPage.tsx src/admin/RegistrationWeeks.css src/admin/AdminNavigation.css src/admin/AdminAvailability.css
git commit -m "feat: split registration week management from availability"
```

---

### Task 4: Make `/admin/schedule?week=` open the requested week and show an explicit create state when missing

**Files:**
- Modify: `src/admin/AdminDashboard.tsx`
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSelects.test.tsx`
- Modify: `src/admin/AdminSchedule.css`

**Interfaces:**
- `AdminScheduler.preferredWeekStart` remains the selected registration-week start.
- `selectScheduleWeekId` continues returning `""` if the preferred week has no schedule week.
- Add an explicit helper/state boundary so the empty state is rendered only after base schedule data loads.
- Explicit creation calls existing `addScheduleWeek(preferredWeekStart)` and then reloads/selects the created week.

- [ ] **Step 1: Write failing tests for missing selected schedule week**

Keep the existing pure test:

```ts
expect(selectScheduleWeekId(scheduleWeeks, "schedule-a", "2026-09-28"))
  .toBe("");
```

Add a source/markup test that requires the exact empty-state copy and explicit create button:

```ts
expect(adminSchedulerSource).toContain("Tuần này chưa có lịch xếp");
expect(adminSchedulerSource).toContain("Tạo lịch tuần này");
```

Also assert there is no effect that calls `addScheduleWeek(preferredWeekStart)` automatically during load.

- [ ] **Step 2: Run scheduler select tests and confirm red**

```bash
npm test -- src/admin/AdminSelects.test.tsx
```

Expected: FAIL on missing empty-state copy.

- [ ] **Step 3: Add base-loading state so missing-week UI never flashes before load**

In `AdminScheduler`:

```ts
const [baseLoading, setBaseLoading] = useState(true);
```

Wrap `loadBase` use with true/false lifecycle:

```ts
useEffect(() => {
  let active = true;
  setBaseLoading(true);
  loadBase()
    .catch((reason) => active && setError(reason.message))
    .finally(() => active && setBaseLoading(false));
  return () => { active = false; };
}, [loadBase]);
```

- [ ] **Step 4: Add explicit preferred-week creation action**

Implement:

```ts
async function createPreferredScheduleWeek() {
  if (!preferredWeekStart || busy) return;
  setBusy(true);
  setError(null);
  try {
    await addScheduleWeek(preferredWeekStart);
    await loadBase();
  } catch (reason) {
    setError(reason instanceof Error ? reason.message : "Không tạo được lịch tuần.");
  } finally {
    setBusy(false);
  }
}
```

After `baseLoading` ends, if `preferredWeekStart` exists but `week` is null, render a focused `.schedule-missing-week` panel:

```tsx
<section className="panel schedule-missing-week">
  <span className="eyebrow">Chưa có lịch xếp</span>
  <h2>Tuần này chưa có lịch xếp</h2>
  <p>Hãy tạo lịch tuần này để bắt đầu.</p>
  <button
    type="button"
    className="button primary"
    disabled={busy}
    onClick={() => void createPreferredScheduleWeek()}
  >
    {busy ? "Đang tạo..." : "Tạo lịch tuần này"}
  </button>
</section>
```

Keep the existing generic manual “create schedule week” modal for other workflows; this direct button is only for the selected registration week.

- [ ] **Step 5: Wire schedule navigation to preserve the selected registration week**

In `AdminDashboard`, pass:

```tsx
<AdminScheduler
  preferredWeekStart={selectedWeek?.week_start ?? ""}
  registrationWeekStarts={weeks.map((week) => week.week_start)}
  onWeekStartChange={(weekStart) => {
    if (weeks.some((week) => week.week_start === weekStart)) {
      navigate(adminWeekPath("/admin/schedule", weekStart));
    }
  }}
  onOpenAvailability={() => {
    if (selectedWeek) {
      navigate(adminWeekPath("/admin/availability", selectedWeek.week_start));
    }
  }}
/>
```

If `invalidRequestedWeek` is true or no registration weeks exist, render the same clear admin-level states used by availability rather than mounting a scheduler for an unrelated week.

- [ ] **Step 6: Style the empty state**

Add only focused `.schedule-missing-week` styles to `AdminSchedule.css`: centered copy, restrained max-width, clear action hierarchy, no modal.

- [ ] **Step 7: Run scheduler tests and build**

```bash
npm test -- src/admin/AdminSelects.test.tsx src/admin/adminWeekSelection.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/admin/AdminDashboard.tsx src/admin/AdminScheduler.tsx src/admin/AdminSelects.test.tsx src/admin/AdminSchedule.css
git commit -m "feat: handle missing schedule weeks explicitly"
```

---

### Task 5: Improve schedule-table readability and reclaim horizontal space

**Files:**
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify: `src/admin/ScheduleGrid.test.tsx`
- Modify: `src/admin/AdminSchedule.css`
- Modify if needed: `src/admin/SchedulePortExtras.css`

**Interfaces:**
- Add presentational hooks only; do not change `dnd-kit` IDs/data or drag/drop behavior.
- Employee header gains `.schedule-employee-name` and `.schedule-employee-position` hooks.
- Existing `.schedule-entry-chip` remains the interactive drag/edit target.

- [ ] **Step 1: Write failing markup tests for employee-name hooks**

Extend `ScheduleGrid.test.tsx`:

```ts
it("exposes readable employee-name and position hooks", () => {
  const html = render();
  expect(html).toContain('class="schedule-employee-name"');
  expect(html).toContain('class="schedule-employee-position"');
  expect(html).toContain("Nguyễn Phi Hùng");
  expect(html).toContain("Bếp trưởng");
});
```

- [ ] **Step 2: Run focused grid test and confirm red**

```bash
npm test -- src/admin/ScheduleGrid.test.tsx
```

Expected: FAIL because the classes do not exist.

- [ ] **Step 3: Add the markup hooks without changing DnD**

Change only the inner copy:

```tsx
<span className="schedule-employee-copy">
  <strong className="schedule-employee-name">{employee.name}</strong>
  {employee.positionName && (
    <small className="schedule-employee-position">{employee.positionName}</small>
  )}
  {employee.isNew && <small className="schedule-new-badge">NEW</small>}
</span>
```

Keep the drag handle, `useDraggable`, row drop targets, and all IDs unchanged.

- [ ] **Step 4: Rebalance the desktop layout in `AdminSchedule.css`**

Use these concrete targets as the starting implementation:

```css
@media (min-width: 821px) {
  .scheduler-layout {
    grid-template-columns: 148px minmax(0, 1fr);
  }

  .scheduler-layout .cloud-schedule-table thead th:first-child {
    width: 205px;
  }
}
```

This reduces the left shift palette from 172px to 148px, giving the main table 24px more width, while the employee column becomes wide enough for names.

Make table content consistently centered:

```css
.scheduler-layout .cloud-schedule-table th,
.scheduler-layout .cloud-schedule-table td,
.scheduler-layout .schedule-group-row th {
  text-align: center;
  vertical-align: middle;
}

.scheduler-layout .schedule-group-label {
  display: block;
  width: 100%;
  text-align: center;
}
```

Replace the current ellipsis rule with readable wrapping:

```css
.schedule-employee-copy {
  width: 100%;
  justify-items: center;
  text-align: center;
}

.schedule-employee-name {
  max-width: 100%;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.2;
}

.schedule-employee-position {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: center;
}
```

Make official shift chips compact instead of visually filling the cell:

```css
.scheduler-layout .official-shifts {
  display: grid;
  justify-items: center;
}

.scheduler-layout .schedule-entry-wrap {
  width: auto;
  max-width: 100%;
  margin-inline: auto;
}

.scheduler-layout .schedule-entry-chip {
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  justify-content: center;
  text-align: center;
  line-height: 1.2;
}
```

Preserve right padding needed for the delete icon on editable chips; reduce only unnecessary horizontal padding. Split-shift labels may wrap at the existing slash/space boundary.

- [ ] **Step 5: Keep mobile/responsive behavior safe**

Do not apply the 205px employee column or 148px palette rule below 821px. Preserve horizontal scrolling where the existing shared schedule CSS needs it. Keep drag handles at least 24px and focusable.

- [ ] **Step 6: Run grid/sheet tests and build**

```bash
npm test -- src/admin/ScheduleGrid.test.tsx src/scheduling/ScheduleSheet.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/admin/ScheduleGrid.tsx src/admin/ScheduleGrid.test.tsx src/admin/AdminSchedule.css src/admin/SchedulePortExtras.css
git commit -m "style: improve scheduler table readability"
```

---

### Task 6: Finalize availability/registration-week styling and verification

**Files:**
- Modify: `src/admin/AdminAvailability.css`
- Modify: `src/admin/RegistrationWeeks.css`
- Modify: `src/admin/AdminNavigation.css`
- Modify: `.github/workflows/port-scheduler-ci.yml`
- Tests: existing and new admin/scheduler tests from prior tasks

**Interfaces:**
- No data-model changes.
- CI must exercise the new query/week-flow tests in addition to the existing scheduler tests.

- [ ] **Step 1: Polish the availability matrix only within its CSS boundary**

Keep the matrix block visually self-contained. Ensure:

```css
.admin-availability-matrix .schedule-group-row th,
.admin-availability-matrix .schedule-group-label {
  text-align: center;
}
```

Employee labels and day cells remain centered, matrix scroll remains available on narrow screens, and the `Xếp lịch tuần này` action stays visible in the panel heading.

- [ ] **Step 2: Polish the registration-weeks page without changing WeekManager logic**

`RegistrationWeeks.css` should provide:
- a page header with balanced spacing;
- a max-width suitable for management controls;
- responsive padding;
- no duplicated button/status styles already provided globally.

- [ ] **Step 3: Update focused CI test list**

Add these tests to the `Scheduler focused tests` command in `.github/workflows/port-scheduler-ci.yml`:

```text
src/app/router.test.ts
src/admin/adminWeekSelection.test.ts
src/admin/AdminDashboard.test.tsx
src/admin/AdminSelects.test.tsx
```

Keep all existing focused scheduler tests.

- [ ] **Step 4: Run fresh focused tests**

```bash
npm test -- \
  src/app/router.test.ts \
  src/admin/adminWeekSelection.test.ts \
  src/admin/AdminDashboard.test.tsx \
  src/admin/AdminSelects.test.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/scheduling/ScheduleSheet.test.tsx \
  src/scheduling/overlap.test.ts \
  src/scheduling/merge.test.ts \
  src/scheduling/staffing.test.ts \
  src/scheduling/publication.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full repository verification**

```bash
npm test
npm run build
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts
git diff --check origin/main...HEAD
```

Expected: every command exits successfully with zero test failures and no whitespace errors.

- [ ] **Step 6: Manual browser acceptance test**

Run:

```bash
npm run dev
```

Verify in the browser:

1. `/admin/registration-weeks` shows the new tab/page and all existing week actions.
2. Selecting a week changes the URL to `?week=YYYY-MM-DD`.
3. `/admin/availability?week=...` shows only the matrix block plus `Xếp lịch tuần này`.
4. `Xếp lịch tuần này` opens `/admin/schedule?week=<same week>`.
5. If the schedule exists, the table opens immediately.
6. If it does not exist, the page shows `Tuần này chưa có lịch xếp` and does not create anything until `Tạo lịch tuần này` is clicked.
7. A long employee name wraps visibly instead of disappearing behind ellipsis.
8. Employee names, groups, shifts, day headings, and staffing rows are centered/aligned.
9. The left shift palette is narrower and the schedule table has more horizontal room.
10. `/app/team-schedule` remains unavailable/not-found.

- [ ] **Step 7: Commit final CSS/CI changes**

```bash
git add src/admin/AdminAvailability.css src/admin/RegistrationWeeks.css src/admin/AdminNavigation.css .github/workflows/port-scheduler-ci.yml
git commit -m "style: finish admin registration workflow redesign"
```

- [ ] **Step 8: Verify the final HEAD again after the last commit**

Run the same full repository verification commands from Step 5 and inspect the GitHub Actions run for the final commit before claiming completion or opening a PR.
