# Group Lifecycle and Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make group creation, rename, reorder, and deletion behave consistently across employee management, availability, scheduling, and exported schedule visuals, while preserving employees and history when a group is deleted.

**Architecture:** Supabase remains the single source of truth. The database foreign key owns delete semantics with `ON DELETE SET NULL`; the shared grouping model owns how real and ungrouped sections are built; long-lived admin pages refresh group/employee structure on focus/visibility without reloading official schedule entries. Scheduler and availability continue to consume the shared grouping model so empty groups and deleted-group employees render consistently.

**Tech Stack:** React 19, TypeScript, Vite/Vitest, Supabase/PostgreSQL, existing `subscribePageRefresh` utility, existing scheduler components and GitHub Actions workflow.

**Spec:** `docs/superpowers/specs/2026-09-16-group-lifecycle-and-sync-design.md`

## Global Constraints

- Work only on `feat/port-schedulework-scheduler`; do not modify, merge, or create a PR to `main` unless explicitly requested later.
- Deleting a group must never delete/deactivate employees, employee accounts, availability submissions, positions, schedule weeks, or schedule entries.
- Employees from a deleted group must end with `group_id = null` and display as `Chưa có nhóm`.
- Every real group must render in schedule-style tables even when it has zero employees.
- The synthetic `Chưa có nhóm` section appears only when at least one employee is ungrouped.
- Scheduler group headings must contain the group name only; remove the decorative `◈` area icon.
- Structural refreshes use the existing focus/visibility refresh pattern. Do not add a new state library or a new polling framework.
- Scheduler structural refresh must not reload official schedule entries or reset in-progress schedule interaction.
- JPG export continues to capture the live scheduler visual; no separate group-layout implementation is introduced for export.

---

### Task 1: Change Group Delete Semantics in PostgreSQL

**Files:**
- Create: `supabase/migrations/202609160004_group_delete_set_null.sql`
- Create: `src/admin/GroupLifecycleMigration.test.ts`

**Interfaces:**
- Consumes: existing nullable `public.employees.group_id` foreign key to `public.groups(id)`.
- Produces: the same `employees_group_id_fkey` relationship with `ON DELETE SET NULL`.

- [ ] **Step 1: Write the failing migration contract test**

Create `src/admin/GroupLifecycleMigration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import migrationSql from "../../supabase/migrations/202609160004_group_delete_set_null.sql?raw";

describe("group lifecycle migration", () => {
  it("changes employee group deletion to SET NULL", () => {
    expect(migrationSql).toContain(
      "drop constraint if exists employees_group_id_fkey",
    );
    expect(migrationSql).toContain("foreign key (group_id)");
    expect(migrationSql).toContain("references public.groups(id)");
    expect(migrationSql).toContain("on delete set null");
  });

  it("does not delete employee or schedule data", () => {
    expect(migrationSql).not.toContain("delete from public.employees");
    expect(migrationSql).not.toContain("delete from public.schedule_entries");
    expect(migrationSql).not.toContain("delete from public.availability_submissions");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- src/admin/GroupLifecycleMigration.test.ts
```

Expected: FAIL because `202609160004_group_delete_set_null.sql` does not exist yet.

- [ ] **Step 3: Add the minimal migration**

Create:

```sql
alter table public.employees
  drop constraint if exists employees_group_id_fkey;

alter table public.employees
  add constraint employees_group_id_fkey
  foreign key (group_id)
  references public.groups(id)
  on delete set null;
```

Do not add data-copy loops or manual employee updates.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- src/admin/GroupLifecycleMigration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609160004_group_delete_set_null.sql src/admin/GroupLifecycleMigration.test.ts
git commit -m "db: unassign employees when groups are deleted"
```

---

### Task 2: Preserve Empty Real Groups in the Shared Grouping Model

**Files:**
- Modify: `src/scheduling/scheduleSheetModel.ts`
- Modify: `src/scheduling/scheduleSheetModel.test.ts`

**Interfaces:**
- Consumes: `Group[]`, `CloudEmployee[]`.
- Produces: `buildScheduleGroups(groups, employees): ScheduleGroup[]` where all real groups are retained and `Chưa có nhóm` is conditional.
- Produces: exported constant `UNGROUPED_GROUP_ID = "ungrouped"` so scheduler DnD can identify the synthetic section safely.

- [ ] **Step 1: Expand tests before implementation**

Replace/extend the `buildScheduleGroups` coverage with explicit cases:

```ts
it("keeps empty real groups in sort order", () => {
  const groups: Group[] = [
    { id: "g2", name: "BAR", sortOrder: 2 },
    { id: "g1", name: "MEAT", sortOrder: 1 },
  ];
  const employees = [employee("hung", "g1", 0)];

  expect(
    buildScheduleGroups(groups, employees).map((section) => ({
      name: section.group.name,
      employees: section.employees.map((item) => item.id),
    })),
  ).toEqual([
    { name: "MEAT", employees: ["hung"] },
    { name: "BAR", employees: [] },
  ]);
});

it("adds Chưa có nhóm only when an employee is ungrouped", () => {
  const groups: Group[] = [{ id: "g1", name: "MEAT", sortOrder: 0 }];

  expect(buildScheduleGroups(groups, [employee("hung", null, 0)])
    .map((section) => section.group.name))
    .toEqual(["MEAT", "Chưa có nhóm"]);

  expect(buildScheduleGroups(groups, [employee("hung", "g1", 0)])
    .map((section) => section.group.name))
    .toEqual(["MEAT"]);
});
```

Keep the existing employee sort-order assertion and update its expected sections to include empty real groups when applicable.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm test -- src/scheduling/scheduleSheetModel.test.ts
```

Expected: FAIL because the current implementation filters every empty section.

- [ ] **Step 3: Implement the shared grouping rule**

Refactor `scheduleSheetModel.ts` to this shape:

```ts
export const UNGROUPED_GROUP_ID = "ungrouped";

export function buildScheduleGroups(
  groups: Group[],
  employees: CloudEmployee[],
): ScheduleGroup[] {
  const orderedGroups = [...groups].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );

  const employeeSort = (first: CloudEmployee, second: CloudEmployee) =>
    first.sortOrder - second.sortOrder ||
    first.name.localeCompare(second.name, "vi");

  const sections: ScheduleGroup[] = orderedGroups.map((group) => ({
    group,
    employees: employees
      .filter((employee) => employee.groupId === group.id)
      .sort(employeeSort),
  }));

  const ungrouped = employees
    .filter((employee) => !employee.groupId)
    .sort(employeeSort);

  if (ungrouped.length > 0) {
    sections.push({
      group: {
        id: UNGROUPED_GROUP_ID,
        name: "Chưa có nhóm",
        sortOrder: Number.MAX_SAFE_INTEGER,
      },
      employees: ungrouped,
    });
  }

  return sections;
}
```

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/scheduling/scheduleSheetModel.test.ts src/admin/AdminMatrix.test.tsx src/admin/SchedulerTable.test.tsx
```

Expected: PASS after updating any old assertion that assumed empty real groups disappear.

- [ ] **Step 5: Commit**

```bash
git add src/scheduling/scheduleSheetModel.ts src/scheduling/scheduleSheetModel.test.ts
git commit -m "feat: keep empty groups in schedule views"
```

---

### Task 3: Make Group Deletion Explicit and Safe in the Admin UI

**Files:**
- Create: `src/admin/GroupDeleteDialog.tsx`
- Create: `src/admin/GroupDeleteDialog.test.tsx`
- Modify: `src/admin/GroupManager.tsx`
- Modify: `src/scheduling/api.ts`
- Modify: `src/scheduling/api.test.ts`

**Interfaces:**
- `GroupDeleteDialog` consumes `{ group: Group; deleting: boolean; onCancel(): void; onConfirm(): void }`.
- `removeGroup(id: string): Promise<void>` performs one group delete and now reports generic delete failure instead of instructing the user to move employees first.

- [ ] **Step 1: Add API regression coverage first**

Update `src/scheduling/api.test.ts` to import `removeGroup` and add:

```ts
function clientWithGroupDelete(error: { message: string } | null) {
  const query = {
    delete: () => query,
    eq: async () => ({ error }),
  };
  return { from: () => query };
}

describe("removeGroup", () => {
  it("deletes the group with one database delete", async () => {
    supabase.client = clientWithGroupDelete(null);
    await expect(removeGroup("group-1")).resolves.toBeUndefined();
  });

  it("does not tell admins to manually move employees on failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.client = clientWithGroupDelete({ message: "database failure" });

    await expect(removeGroup("group-1")).rejects.toThrow("Không xóa được nhóm.");
    await expect(removeGroup("group-1")).rejects.not.toThrow(
      "Hãy chuyển nhân viên sang nhóm khác trước.",
    );
  });
});
```

- [ ] **Step 2: Add deletion-dialog test before component**

Create `src/admin/GroupDeleteDialog.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GroupDeleteDialog } from "./GroupDeleteDialog";

it("explains that employees become ungrouped and history remains", () => {
  const html = renderToStaticMarkup(
    <GroupDeleteDialog
      group={{ id: "group-1", name: "BAR", sortOrder: 0 }}
      deleting={false}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
    />,
  );

  expect(html).toContain("Xóa nhóm BAR?");
  expect(html).toContain("Chưa có nhóm");
  expect(html).toContain("Lịch làm việc và dữ liệu đăng ký không bị xóa");
  expect(html).toContain("Xóa nhóm");
});
```

- [ ] **Step 3: Run tests and verify RED**

```bash
npm test -- src/scheduling/api.test.ts src/admin/GroupDeleteDialog.test.tsx
```

Expected: FAIL because API copy is stale and `GroupDeleteDialog` does not exist.

- [ ] **Step 4: Implement API and dialog**

Change `removeGroup()` to:

```ts
export async function removeGroup(id: string): Promise<void> {
  const { error } = await getSupabase().from("groups").delete().eq("id", id);
  fail(error, "Không xóa được nhóm.");
}
```

Implement `GroupDeleteDialog` with the existing `ModalBackdrop` and `confirm-dialog` styles, `role="alertdialog"`, disabled dismissal while `deleting`, and the approved copy.

- [ ] **Step 5: Wire GroupManager to the dialog**

In `GroupManager.tsx`:

- add `deleteTarget: Group | null` state;
- clicking `Xóa` sets `deleteTarget` instead of deleting immediately;
- confirmation calls `removeGroup(deleteTarget.id)` once;
- on success: reload `groups`, close the dialog;
- on failure: retain the group, close or keep the dialog according to current confirm-dialog conventions, and show inline error;
- while delete is running, disable duplicate mutations.

Also refactor group rename so an empty trimmed input restores `group.name`, and a failed `patchGroup()` restores the previous displayed value instead of leaving stale text in the uncontrolled input.

- [ ] **Step 6: Verify GREEN**

```bash
npm test -- src/scheduling/api.test.ts src/admin/GroupDeleteDialog.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/scheduling/api.ts src/scheduling/api.test.ts src/admin/GroupDeleteDialog.tsx src/admin/GroupDeleteDialog.test.tsx src/admin/GroupManager.tsx
git commit -m "feat: allow safe group deletion"
```

---

### Task 4: Remove the Scheduler Area Icon and Keep Synthetic Ungrouped DnD Safe

**Files:**
- Modify: `src/admin/SchedulerTable.tsx`
- Modify: `src/admin/SchedulerTable.test.tsx`
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify: `src/admin/ScheduleGrid.test.tsx` or `src/admin/schedulerDnd.test.ts` as appropriate
- Modify: scheduler CSS only if `.scheduler-group-mark` becomes unused.

**Interfaces:**
- Consumes: `UNGROUPED_GROUP_ID` from `scheduleSheetModel.ts`.
- Produces: group rows that render only the uppercase group name.
- Empty real groups remain valid employee-drop targets; synthetic `Chưa có nhóm` is not passed to the reorder RPC as if it were a real UUID.

- [ ] **Step 1: Add scheduler rendering assertions first**

Extend `SchedulerTable.test.tsx`:

```tsx
it("renders empty group headings without the decorative area icon", () => {
  const html = renderToStaticMarkup(
    <SchedulerTable
      groups={[
        { id: "meat", name: "MEAT", sortOrder: 0 },
        { id: "bar", name: "BAR", sortOrder: 1 },
      ]}
      employees={[{ ...employee, groupId: "meat" }]}
      entries={[]}
      shifts={shifts}
      weekStart="2026-09-21"
    />,
  );

  expect(html).toContain("MEAT");
  expect(html).toContain("BAR");
  expect(html).not.toContain("◈");
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/admin/SchedulerTable.test.tsx
```

Expected: FAIL because `◈` is currently rendered.

- [ ] **Step 3: Remove icon markup**

Change group children from:

```tsx
<div className="scheduler-group-label">
  <span className="scheduler-group-mark" aria-hidden="true">◈</span>
  <strong>{group.name.toLocaleUpperCase("vi")}</strong>
</div>
```

to:

```tsx
<div className="scheduler-group-label">
  <strong>{group.name.toLocaleUpperCase("vi")}</strong>
</div>
```

Remove now-unused `.scheduler-group-mark` CSS if no other component references it.

- [ ] **Step 4: Prevent synthetic group IDs reaching employee reorder**

Import `UNGROUPED_GROUP_ID` into `ScheduleGrid.tsx`. For `GroupDropRow`, keep real empty groups droppable, but disable the synthetic ungrouped group:

```tsx
editable={
  props.editable &&
  Boolean(props.onMoveEmployee) &&
  group.id !== UNGROUPED_GROUP_ID
}
```

Ungrouped employee rows remain visible; their current drag handle already stays disabled because `employee.groupId` is null.

- [ ] **Step 5: Verify scheduler regressions**

```bash
npm test -- src/admin/SchedulerTable.test.tsx src/admin/ScheduleGrid.test.tsx src/admin/schedulerDnd.test.ts src/scheduling/exportJpg.test.ts
```

Expected: PASS. Export needs no separate visual implementation because it captures the live DOM.

- [ ] **Step 6: Commit**

```bash
git add src/admin/SchedulerTable.tsx src/admin/SchedulerTable.test.tsx src/admin/ScheduleGrid.tsx src/admin/ScheduleGrid.test.tsx src/admin/schedulerDnd.test.ts src/admin/AdminSchedule.css src/admin/AdminScheduleLive.css
git commit -m "style: sync scheduler group sections"
```

Only add CSS files that actually changed.

---

### Task 5: Refresh Group/Employee Structure Across Long-Lived Admin Views

**Files:**
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSchedulerBehavior.test.tsx`
- Modify: `src/admin/EmployeeManager.tsx`
- Create: `src/admin/AdminStructureRefresh.test.ts`
- Modify: `src/admin/AdminDashboard.tsx`
- Modify: `src/admin/GroupManager.tsx`

**Interfaces:**
- Consumes: `subscribePageRefresh(refresh)` from `src/lib/pageRefresh.ts`.
- Produces: focus/visibility structural refreshes with no periodic polling.
- Scheduler refresh path updates `groups + employees` only; official `entries` remain untouched.

- [ ] **Step 1: Lock scheduler refresh behavior before implementation**

Extend `AdminSchedulerBehavior.test.tsx`:

```ts
it("refreshes group and employee structure without reloading official entries", () => {
  expect(source).toContain("loadStructure");
  expect(source).toContain("listGroups()");
  expect(source).toContain("listSchedulerEmployees()");
  expect(source).toContain("subscribePageRefresh");
});
```

The implementation must keep `loadEntries()` out of the structural focus callback. Keep the existing 15-second availability refresh independent.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/admin/AdminSchedulerBehavior.test.tsx
```

Expected: FAIL because there is no dedicated `loadStructure` focus refresh yet.

- [ ] **Step 3: Implement scheduler structural refresh**

Add:

```ts
const loadStructure = useCallback(async () => {
  const [nextGroups, nextEmployees] = await Promise.all([
    listGroups(),
    listSchedulerEmployees(),
  ]);
  setGroups(nextGroups);
  setEmployees(nextEmployees);
}, []);
```

Subscribe without an interval:

```ts
useEffect(() =>
  subscribePageRefresh(() => {
    void loadStructure().catch((reason) => {
      console.error(reason);
      setNotice("Không làm mới được nhóm/nhân viên. Lịch đang xếp vẫn được giữ nguyên.");
    });
  }),
[loadStructure]);
```

Do not call `loadEntries()` from this callback.

Add a small effect to reset a deleted group filter:

```ts
useEffect(() => {
  if (groupFilter !== "all" && !groups.some((group) => group.id === groupFilter)) {
    setGroupFilter("all");
  }
}, [groupFilter, groups]);
```

- [ ] **Step 4: Add a source contract for the other admin refresh consumers**

Create `src/admin/AdminStructureRefresh.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import employeeManagerSource from "./EmployeeManager.tsx?raw";
import groupManagerSource from "./GroupManager.tsx?raw";
import dashboardSource from "./AdminDashboard.tsx?raw";

describe("admin group structure refresh", () => {
  it("refreshes employee groups when EmployeeManager regains focus", () => {
    expect(employeeManagerSource).toContain("subscribePageRefresh");
    expect(employeeManagerSource).toContain("listSchedulerEmployees()");
    expect(employeeManagerSource).toContain("listGroups()");
  });

  it("refreshes the group manager from Supabase on focus", () => {
    expect(groupManagerSource).toContain("subscribePageRefresh");
    expect(groupManagerSource).toContain("listGroups()");
  });

  it("refreshes dashboard/availability employee-group structure on focus", () => {
    expect(dashboardSource).toContain("subscribePageRefresh");
    expect(dashboardSource).toContain("refreshStructure");
  });
});
```

- [ ] **Step 5: Verify RED**

```bash
npm test -- src/admin/AdminStructureRefresh.test.ts
```

Expected: FAIL because the three screens do not yet share the required structural focus refresh.

- [ ] **Step 6: Implement EmployeeManager focus refresh**

Import `useCallback` and `subscribePageRefresh`.

Create a dedicated loader for only employees/groups:

```ts
const loadEmployeeStructure = useCallback(async () => {
  const [nextEmployees, nextGroups] = await Promise.all([
    listSchedulerEmployees(),
    listGroups(),
  ]);
  setEmployees(nextEmployees);
  setGroups(nextGroups);
}, []);
```

Subscribe while avoiding mutation races:

```ts
useEffect(() =>
  subscribePageRefresh(() => {
    if (adding || busyId !== null || positionBusy) return;
    void loadEmployeeStructure().catch((reason) => {
      console.error(reason);
      setError("Không làm mới được nhóm và nhân viên.");
    });
  }),
[adding, busyId, loadEmployeeStructure, positionBusy]);
```

Do not clear current data before the request resolves. Existing `groupName ?? "Chưa có nhóm"` and the blank group select option should then reflect deleted-group employees automatically.

- [ ] **Step 7: Implement GroupManager focus refresh**

Wrap `load` in `useCallback`, import `subscribePageRefresh`, and subscribe when not `busy`:

```ts
useEffect(() =>
  subscribePageRefresh(() => {
    if (busy) return;
    void load().catch((reason) => {
      console.error(reason);
      setError("Không làm mới được nhóm.");
    });
  }),
[busy, load]);
```

- [ ] **Step 8: Implement dashboard/availability structural refresh**

In `AdminDashboard.tsx`, import `subscribePageRefresh` and add a structure-only loader:

```ts
const refreshStructure = useCallback(async () => {
  const [nextEmployees, nextGroups] = await Promise.all([
    listSchedulerEmployees(),
    listGroups(),
  ]);
  setEmployees(nextEmployees);
  setGroups(nextGroups);
}, []);
```

Subscribe only for sections that actually render this parent-owned structure:

```ts
useEffect(() => {
  if (section !== "availability" && section !== "dashboard") return;
  return subscribePageRefresh(() => {
    void refreshStructure().catch((reason) => {
      console.error(reason);
      setError("Không làm mới được nhóm và nhân viên.");
    });
  });
}, [refreshStructure, section]);
```

Keep the existing submission 15-second refresh separate; group metadata does not need polling.

- [ ] **Step 9: Verify GREEN**

```bash
npm test -- src/admin/AdminSchedulerBehavior.test.tsx src/admin/AdminStructureRefresh.test.ts src/admin/AdminMatrix.test.tsx src/admin/AdminDashboard.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/admin/AdminScheduler.tsx src/admin/AdminSchedulerBehavior.test.tsx src/admin/EmployeeManager.tsx src/admin/GroupManager.tsx src/admin/AdminDashboard.tsx src/admin/AdminStructureRefresh.test.ts
git commit -m "feat: refresh group structure across admin views"
```

---

### Task 6: Add End-to-End Regression Coverage for Group Lifecycle Rendering

**Files:**
- Modify: `src/admin/AdminMatrix.test.tsx`
- Modify: `src/admin/SchedulerTable.test.tsx`
- Modify: `src/scheduling/scheduleSheetModel.test.ts`
- Create or modify: `src/admin/GroupManager.test.tsx` only if a static/source contract is needed beyond `GroupDeleteDialog.test.tsx`.

**Interfaces:**
- Verifies that the shared grouping behavior is visible in scheduler and availability surfaces.

- [ ] **Step 1: Add availability empty-group coverage**

Add to `AdminMatrix.test.tsx`:

```tsx
it("keeps configured groups visible even when they have no active employees", () => {
  const html = renderToStaticMarkup(
    <AdminMatrix
      employees={[employee]}
      groups={[
        { id: "group-meat", name: "Meat", sortOrder: 0 },
        { id: "group-bar", name: "Bar", sortOrder: 1 },
      ]}
      submissions={[]}
      weekStart="2026-09-14"
    />,
  );

  expect(html).toContain("Meat");
  expect(html).toContain("Bar");
});
```

- [ ] **Step 2: Add ungrouped rendering coverage**

In either `SchedulerTable.test.tsx` or shared model tests, create an employee with `groupId: null` and assert `Chưa có nhóm` plus the employee name are both present.

- [ ] **Step 3: Run the complete focused lifecycle set**

```bash
npm test -- \
  src/admin/GroupLifecycleMigration.test.ts \
  src/scheduling/api.test.ts \
  src/scheduling/scheduleSheetModel.test.ts \
  src/admin/GroupDeleteDialog.test.tsx \
  src/admin/SchedulerTable.test.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/admin/AdminMatrix.test.tsx \
  src/admin/AdminSchedulerBehavior.test.tsx \
  src/admin/AdminStructureRefresh.test.ts \
  src/scheduling/exportJpg.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/admin/AdminMatrix.test.tsx src/admin/SchedulerTable.test.tsx src/scheduling/scheduleSheetModel.test.ts src/admin/GroupManager.test.tsx
git commit -m "test: cover synchronized group lifecycle"
```

Only stage `GroupManager.test.tsx` if it was actually created.

---

### Task 7: Protect the New Flow in CI and Perform Final Verification

**Files:**
- Modify: `.github/workflows/port-scheduler-ci.yml`

**Interfaces:**
- Adds the new group lifecycle tests to the existing focused scheduler test step.

- [ ] **Step 1: Add focused test files to CI**

Add these files to the `Scheduler focused tests` command:

```text
src/admin/GroupLifecycleMigration.test.ts
src/admin/GroupDeleteDialog.test.tsx
src/admin/AdminStructureRefresh.test.ts
src/scheduling/scheduleSheetModel.test.ts
```

Keep all existing focused tests.

- [ ] **Step 2: Run focused tests locally when a checkout is available**

```bash
npm test -- \
  src/admin/GroupLifecycleMigration.test.ts \
  src/admin/GroupDeleteDialog.test.tsx \
  src/admin/AdminStructureRefresh.test.ts \
  src/scheduling/scheduleSheetModel.test.ts \
  src/admin/SchedulerTable.test.tsx \
  src/admin/AdminMatrix.test.tsx \
  src/scheduling/api.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full verification**

```bash
npm test
npm run build
npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts
npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts
git diff --check origin/main...HEAD
```

Expected: all commands succeed.

- [ ] **Step 4: Commit CI update**

```bash
git add .github/workflows/port-scheduler-ci.yml
git commit -m "ci: protect group lifecycle synchronization"
```

- [ ] **Step 5: Apply the migration to the intended Supabase project**

Before applying, confirm the CLI is linked to the intended project. Then run:

```bash
npx supabase db push
```

Expected: migration `202609160004_group_delete_set_null.sql` is applied successfully.

- [ ] **Step 6: Manual smoke test**

Use a disposable group and one non-critical employee:

```text
/admin/groups
Create BAR
→ BAR appears in group list

/admin/schedule?week=<existing-week>
Return/focus the tab
→ BAR appears as an empty group row
→ group row has no ◈ icon

/admin/employees
Assign Hùng to BAR
→ Hùng shows BAR

/admin/availability and /admin/schedule
Return/focus each tab
→ Hùng appears under BAR

/admin/groups
Rename BAR → BEVERAGE
→ return/focus employees, availability, schedule
→ BEVERAGE appears everywhere

/admin/groups
Delete BEVERAGE
→ confirmation says employees become Chưa có nhóm
→ confirm
→ Hùng remains active
→ Hùng's position is unchanged
→ existing availability/schedule data remains
→ /admin/employees shows Chưa có nhóm
→ /admin/availability and /admin/schedule place Hùng under Chưa có nhóm
```

- [ ] **Step 7: Final branch verification**

Confirm all writes remain on:

```text
feat/port-schedulework-scheduler
```

Do not merge or create a PR to `main` unless explicitly requested.
