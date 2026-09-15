# Port ScheduleWork Scheduler to Schedulework-Web — Design

## Goal

Bring the scheduling behavior of `hungdeniubeo/Schedulework` into `Schedulework-Web` while preserving the web app's Supabase persistence, authentication, registration/availability flow, draft/published/archive lifecycle, and existing Vietnamese admin navigation.

`Schedulework` is the behavioral source of truth for scheduler interactions. `Schedulework-Web` remains the architectural source of truth for storage, permissions, and publishing.

## Scope

### Port from Schedulework

- Drag shift types from the palette into Employee × Day cells.
- Select a shift and click cells for rapid assignment; Escape clears selection.
- Drag an existing shift to another employee/day.
- Reject overlapping or invalid shifts and keep the original assignment unchanged.
- Consolidate multiple non-overlapping shifts in one cell into one split-shift label ordered by time.
- Drag employees to reorder inside a group.
- Drag employees between groups, including dropping on a group header to insert at the start.
- Employee reordering must never transfer schedule entries between employees. Entries remain bound to `employee_id`.
- Persist employee `group_id` and normalized `sort_order` to Supabase so refresh preserves the order.
- Preserve scheduling-oriented employee indicators already supported by the web model, including position and NEW status.
- Show today/weekend context in the schedule grid.
- Preserve search and group filtering.
- Preserve Morning/Noon/Evening (`Sáng`, `Trưa`, `Tối`) automatic staffing counts with manual overrides.
- Preserve clear-current-week behavior with confirmation.
- Preserve high-resolution JPG export and block export/publish when schedule entries are invalid.
- Preserve shift creation/editing/deletion behavior through the web app's existing shift model; scheduler may link/open the existing manager rather than duplicating domain CRUD where duplication would create two sources of truth.
- Preserve the web app's draft/published/archive lifecycle. Editing a published week returns it to draft; archived weeks remain read-only.

### Web-only availability behavior

Availability is advisory. It must never block an otherwise valid official assignment.

- If the employee submitted OFF for that day, save the assignment and show a neutral informational notice.
- OFF with reason: `Nguyễn Văn A đã đăng ký nghỉ Thứ Ba — lý do: Đi khám bệnh.`
- OFF without reason: `Nguyễn Văn A đã đăng ký nghỉ Thứ Ba.`
- Do not append `Ca vẫn được xếp` or equivalent wording.
- If an assigned shift is not fully contained in the employee's submitted available intervals, save it and show a neutral informational notice.
- Partial containment counts as outside availability. Example: registered `10:00–18:00`, assigned `14:00–23:00` => notice.
- A split shift is fully compatible when each work interval is contained by the submitted intervals. Example: registered `10:00–14:00` plus `17:00–23:00`, assigned `10:00–14:00 / 17:00–23:00` => no notice.
- If the employee has no submission/day availability data, assign normally with no notice.
- Informational notices must not use blocking modals or destructive/error styling.
- Employee row reorder does not run availability checks because no schedule assignment changes.

## Architecture

### UI

Continue using `AdminScheduler` as page orchestrator and `ScheduleGrid` as the DnD/table interaction layer. Extend the DnD payload union with an employee payload, add employee/group droppable targets, and retain separate shift/cell collision behavior.

Do not copy the desktop `App.tsx` state container. All persistent mutations continue through `src/scheduling/api.ts`.

### Scheduling domain helpers

Keep conflict validation in `src/scheduling/overlap.ts` and consolidation in the existing scheduling helpers. Add focused helpers for employee reorder and advisory availability evaluation rather than embedding those rules in JSX.

### Persistence

Add an admin-only Supabase RPC that atomically moves one employee and normalizes sort orders in both the source and target groups. The frontend calls the RPC and reloads employee data after success. Schedule rows are untouched.

The RPC must run with explicit admin authorization and a fixed search path consistent with the repository's RLS/security rules.

### Notices

`AdminScheduler` owns transient informational scheduling notices separately from `error`. Invalid/overlap operations continue using error handling; availability mismatch uses an informational notice.

### Shift management

The web app already has a dedicated `ShiftManager` with conflict-safe edit logic. Scheduler keeps the shift palette and gains a direct navigation affordance to the existing manager if needed; it must not create a competing shift-edit implementation inside `ScheduleGrid`.

## Data flow

1. Scheduler loads groups, employees, shift types, weeks, entries, and matching availability.
2. Shift assignment/move is checked for overlap/invalid hours.
3. Valid assignment is persisted, including existing consolidation behavior.
4. After successful persistence, advisory availability is evaluated for the target employee/day and a neutral notice is shown when needed.
5. Employee drag computes target group/before-employee semantics and calls one atomic reorder RPC.
6. Employee data reloads; schedule entries remain unchanged because they reference stable employee IDs.
7. Publish/export validates the entire official schedule before producing a published state/image.

## Error handling

- Overlap/invalid time: block the assignment and show the existing error path.
- Employee reorder RPC failure: revert optimistic visual state or reload canonical employee state and show an error.
- Availability lookup failure: do not block scheduling; existing load error reporting may surface the failed lookup.
- Archived week: no scheduling or employee-order mutation from the schedule grid.
- Published week: first scheduling mutation returns it to draft using the existing `prepareScheduleWeekForEditing` flow.

## Testing

Add focused Vitest coverage for:

- employee reorder semantics inside a group and between groups;
- employee reorder preserving schedule ownership by stable employee IDs;
- OFF notice text with and without reason;
- no notice for missing availability;
- partial availability mismatch notice;
- split-shift containment across multiple availability intervals;
- overlap remains blocking;
- DnD payload routing distinguishes employee reorder from schedule-entry movement.

Add SQL-level coverage where practical for the employee reorder RPC. Run the repository-required validation commands before completion; report if local `supabase test db` cannot be run.

## Non-goals

- Do not port Tauri, local filesystem storage, or offline-only persistence.
- Do not remove authentication, RLS, availability registration, or publish/archive states.
- Do not introduce auto-scheduling/AI scheduling.
- Do not transfer shifts when employee rows are reordered.
- Do not add new state-management/UI framework dependencies.
