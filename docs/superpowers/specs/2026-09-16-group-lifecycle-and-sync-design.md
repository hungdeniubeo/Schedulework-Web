# Group lifecycle and synchronization design

Date: 2026-09-16
Branch: `feat/port-schedulework-scheduler`

## Goal

Make `Nhóm` a single synchronized source of truth across the admin experience. Creating, renaming, reordering, or deleting a group must be reflected consistently in employee management, availability, scheduling, and exported schedule visuals.

The required lifecycle is:

- creating a group makes that group visible in schedule-style tables immediately, even when it has no employees yet;
- renaming a group updates the name everywhere after data refresh;
- deleting a group does **not** delete employees, availability submissions, schedule entries, or employee accounts;
- employees from a deleted group become ungrouped (`group_id = null`) and are displayed as `Chưa có nhóm`;
- the scheduler group heading contains only the group name, with no decorative area icon.

## Current problems

1. `buildScheduleGroups()` filters out group sections with zero employees, so a newly created group does not appear in `/admin/schedule` or other views that use the shared schedule grouping model until an employee is assigned to it.
2. `employees.group_id` currently references `groups.id` with `ON DELETE RESTRICT`, so the database blocks deletion of a group that still has employees.
3. `SchedulerTable` renders a decorative `◈` before each group name even though the desired schedule design only needs the centered group label.
4. Group mutations are persisted in Supabase, but long-lived admin pages do not all refresh the shared group/employee structure when another page or tab modifies it.

## Database behavior

Add migration:

`supabase/migrations/202609160004_group_delete_set_null.sql`

The migration changes only the `employees.group_id -> groups.id` foreign key delete behavior:

- drop the existing foreign key constraint;
- recreate it with `ON DELETE SET NULL`;
- keep `group_id` nullable;
- do not touch employee, availability, or schedule history.

Expected result:

```text
Employee.group_id = BAR
        ↓
Admin deletes BAR
        ↓
Employee.group_id = null
        ↓
Employee remains active and all existing schedule/availability data remains intact
```

No frontend loop should manually unassign every employee before deleting the group. The database owns this referential behavior atomically.

## Group manager behavior

`/admin/groups` remains the place to create, rename, reorder, and delete groups.

### Create

After creating a group:

- reload the group list;
- the group is immediately persisted as the next sorted group;
- schedule-style views must be able to render it even if it has zero employees.

### Rename

After renaming:

- persist the new name through `patchGroup()`;
- reload the local group list;
- other admin views pick up the new name through their shared structure refresh behavior.

### Delete

Deletion is allowed even if employees currently reference the group.

Before deletion, show a confirmation dialog with wording equivalent to:

> Xóa nhóm BAR?
>
> Nhân viên trong nhóm sẽ chuyển sang “Chưa có nhóm”. Lịch làm việc và dữ liệu đăng ký không bị xóa.

On confirmation:

- delete the group once;
- rely on `ON DELETE SET NULL` for affected employees;
- reload groups locally;
- do not delete or deactivate affected employees.

## Shared grouping model

Update `buildScheduleGroups(groups, employees)` so that all real groups are preserved in sorted order even when empty.

Rules:

1. Every group returned by `listGroups()` produces a section.
2. Employees whose `groupId` matches a real group appear under that group.
3. `Chưa có nhóm` is a synthetic section and appears **only when at least one employee has `groupId = null`**.
4. Do not create an empty `Chưa có nhóm` section.
5. Group ordering continues to use `sortOrder`.
6. Employee ordering inside a group continues to use employee `sortOrder`, then Vietnamese name ordering as the stable fallback.

Because both the scheduler and availability table depend on the shared grouping model, this change synchronizes their structural behavior automatically.

## Scheduler presentation

In `/admin/schedule`:

- render empty real groups as group separator rows;
- remove the decorative area icon (`◈`) from group headings;
- keep the group name centered and uppercase as in the current scheduler style;
- keep existing area tone classes if they are still needed for row accents, but do not render a visible icon;
- preserve all schedule entries, employee rows, drag/drop, availability pills, totals, and JPG export behavior.

Because JPG export now captures the live schedule DOM, removing the icon and changing group visibility on the live table must also appear identically in exported images.

## Employee behavior after group deletion

When a group is deleted:

- affected employees remain in `employees`;
- their `groupId` becomes `null` at the database layer;
- `/admin/employees` shows `Chưa có nhóm` for those employees;
- the employee group selector has the blank `Chưa có nhóm` option selected;
- `/admin/schedule` places them under the synthetic `Chưa có nhóm` section;
- `/admin/availability` places them under the same `Chưa có nhóm` section;
- no position, account, active state, availability submission, or schedule entry is removed.

## Cross-page synchronization

Supabase remains the source of truth. Do not create a second client-side global group store.

Long-lived admin screens that display groups or employee-group assignments should refresh structural data when the page becomes active again:

- `/admin/schedule`: refresh `groups + employees` on window focus / visible tab, without reloading schedule entries or resetting in-progress schedule interaction;
- `/admin/employees`: refresh `groups + employees` on window focus / visible tab, while preserving unrelated UI state where practical;
- `/admin/availability` and dashboard views that render employee/group structure: refresh the base `groups + employees` data on focus / visible tab;
- `/admin/groups`: after each create/rename/reorder/delete, reload its own authoritative group list. It may also refresh on focus so changes from another tab are visible.

Use the existing page-refresh utility/pattern rather than introducing another polling framework. A periodic group poll is not required; focus/visibility refresh is sufficient for structural metadata.

## Error handling

- If group deletion fails for a database reason, keep the group visible and show an inline error.
- The old message saying a group cannot be deleted because it has employees must be removed because that condition is no longer an error.
- A failed cross-page refresh must not clear the currently displayed scheduler or employee data; report the refresh problem non-destructively.
- Group rename should reject an empty trimmed name and restore/display the previous valid name if persistence fails.

## Testing requirements

Add regression coverage for:

1. the migration changes the employee group foreign key to `ON DELETE SET NULL`;
2. `removeGroup()` no longer reports “move employees first” as the expected behavior;
3. `buildScheduleGroups()` keeps an empty real group;
4. `buildScheduleGroups()` shows `Chưa có nhóm` only when ungrouped employees exist;
5. an employee with `groupId = null` is rendered under `Chưa có nhóm`;
6. Scheduler group headings no longer render `◈`;
7. GroupManager deletion confirmation explains that employees become ungrouped and history is preserved;
8. the scheduler structural refresh reloads groups/employees without reloading official schedule entries;
9. employee/admin availability structural refresh picks up renamed/deleted groups on focus/visibility;
10. existing scheduler, availability, employee, export, and drag/drop tests remain green.

## Acceptance flow

A complete manual smoke test is:

```text
Create group BAR
→ BAR immediately appears as an empty area in /admin/schedule
→ BAR also appears as an available group in /admin/employees

Assign employee Hùng to BAR
→ Hùng appears under BAR in employees, availability, and scheduler

Rename BAR → BEVERAGE
→ return/focus each admin view
→ BEVERAGE appears everywhere; BAR no longer appears

Delete BEVERAGE
→ confirmation explains employees will become ungrouped
→ group disappears
→ Hùng still exists and stays active
→ Hùng now shows “Chưa có nhóm”
→ scheduler/availability place Hùng under “Chưa có nhóm”
→ Hùng's existing schedule entries and availability data remain intact

Scheduler group headings
→ display only centered group names
→ no area icon before the name
```

## Non-goals

- Do not delete employees when deleting groups.
- Do not delete or rewrite historical schedule entries or availability submissions.
- Do not introduce a new global state library for groups.
- Do not change position lifecycle behavior.
- Do not change week lifecycle behavior.
- Do not change the scheduler's shift assignment, totals, export, or availability matching logic beyond the group-row presentation and structural refresh described above.
- Do not modify `main`; implementation remains on `feat/port-schedulework-scheduler` until explicitly requested otherwise.
