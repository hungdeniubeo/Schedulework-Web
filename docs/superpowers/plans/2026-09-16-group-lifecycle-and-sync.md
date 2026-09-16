# Group Lifecycle and Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make group creation, rename, reorder, and deletion behave consistently across employee management, availability, scheduling, and exported schedule visuals, while preserving employees and history when a group is deleted.

**Architecture:** Supabase remains the single source of truth. PostgreSQL owns deletion semantics with `ON DELETE SET NULL`; `buildScheduleGroups()` owns the shared grouping rules; long-lived admin views reload only group/employee structure when focus/visibility returns. Scheduler, availability, and JPG export continue to consume the same live schedule structure instead of duplicating group logic.

**Tech Stack:** React 19, TypeScript, Vite/Vitest, Supabase/PostgreSQL, existing `subscribePageRefresh` utility, existing scheduler components, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-group-lifecycle-and-sync-design.md`

## Global Constraints

- Work only on `feat/port-schedulework-scheduler`; do not modify, merge, or create a PR to `main` unless explicitly requested later.
- Deleting a group must never delete/deactivate employees, employee accounts, positions, availability submissions, schedule weeks, or schedule entries.
- Employees from a deleted group must become `group_id = null` and display as `Chưa có nhóm`.
- Every real group must render in schedule-style tables even with zero employees.
- Synthetic `Chưa có nhóm` renders only when at least one employee has no group.
- Scheduler group headings contain only the group name; remove `◈`.
- Cross-page structural refresh uses focus/visibility only; do not add a new polling framework or global state library.
- Scheduler structural refresh must not reload official schedule entries.
- Export continues to capture the live scheduler DOM, so there is no separate export group-layout implementation.

---

### Task 1: Change Group Delete Semantics in PostgreSQL

**Files:**
- Create: `supabase/migrations/202609160004_group_delete_set_null.sql`
- Create: `src/admin/GroupLifecycleMigration.test.ts`

**Interfaces:**
- Consumes: nullable `public.employees.group_id`.
- Produces: `employees_group_id_fkey` referencing `public.groups(id) ON DELETE SET NULL`.

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

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/admin/GroupLifecycleMigration.test.ts
```

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/202609160004_group_delete_set_null.sql`:

```sql
alter table public.employees
  drop constraint if exists employees_group_id_fkey;

alter table public.employees
  add constraint employees_group_id_fkey
  foreign key (group_id)
  references public.groups(id)
  on delete set null;
```

Do not add manual employee-update loops.

- [ ] **Step 4: Verify GREEN**

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

### Task 2: Preserve Empty Groups in the Shared Schedule Grouping Model

**Files:**
- Modify: `src/scheduling/scheduleSheetModel.ts`
- Modify: `src/scheduling/scheduleSheetModel.test.ts`

**Interfaces:**
- Produces: `export const UNGROUPED_GROUP_ID = "ungrouped"`.
- Produces: `buildScheduleGroups(groups, employees)` retaining every real group in `sortOrder` and appending a synthetic ungrouped section only when needed.

- [ ] **Step 1: Add failing grouping tests**

Extend `src/scheduling/scheduleSheetModel.test.ts` with:

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

it("adds Chưa có nhóm only when at least one employee is ungrouped", () => {
  const groups: Group[] = [{ id: "g1", name: "MEAT", sortOrder: 0 }];

  expect(
    buildScheduleGroups(groups, [employee("hung", null, 0)]).map(
      (section) => section.group.name,
    ),
  ).toEqual(["MEAT", "Chưa có nhóm"]);

  expect(
    buildScheduleGroups(groups, [employee("hung", "g1", 0)]).map(
      (section) => section.group.name,
    ),
  ).toEqual(["MEAT"]);
});
```

Update the existing grouped-order expectation so an empty configured group remains present.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/scheduling/scheduleSheetModel.test.ts
```

Expected: FAIL because the current implementation filters empty sections.

- [ ] **Step 3: Implement the shared grouping rule**

Refactor `src/scheduling/scheduleSheetModel.ts`:

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

- [ ] **Step 4: Verify GREEN across both schedule surfaces**

```bash
npm test -- src/scheduling/scheduleSheetModel.test.ts src/admin/AdminMatrix.test.tsx src/admin/SchedulerTable.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduling/scheduleSheetModel.ts src/scheduling/scheduleSheetModel.test.ts
git commit -m "feat: keep empty groups in schedule views"
```

---

### Task 3: Make Group Deletion Explicit and Safe in `/admin/groups`

**Files:**
- Create: `src/admin/GroupDeleteDialog.tsx`
- Create: `src/admin/GroupDeleteDialog.test.tsx`
- Create: `src/admin/GroupManager.test.ts`
- Modify: `src/admin/GroupManager.tsx`
- Modify: `src/scheduling/api.ts`
- Modify: `src/scheduling/api.test.ts`

**Interfaces:**
- `GroupDeleteDialog({ group, deleting, onCancel, onConfirm })` uses existing `ModalBackdrop`/`confirm-dialog` UI.
- `removeGroup(id: string): Promise<void>` performs one delete and reports `Không xóa được nhóm.` on failure.

- [ ] **Step 1: Add API regression coverage**

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

  it("uses generic delete failure copy instead of move-employees-first copy", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.client = clientWithGroupDelete({ message: "database failure" });

    await expect(removeGroup("group-1")).rejects.toThrow("Không xóa được nhóm.");
  });
});
```

- [ ] **Step 2: Add dialog and wiring tests**

Create `src/admin/GroupDeleteDialog.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GroupDeleteDialog } from "./GroupDeleteDialog";

it("explains that employees become ungrouped while schedule data stays", () => {
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
});
```

Create `src/admin/GroupManager.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import source from "./GroupManager.tsx?raw";

describe("GroupManager delete flow", () => {
  it("opens the confirmation dialog instead of deleting directly from the row", () => {
    expect(source).toContain("deleteTarget");
    expect(source).toContain("setDeleteTarget(group)");
    expect(source).toContain("<GroupDeleteDialog");
  });

  it("reloads the authoritative group list after confirmed deletion", () => {
    expect(source).toContain("await removeGroup(deleteTarget.id)");
    expect(source).toContain("await load()");
  });
});
```

- [ ] **Step 3: Verify RED**

```bash
npm test -- src/scheduling/api.test.ts src/admin/GroupDeleteDialog.test.tsx src/admin/GroupManager.test.ts
```

Expected: FAIL because delete copy is stale and dialog/wiring do not exist.

- [ ] **Step 4: Implement API and dialog**

Change `removeGroup()` to:

```ts
export async function removeGroup(id: string): Promise<void> {
  const { error } = await getSupabase().from("groups").delete().eq("id", id);
  fail(error, "Không xóa được nhóm.");
}
```

Implement `GroupDeleteDialog` with:

```tsx
<ModalBackdrop onClose={() => !deleting && onCancel()}>
  <section role="alertdialog" aria-modal="true" className="confirm-dialog">
    <h2>Xóa nhóm {group.name}?</h2>
    <p>
      Nhân viên trong nhóm sẽ chuyển sang “Chưa có nhóm”. Lịch làm việc và dữ
      liệu đăng ký không bị xóa.
    </p>
    <footer>
      <button className="button secondary" disabled={deleting} onClick={onCancel}>
        Hủy
      </button>
      <button className="button ghost danger" disabled={deleting} onClick={onConfirm}>
        {deleting ? "Đang xóa..." : "Xóa nhóm"}
      </button>
    </footer>
  </section>
</ModalBackdrop>
```

- [ ] **Step 5: Wire GroupManager exactly**

In `GroupManager.tsx`:

```ts
const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);

async function confirmDelete() {
  if (!deleteTarget || busy) return;
  setBusy(true);
  setError(null);
  try {
    await removeGroup(deleteTarget.id);
    await load();
    setDeleteTarget(null);
  } catch (reason) {
    setError(reason instanceof Error ? reason.message : "Không xóa được nhóm.");
  } finally {
    setBusy(false);
  }
}
```

The row button becomes:

```tsx
<button
  className="button ghost danger"
  type="button"
  disabled={busy}
  onClick={() => setDeleteTarget(group)}
>
  Xóa
</button>
```

Render `GroupDeleteDialog` when `deleteTarget !== null`.

For rename, if the trimmed name is empty, immediately restore `event.currentTarget.value = group.name`. If `patchGroup()` rejects, restore the previous value and show the error. On success, `await load()`.

- [ ] **Step 6: Verify GREEN**

```bash
npm test -- src/scheduling/api.test.ts src/admin/GroupDeleteDialog.test.tsx src/admin/GroupManager.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/scheduling/api.ts src/scheduling/api.test.ts src/admin/GroupDeleteDialog.tsx src/admin/GroupDeleteDialog.test.tsx src/admin/GroupManager.tsx src/admin/GroupManager.test.ts
git commit -m "feat: allow safe group deletion"
```

---

### Task 4: Render Group Rows Correctly in Scheduler and Availability

**Files:**
- Modify: `src/admin/SchedulerTable.tsx`
- Modify: `src/admin/SchedulerTable.test.tsx`
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify: `src/admin/ScheduleGrid.test.tsx`
- Modify: `src/admin/AdminMatrix.test.tsx`
- Modify: `src/admin/AdminSchedule.css`

**Interfaces:**
- Consumes: `UNGROUPED_GROUP_ID` from `src/scheduling/scheduleSheetModel.ts`.
- Empty real groups remain visible and valid drop targets.
- Synthetic `Chưa có nhóm` remains visible but is not a group drop target because it is not a database UUID.

- [ ] **Step 1: Add scheduler/availability rendering tests**

Add to `SchedulerTable.test.tsx`:

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

it("renders ungrouped employees under Chưa có nhóm", () => {
  const html = renderToStaticMarkup(
    <SchedulerTable
      groups={[{ id: "meat", name: "MEAT", sortOrder: 0 }]}
      employees={[{ ...employee, groupId: null }]}
      entries={[]}
      shifts={shifts}
      weekStart="2026-09-21"
    />,
  );

  expect(html).toContain("Chưa có nhóm");
  expect(html).toContain("Nguyễn Phi Hùng");
});
```

Add to `AdminMatrix.test.tsx`:

```tsx
it("keeps configured empty groups visible", () => {
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

Add a source assertion to `ScheduleGrid.test.tsx` that `UNGROUPED_GROUP_ID` is imported and checked when enabling `GroupDropRow`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/admin/SchedulerTable.test.tsx src/admin/ScheduleGrid.test.tsx src/admin/AdminMatrix.test.tsx
```

Expected: FAIL because the icon still exists and empty groups are currently filtered by the old shared model until Task 2 is implemented.

- [ ] **Step 3: Remove the area icon**

Change SchedulerTable group markup to:

```tsx
<div className="scheduler-group-label">
  <strong>{group.name.toLocaleUpperCase("vi")}</strong>
</div>
```

Remove the unused `.scheduler-group-mark` CSS rule from `AdminSchedule.css`.

- [ ] **Step 4: Make synthetic ungrouped non-droppable**

Import:

```ts
import { UNGROUPED_GROUP_ID } from "../scheduling/scheduleSheetModel";
```

When rendering `GroupDropRow`, use:

```tsx
editable={
  props.editable &&
  Boolean(props.onMoveEmployee) &&
  group.id !== UNGROUPED_GROUP_ID
}
```

Keep real empty groups droppable so an employee can be dragged into a newly created group.

- [ ] **Step 5: Verify GREEN including export**

```bash
npm test -- src/admin/SchedulerTable.test.tsx src/admin/ScheduleGrid.test.tsx src/admin/AdminMatrix.test.tsx src/scheduling/exportJpg.test.ts
```

Expected: PASS. No export component changes are needed because JPG export captures the live schedule DOM.

- [ ] **Step 6: Commit**

```bash
git add src/admin/SchedulerTable.tsx src/admin/SchedulerTable.test.tsx src/admin/ScheduleGrid.tsx src/admin/ScheduleGrid.test.tsx src/admin/AdminMatrix.test.tsx src/admin/AdminSchedule.css
git commit -m "style: synchronize scheduler group rows"
```

---

### Task 5: Refresh Group and Employee Structure Across Admin Views

**Files:**
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSchedulerBehavior.test.tsx`
- Modify: `src/admin/EmployeeManager.tsx`
- Modify: `src/admin/GroupManager.tsx`
- Modify: `src/admin/AdminDashboard.tsx`
- Create: `src/admin/AdminStructureRefresh.test.ts`

**Interfaces:**
- Consumes: `subscribePageRefresh(refresh)` from `src/lib/pageRefresh.ts`.
- Scheduler structural refresh updates `groups + employees` only.
- Availability/dashboard parent refresh updates `groups + employees` only; existing submission polling remains separate.

- [ ] **Step 1: Add scheduler structural-refresh test**

Extend `AdminSchedulerBehavior.test.tsx`:

```ts
it("refreshes groups and employees separately from official schedule entries", () => {
  expect(source).toContain("loadStructure");
  expect(source).toContain("listGroups()");
  expect(source).toContain("listSchedulerEmployees()");
  expect(source).toContain("subscribePageRefresh");
});
```

- [ ] **Step 2: Add source contracts for employee/group/dashboard pages**

Create `src/admin/AdminStructureRefresh.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import employeeManagerSource from "./EmployeeManager.tsx?raw";
import groupManagerSource from "./GroupManager.tsx?raw";
import dashboardSource from "./AdminDashboard.tsx?raw";

describe("admin group structure refresh", () => {
  it("refreshes employee groups on focus/visibility", () => {
    expect(employeeManagerSource).toContain("subscribePageRefresh");
    expect(employeeManagerSource).toContain("loadEmployeeStructure");
  });

  it("refreshes the group manager from Supabase on focus/visibility", () => {
    expect(groupManagerSource).toContain("subscribePageRefresh");
    expect(groupManagerSource).toContain("await listGroups()");
  });

  it("refreshes dashboard/availability structure on focus/visibility", () => {
    expect(dashboardSource).toContain("subscribePageRefresh");
    expect(dashboardSource).toContain("refreshStructure");
  });
});
```

- [ ] **Step 3: Verify RED**

```bash
npm test -- src/admin/AdminSchedulerBehavior.test.tsx src/admin/AdminStructureRefresh.test.ts
```

Expected: FAIL because the dedicated structural refresh paths do not exist yet.

- [ ] **Step 4: Implement scheduler structure refresh**

Add to `AdminScheduler.tsx`:

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

Subscribe with no interval:

```ts
useEffect(() =>
  subscribePageRefresh(() => {
    void loadStructure().catch((reason) => {
      console.error(reason);
      setNotice(
        "Không làm mới được nhóm/nhân viên. Lịch đang xếp vẫn được giữ nguyên.",
      );
    });
  }),
[loadStructure]);
```

Do not call `loadEntries()` in this structural refresh.

Reset a deleted active filter:

```ts
useEffect(() => {
  if (groupFilter !== "all" && !groups.some((group) => group.id === groupFilter)) {
    setGroupFilter("all");
  }
}, [groupFilter, groups]);
```

- [ ] **Step 5: Implement EmployeeManager structure refresh**

Import `useCallback` and `subscribePageRefresh`.

Add:

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

Subscribe while mutations are idle:

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

Do not clear existing employees/groups before the request resolves.

- [ ] **Step 6: Implement GroupManager focus refresh**

Wrap `load` with `useCallback`:

```ts
const load = useCallback(async () => {
  setGroups(await listGroups());
}, []);
```

Then:

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

- [ ] **Step 7: Implement dashboard/availability parent structure refresh**

Import `subscribePageRefresh` in `AdminDashboard.tsx` and add:

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

Subscribe only where those parent-owned arrays are rendered:

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

Keep existing submission refresh/polling unchanged.

- [ ] **Step 8: Verify GREEN**

```bash
npm test -- src/admin/AdminSchedulerBehavior.test.tsx src/admin/AdminStructureRefresh.test.ts src/admin/AdminMatrix.test.tsx src/admin/AdminDashboard.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/admin/AdminScheduler.tsx src/admin/AdminSchedulerBehavior.test.tsx src/admin/EmployeeManager.tsx src/admin/GroupManager.tsx src/admin/AdminDashboard.tsx src/admin/AdminStructureRefresh.test.ts
git commit -m "feat: refresh group structure across admin views"
```

---

### Task 6: Protect the Lifecycle in Focused CI and Run Final Verification

**Files:**
- Modify: `.github/workflows/port-scheduler-ci.yml`

**Interfaces:**
- Adds every new group-lifecycle regression test to the existing focused scheduler step.

- [ ] **Step 1: Add focused tests to CI**

Add these paths to `Scheduler focused tests`:

```text
src/admin/GroupLifecycleMigration.test.ts
src/admin/GroupDeleteDialog.test.tsx
src/admin/GroupManager.test.ts
src/admin/AdminStructureRefresh.test.ts
src/scheduling/scheduleSheetModel.test.ts
```

Keep every existing focused test.

- [ ] **Step 2: Run focused verification**

```bash
npm test -- \
  src/admin/GroupLifecycleMigration.test.ts \
  src/admin/GroupDeleteDialog.test.tsx \
  src/admin/GroupManager.test.ts \
  src/admin/AdminStructureRefresh.test.ts \
  src/scheduling/scheduleSheetModel.test.ts \
  src/scheduling/api.test.ts \
  src/admin/SchedulerTable.test.tsx \
  src/admin/ScheduleGrid.test.tsx \
  src/admin/AdminMatrix.test.tsx \
  src/admin/AdminSchedulerBehavior.test.tsx \
  src/scheduling/exportJpg.test.ts
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

- [ ] **Step 4: Commit CI protection**

```bash
git add .github/workflows/port-scheduler-ci.yml
git commit -m "ci: protect group lifecycle synchronization"
```

- [ ] **Step 5: Apply the migration to the intended Supabase project**

After verifying the CLI is linked to the intended project:

```bash
npx supabase db push
```

Expected: `202609160004_group_delete_set_null.sql` applies successfully.

- [ ] **Step 6: Run the manual acceptance flow**

```text
1. /admin/groups → create BAR.
2. /admin/schedule?week=<existing-week> → return/focus tab → BAR appears even with no employees and no ◈ icon.
3. /admin/employees → assign Hùng to BAR.
4. Return/focus /admin/availability and /admin/schedule → Hùng appears under BAR.
5. /admin/groups → rename BAR to BEVERAGE.
6. Return/focus employees, availability, schedule → BEVERAGE appears everywhere; BAR disappears.
7. /admin/groups → delete BEVERAGE → confirmation says employees become Chưa có nhóm and history stays.
8. Confirm deletion.
9. Verify Hùng still exists, stays active, keeps the same position, schedule entries and availability data.
10. Verify employees shows Chưa có nhóm and schedule/availability place Hùng under Chưa có nhóm.
11. Export JPG and verify the same group headings/no-icon presentation as the live table.
```

- [ ] **Step 7: Final branch check**

Confirm all implementation commits remain on:

```text
feat/port-schedulework-scheduler
```

Do not merge or create a PR to `main` unless explicitly requested.
