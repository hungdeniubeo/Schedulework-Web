# Admin Registration Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split registration-week management from employee availability viewing, synchronize the selected week through the URL, polish admin navigation, and make the scheduler table easier to read without changing established scheduling behavior.

**Architecture:** Keep `AdminDashboard` as the data coordinator, but move page-specific rendering into small components: `AdminNavigation`, `RegistrationWeeksPage`, and `AdminAvailabilityPage`. The `week` query parameter is the cross-page source of truth. `AdminScheduler` receives the resolved week start and explicitly handles a missing schedule draft. Existing business components (`WeekManager`, `AdminMatrix`, scheduler APIs) remain the single implementation of their rules.

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
- Produces `search: string` passed from `App` -> `AdminApp` -> `AdminDashboard`.
- Preserves `navigate(path: string): void` while making query-only navigation rerender correctly.

- [ ] **Step 1: Write the failing route test**

Add:

```ts
expect(matchRoute("/admin/registration-weeks")).toEqual({
  name: "admin",
  section: "registration-weeks",
});
```

Keep:

```ts
expect(matchRoute("/app/team-schedule")).toEqual({ name: "not-found" });
```

- [ ] **Step 2: Run the route test and confirm red**

```bash
npm test -- src/app/router.test.ts
```

Expected: FAIL because `registration-weeks` is not recognized.

- [ ] **Step 3: Add the new admin section to routing/types**

Add `"registration-weeks"` to the admin section union in `router.ts` and `AdminApp.tsx`, and update the route regex to:

```ts
/^\/admin\/(availability|registration-weeks|schedule|employees|groups|shifts)$/
```

- [ ] **Step 4: Track pathname and search in `App.tsx`**

Use:

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

Update `popstate` to call `setLocation(readLocation())` and navigation to:

```ts
const navigate = useCallback((path: string) => {
  window.history.pushState({}, "", path);
  setLocation(readLocation());
}, []);
```

Route with:

```ts
const route = matchRoute(location.pathname);
```

Pass:

```tsx
<AdminApp
  loginRoute={route.name === "admin-login"}
  section={route.name === "admin" ? route.section : "dashboard"}
  search={location.search}
  navigate={navigate}
/>
```

Add `search: string` to `AdminApp` and pass it to `AdminDashboard`.

- [ ] **Step 5: Run route test and build**

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

### Task 2: Add pure selected-week helpers

**Files:**
- Create: `src/admin/adminWeekSelection.ts`
- Create: `src/admin/adminWeekSelection.test.ts`

**Interfaces:**
- `weekStartFromSearch(search: string): string | null`
- `resolveAdminRegistrationWeek(weeks: RegistrationWeek[], requestedWeekStart: string | null): { week: RegistrationWeek | null; invalidRequestedWeek: boolean }`
- `adminWeekPath(path: string, weekStart: string): string`

- [ ] **Step 1: Write the failing tests**

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

  it("uses an explicitly requested existing week", () => {
    expect(resolveAdminRegistrationWeek(weeks, "2026-09-14")).toEqual({
      week: weeks[1],
      invalidRequestedWeek: false,
    });
  });

  it("falls back only when no week was requested", () => {
    expect(resolveAdminRegistrationWeek(weeks, null).week?.id).toBe("week-open");
  });

  it("marks an unknown requested week invalid", () => {
    expect(resolveAdminRegistrationWeek(weeks, "2026-10-05")).toEqual({
      week: null,
      invalidRequestedWeek: true,
    });
  });

  it("handles an empty week list", () => {
    expect(resolveAdminRegistrationWeek([], null)).toEqual({
      week: null,
      invalidRequestedWeek: false,
    });
  });

  it("builds a week-preserving path", () => {
    expect(adminWeekPath("/admin/schedule", "2026-09-21"))
      .toBe("/admin/schedule?week=2026-09-21");
  });
});
```

- [ ] **Step 2: Run and confirm red**

```bash
npm test -- src/admin/adminWeekSelection.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the helpers**

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

- [ ] **Step 4: Run the tests**

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

### Task 3: Extract and redesign admin navigation

**Files:**
- Create: `src/admin/AdminNavigation.tsx`
- Create: `src/admin/AdminNavigation.test.tsx`
- Create: `src/admin/AdminNavigation.css`
- Modify: `src/admin/AdminDashboard.tsx`

**Interfaces:**

```ts
type AdminSection =
  | "dashboard"
  | "availability"
  | "registration-weeks"
  | "schedule"
  | "employees"
  | "groups"
  | "shifts";

type Props = {
  section: AdminSection;
  selectedWeekStart: string | null;
  navigate: (path: string) => void;
};
```

`AdminNavigation` is presentation/navigation only; it owns no week data.

- [ ] **Step 1: Write the failing navigation test**

Create:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNavigation } from "./AdminNavigation";

describe("AdminNavigation", () => {
  it("renders the registration week tab in the requested order", () => {
    const html = renderToStaticMarkup(
      <AdminNavigation
        section="registration-weeks"
        selectedWeekStart="2026-09-21"
        navigate={vi.fn()}
      />,
    );
    const labels = [
      "Trang chủ",
      "Đăng ký nhân viên",
      "Tuần đăng ký",
      "Xếp lịch",
      "Nhân viên",
      "Nhóm",
      "Ca làm",
    ];
    let previous = -1;
    for (const label of labels) {
      const index = html.indexOf(label);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(html).toContain('aria-current="page"');
  });
});
```

- [ ] **Step 2: Run and confirm red**

```bash
npm test -- src/admin/AdminNavigation.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `AdminNavigation`**

Use this tab data:

```ts
const tabs = [
  ["dashboard", "/admin", "Trang chủ"],
  ["availability", "/admin/availability", "Đăng ký nhân viên"],
  ["registration-weeks", "/admin/registration-weeks", "Tuần đăng ký"],
  ["schedule", "/admin/schedule", "Xếp lịch"],
  ["employees", "/admin/employees", "Nhân viên"],
  ["groups", "/admin/groups", "Nhóm"],
  ["shifts", "/admin/shifts", "Ca làm"],
] as const;
```

For `availability`, `registration-weeks`, and `schedule`, build the target with `adminWeekPath` when `selectedWeekStart` exists; use plain paths otherwise. Render the existing `<nav className="admin-tabs">` semantics and active `aria-current` behavior.

- [ ] **Step 4: Add `AdminNavigation.css`**

Use focused overrides:

```css
.admin-tabs {
  gap: 6px;
  padding: 6px;
  border: 1px solid rgba(76, 92, 84, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 8px 24px rgba(42, 55, 48, 0.06);
  overflow-x: auto;
  scrollbar-width: none;
}

.admin-tabs button {
  flex: 0 0 auto;
  border-radius: 11px;
  transition: background 160ms ease, color 160ms ease,
    transform 160ms ease, box-shadow 160ms ease;
}

.admin-tabs button.active {
  background: #fff;
  box-shadow: 0 5px 14px rgba(42, 55, 48, 0.12),
    inset 0 -2px 0 rgba(95, 122, 107, 0.72);
}

.admin-tabs button:focus-visible {
  outline: 2px solid rgba(82, 112, 96, 0.55);
  outline-offset: 2px;
}

@media (hover: hover) {
  .admin-tabs button:not(.active):hover {
    transform: translateY(-1px);
  }
}
```

Retain existing global colors unless an override is needed; do not alter the admin header markup.

- [ ] **Step 5: Replace the inline nav map in `AdminDashboard`**

Import and render:

```tsx
<AdminNavigation
  section={section}
  selectedWeekStart={selectedWeek?.week_start ?? null}
  navigate={navigate}
/>
```

Task 4 supplies `selectedWeek` from URL state.

- [ ] **Step 6: Run the navigation test and build**

```bash
npm test -- src/admin/AdminNavigation.test.tsx
npm run build
```

Expected: PASS after Task 4 wiring is complete; if Task 3 is committed before Task 4, temporarily pass `null` in `AdminDashboard` and update that call in Task 4.

- [ ] **Step 7: Commit**

```bash
git add src/admin/AdminNavigation.tsx src/admin/AdminNavigation.test.tsx src/admin/AdminNavigation.css src/admin/AdminDashboard.tsx
git commit -m "style: redesign admin navigation"
```

---

### Task 4: Create the dedicated registration-weeks page and matrix-only availability page

**Files:**
- Create: `src/admin/RegistrationWeeksPage.tsx`
- Create: `src/admin/RegistrationWeeks.css`
- Create: `src/admin/AdminAvailabilityPage.tsx`
- Create: `src/admin/AdminAvailabilityPage.test.tsx`
- Modify: `src/admin/AdminDashboard.tsx`
- Modify: `src/admin/AdminAvailability.css`
- Modify: `src/admin/AdminDashboard.test.tsx`

**Interfaces:**
- `RegistrationWeeksPage` is a thin wrapper around existing `WeekManager`.
- `AdminAvailabilityPage` is a pure view over `selectedWeek`, `invalidRequestedWeek`, employees/groups/submissions, and navigation.
- `AdminDashboard` remains responsible for API loading/mutations.

- [ ] **Step 1: Write the failing availability-page tests**

Create:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import { AdminAvailabilityPage } from "./AdminAvailabilityPage";

const week: RegistrationWeek = {
  id: "week-1",
  week_start: "2026-09-21",
  lock_at: "2099-09-18T15:00:00.000Z",
  status: "open",
  created_at: "",
  updated_at: "",
};

const employee = {
  id: "employee-1",
  name: "Nguyễn Phi Hùng",
  active: true,
  groupId: "group-1",
  positionId: null,
  positionName: null,
  sortOrder: 0,
  isNew: false,
};

describe("AdminAvailabilityPage", () => {
  it("renders only the registration matrix for a valid week", () => {
    const html = renderToStaticMarkup(
      <AdminAvailabilityPage
        selectedWeek={week}
        invalidRequestedWeek={false}
        employees={[employee]}
        groups={[{ id: "group-1", name: "MEAT", sortOrder: 0 }]}
        submissions={[]}
        navigate={vi.fn()}
      />,
    );
    expect(html).toContain("Lịch nhân viên đăng ký");
    expect(html).toContain("Xếp lịch tuần này");
    expect(html).not.toContain("Quản lý tuần đăng ký");
    expect(html).not.toContain("Tạo tuần mới");
    expect(html).not.toContain("Tiến độ tuần");
    expect(html).not.toContain("Tổng quan tuần");
  });

  it("shows a management link when no registration week exists", () => {
    const html = renderToStaticMarkup(
      <AdminAvailabilityPage
        selectedWeek={null}
        invalidRequestedWeek={false}
        employees={[]}
        groups={[]}
        submissions={[]}
        navigate={vi.fn()}
      />,
    );
    expect(html).toContain("Chưa có tuần đăng ký");
    expect(html).toContain("Tạo tuần đăng ký");
  });

  it("does not silently fall back for an invalid requested week", () => {
    const html = renderToStaticMarkup(
      <AdminAvailabilityPage
        selectedWeek={null}
        invalidRequestedWeek
        employees={[]}
        groups={[]}
        submissions={[]}
        navigate={vi.fn()}
      />,
    );
    expect(html).toContain("Không tìm thấy tuần đăng ký");
  });
});
```

- [ ] **Step 2: Run and confirm red**

```bash
npm test -- src/admin/AdminAvailabilityPage.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `RegistrationWeeksPage`**

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

Style only this page shell in `RegistrationWeeks.css`, with a readable max-width, centered page placement, and responsive padding; reuse global WeekManager/button/status styles.

- [ ] **Step 4: Implement `AdminAvailabilityPage`**

Use explicit states:

```tsx
if (invalidRequestedWeek) {
  return (
    <section className="panel availability-empty-state">
      <h2>Không tìm thấy tuần đăng ký</h2>
      <p>Tuần được yêu cầu không tồn tại hoặc đã bị xóa.</p>
      <button className="button primary" onClick={() => navigate("/admin/registration-weeks")}>
        Quản lý tuần đăng ký
      </button>
    </section>
  );
}

if (!selectedWeek) {
  return (
    <section className="panel availability-empty-state">
      <h2>Chưa có tuần đăng ký</h2>
      <p>Hãy tạo tuần đăng ký trước khi xem lịch nhân viên.</p>
      <button className="button primary" onClick={() => navigate("/admin/registration-weeks")}>
        Tạo tuần đăng ký
      </button>
    </section>
  );
}

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
```

- [ ] **Step 5: Refactor `AdminDashboard` to derive week selection from the URL**

Add `search: string` to props. Derive:

```ts
const requestedWeekStart = weekStartFromSearch(search);
const { week: selectedWeek, invalidRequestedWeek } =
  resolveAdminRegistrationWeek(weeks, requestedWeekStart);
const selectedWeekId = selectedWeek?.id ?? "";
```

Remove `selectedWeekId` React state. Include `registration-weeks` in base-data loading. Continue submission refresh/polling only for `dashboard` and `availability`.

After creating a registration week:

```ts
const created = await createWeek(weekStart, lockAt);
await refreshBase();
navigate(adminWeekPath("/admin/registration-weeks", created.week_start));
return created;
```

For WeekManager selection:

```ts
onSelect={(id) => {
  const next = weeks.find((week) => week.id === id);
  if (next) navigate(adminWeekPath("/admin/registration-weeks", next.week_start));
}}
```

After deleting the selected week, refresh weeks, resolve the next default using `resolveAdminRegistrationWeek(nextWeeks, null)`, then navigate to either its query URL or `/admin/registration-weeks`.

- [ ] **Step 6: Render the two dedicated pages**

For `section === "registration-weeks"`, render `RegistrationWeeksPage` with existing create/update/delete handlers.

For `section === "availability"`, render only:

```tsx
<AdminAvailabilityPage
  selectedWeek={selectedWeek}
  invalidRequestedWeek={invalidRequestedWeek}
  employees={employees}
  groups={groups}
  submissions={submissions}
  navigate={navigate}
/>
```

Delete the old availability hero, progress card, `dashboard-grid` WeekManager block, and weekly summary from this route.

- [ ] **Step 7: Finish matrix-only CSS**

In `AdminAvailability.css` center area rows:

```css
.admin-availability-matrix .schedule-group-row th,
.admin-availability-matrix .schedule-group-label {
  text-align: center;
}

.availability-empty-state {
  max-width: 620px;
  margin: 32px auto;
  text-align: center;
}
```

Keep existing matrix horizontal scrolling and day-cell sizing.

- [ ] **Step 8: Update the footer test props and run page tests**

Update `AdminDashboard.test.tsx` renders to include `search=""`.

Run:

```bash
npm test -- \
  src/admin/AdminAvailabilityPage.test.tsx \
  src/admin/AdminNavigation.test.tsx \
  src/admin/AdminDashboard.test.tsx \
  src/admin/adminWeekSelection.test.ts \
  src/app/router.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/admin/RegistrationWeeksPage.tsx src/admin/RegistrationWeeks.css src/admin/AdminAvailabilityPage.tsx src/admin/AdminAvailabilityPage.test.tsx src/admin/AdminDashboard.tsx src/admin/AdminDashboard.test.tsx src/admin/AdminAvailability.css
git commit -m "feat: split registration week management from availability"
```

---

### Task 5: Make `/admin/schedule?week=` show an explicit missing-schedule state

**Files:**
- Modify: `src/admin/AdminDashboard.tsx`
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSelects.test.tsx`
- Modify: `src/admin/AdminSchedule.css`

**Interfaces:**
- `AdminScheduler.preferredWeekStart` is the selected registration-week start.
- `selectScheduleWeekId` keeps returning `""` when that exact week has no schedule week.
- Explicit creation uses existing `addScheduleWeek(preferredWeekStart)`.

- [ ] **Step 1: Write failing source tests**

Keep the existing helper assertion:

```ts
expect(selectScheduleWeekId(scheduleWeeks, "schedule-a", "2026-09-28"))
  .toBe("");
```

Add:

```ts
expect(adminSchedulerSource).toContain("Tuần này chưa có lịch xếp");
expect(adminSchedulerSource).toContain("Tạo lịch tuần này");
```

- [ ] **Step 2: Run and confirm red**

```bash
npm test -- src/admin/AdminSelects.test.tsx
```

Expected: FAIL on the new copy assertions.

- [ ] **Step 3: Add base-loading state**

```ts
const [baseLoading, setBaseLoading] = useState(true);
```

Replace the current base-load effect with:

```ts
useEffect(() => {
  let active = true;
  setBaseLoading(true);
  loadBase()
    .catch((reason) => active && setError(reason.message))
    .finally(() => active && setBaseLoading(false));
  return () => {
    active = false;
  };
}, [loadBase]);
```

This prevents a missing-week panel from flashing before schedule weeks load.

- [ ] **Step 4: Add explicit create action**

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

After base loading and before the normal scheduler workspace, if `preferredWeekStart` exists and `week` is null, render:

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

Do not call `addScheduleWeek` from an effect.

- [ ] **Step 5: Wire selected-week navigation in `AdminDashboard`**

If `invalidRequestedWeek` is true, render a clear schedule-page state rather than mounting an unrelated schedule.

If no registration week exists, render a state linking to `/admin/registration-weeks`.

Otherwise mount:

```tsx
<AdminScheduler
  preferredWeekStart={selectedWeek.week_start}
  registrationWeekStarts={weeks.map((week) => week.week_start)}
  onWeekStartChange={(weekStart) => {
    if (weeks.some((week) => week.week_start === weekStart)) {
      navigate(adminWeekPath("/admin/schedule", weekStart));
    }
  }}
  onOpenAvailability={() =>
    navigate(adminWeekPath("/admin/availability", selectedWeek.week_start))
  }
/>
```

- [ ] **Step 6: Style the missing-week state**

```css
.schedule-missing-week {
  max-width: 620px;
  margin: 28px auto;
  padding: 32px;
  text-align: center;
}

.schedule-missing-week h2 {
  margin: 8px 0 6px;
}

.schedule-missing-week .button {
  margin-top: 16px;
}
```

- [ ] **Step 7: Run tests and build**

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

### Task 6: Improve schedule-table readability and horizontal balance

**Files:**
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify: `src/admin/ScheduleGrid.test.tsx`
- Modify: `src/admin/AdminSchedule.css`

**Interfaces:**
- Add only presentational hooks; all `dnd-kit` IDs/data and drag behavior remain unchanged.
- `.schedule-entry-chip` remains the interactive drag/edit target.

- [ ] **Step 1: Write the failing markup test**

Append to the existing `describe` in `ScheduleGrid.test.tsx`:

```ts
it("exposes readable employee name and position hooks", () => {
  const html = render();
  expect(html).toContain('class="schedule-employee-name"');
  expect(html).toContain('class="schedule-employee-position"');
  expect(html).toContain("Nguyễn Phi Hùng");
  expect(html).toContain("Bếp trưởng");
});
```

- [ ] **Step 2: Run and confirm red**

```bash
npm test -- src/admin/ScheduleGrid.test.tsx
```

Expected: FAIL because the classes do not exist.

- [ ] **Step 3: Add markup hooks without changing DnD**

Replace only the employee copy markup with:

```tsx
<span className="schedule-employee-copy">
  <strong className="schedule-employee-name">{employee.name}</strong>
  {employee.positionName && (
    <small className="schedule-employee-position">{employee.positionName}</small>
  )}
  {employee.isNew && <small className="schedule-new-badge">NEW</small>}
</span>
```

Keep the drag handle and all `useDraggable` / `useDroppable` data unchanged.

- [ ] **Step 4: Rebalance desktop widths**

In `AdminSchedule.css`:

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

This reduces the left “Ca làm” palette from 172px to 148px, returning 24px to the main schedule workspace, while widening the employee column for names.

- [ ] **Step 5: Center table content and remove name truncation**

Add/replace with:

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
  text-align: center;
}

.schedule-employee-position {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: center;
}
```

Delete the current rule that forces all `.schedule-employee-copy strong, small` to `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`.

- [ ] **Step 6: Make shift chips visually compact**

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

Keep enough right padding for the existing delete icon on editable chips; reduce only unnecessary left/right padding. Preserve split-shift wrapping.

- [ ] **Step 7: Preserve responsive behavior**

Apply the palette/employee-column width targets only at `min-width: 821px`. Keep existing horizontal table scrolling on smaller viewports and keep the drag handle at least 24px.

- [ ] **Step 8: Run grid/sheet tests and build**

```bash
npm test -- src/admin/ScheduleGrid.test.tsx src/scheduling/ScheduleSheet.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/admin/ScheduleGrid.tsx src/admin/ScheduleGrid.test.tsx src/admin/AdminSchedule.css
git commit -m "style: improve scheduler table readability"
```

---

### Task 7: Update CI and perform final verification

**Files:**
- Modify: `.github/workflows/port-scheduler-ci.yml`
- Tests: all existing and newly added admin/scheduler tests

**Interfaces:**
- No production interface changes.
- Final HEAD must be green before completion or PR creation.

- [ ] **Step 1: Add new tests to focused CI**

Add these paths to the existing focused test command:

```text
src/app/router.test.ts
src/admin/adminWeekSelection.test.ts
src/admin/AdminNavigation.test.tsx
src/admin/AdminAvailabilityPage.test.tsx
src/admin/AdminDashboard.test.tsx
src/admin/AdminSelects.test.tsx
```

Keep all existing focused scheduler tests.

- [ ] **Step 2: Run fresh focused tests**

```bash
npm test -- \
  src/app/router.test.ts \
  src/admin/adminWeekSelection.test.ts \
  src/admin/AdminNavigation.test.tsx \
  src/admin/AdminAvailabilityPage.test.tsx \
  src/admin/AdminDashboard.test.tsx \
  src/admin/AdminSelects.test.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/scheduling/ScheduleSheet.test.tsx \
  src/scheduling/overlap.test.ts \
  src/scheduling/merge.test.ts \
  src/scheduling/staffing.test.ts \
  src/scheduling/publication.test.ts
```

Expected: all PASS.

- [ ] **Step 3: Run full repository verification**

```bash
npm test
npm run build
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts
git diff --check origin/main...HEAD
```

Expected: every command exits successfully with zero failures and no whitespace errors.

- [ ] **Step 4: Manual browser acceptance test**

Run:

```bash
npm run dev
```

Verify:

1. `/admin/registration-weeks` shows `Tuần đăng ký` and all existing WeekManager actions.
2. Selecting a week changes the URL to `?week=YYYY-MM-DD`.
3. `/admin/availability?week=...` contains only the registration matrix block and `Xếp lịch tuần này`.
4. `Xếp lịch tuần này` opens `/admin/schedule?week=<same week>`.
5. Existing schedule week: table opens immediately.
6. Missing schedule week: `Tuần này chưa có lịch xếp` is shown; nothing is created until `Tạo lịch tuần này` is clicked.
7. Invalid `?week=` never silently switches to another week.
8. Long employee names wrap visibly and remain centered.
9. Employee names, positions, area headings, day headings, shift chips, and staffing rows are centered/aligned.
10. The left shift palette is narrower and the main schedule workspace is wider.
11. `/app/team-schedule` remains not-found.

- [ ] **Step 5: Commit CI changes**

```bash
git add .github/workflows/port-scheduler-ci.yml
git commit -m "ci: cover admin registration redesign"
```

- [ ] **Step 6: Verify final HEAD again after the last commit**

Run the same commands from Step 3 again. Then inspect the GitHub Actions run for the final commit. Do not claim completion and do not open a PR until both local/CI evidence are green.
