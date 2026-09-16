> **SUPERSEDED IN PART — 2026-09-16**
>
> Manual schedule-week creation and user-facing publish behavior in this document are superseded by `2026-09-16-unified-week-workflow-design.md` and `2026-09-16-scheduler-reference-parity-and-refresh-design.md`. Week deletion, availability semantics, and registration guidance remain valid where they do not conflict with newer specs.

# Scheduling Flow Audit and Week Lifecycle Design

Date: 2026-09-16
Branch: `feat/port-schedulework-scheduler`

## Goal

Harden the existing weekly scheduling workflow without replacing parts that already work correctly. The intended flow is:

1. Admin creates/updates/soft-deletes employees and assigns positions.
2. Admin creates a registration week.
3. That week becomes the employee-facing registration target with exact Monday-Sunday dates and a Vietnam-time deadline.
4. Employee submits availability.
5. The same submission appears in `/app/my-schedule` and `/admin/availability`.
6. Admin opens `/admin/schedule` for the same week and sees employee registration guidance in each schedule cell while assigning official shifts.
7. Admin may publish/export the schedule, archive the registration week, and later permanently delete the entire week's online data.

The implementation must preserve current behavior that is already correct and only change gaps identified in this audit.

## Existing behavior to preserve

### Employee and position linkage

- `employees.position_id` references `positions.id`.
- Employee and position management use the same Supabase source of truth.
- Updating an employee's position updates the employee model used by scheduling.
- Renaming a position updates displayed employee position names in the admin employee UI.
- An assigned position cannot be deleted until it is removed from employees.
- Employee deletion remains a soft delete so login/operational lists stop showing the employee while historical scheduling data remains available.

No new shared React state layer is needed between employee and position management. Supabase remains the authoritative shared state.

### Registration week timing

- Registration weeks must start on Monday.
- Week ranges remain Monday through Sunday.
- Registration deadlines continue to be interpreted in `Asia/Ho_Chi_Minh`.
- Default registration deadline remains Friday 22:00 before the work week unless explicitly edited by Admin.
- Existing timezone-safe date helpers and tests stay intact.

### Availability data sharing

`availability_submissions` remains the single source of truth for employee registration data.

- `/app/availability` writes submissions.
- `/app/my-schedule` reads the same employee submission for the selected/current registration week.
- `/admin/availability` reads the same submissions for the selected week.
- `/admin/schedule` resolves registration submissions by matching `registration_weeks.week_start` to the selected schedule week.

### Scheduler rules

Availability is guidance only.

- Admin can still schedule a shift outside registered availability.
- Admin can still schedule on a registered OFF day.
- These cases produce informational feedback only.
- Missing registration produces no warning.
- Existing overlap/invalid-time validation remains blocking.

## Week lifecycle

A registration week and a schedule week with the same `week_start` are treated as one workflow lifecycle even though they remain separate database tables.

Lifecycle:

`registration week -> employee submissions -> schedule week -> schedule entries -> export/archive -> permanent delete`

### Create

Admin creates a registration week in `/admin/registration-weeks`.

- It immediately becomes eligible for employee registration selection according to the existing nearest-open-week logic.
- Employee pages display the exact Monday-Sunday range and exact deadline in Vietnam time.
- Creating a registration week does not automatically create a `schedule_week`.

### Schedule creation

From `/admin/availability`, `Xếp lịch tuần này` navigates to:

`/admin/schedule?week=YYYY-MM-DD`

If a matching schedule week does not yet exist, Admin sees the existing explicit create state and must click `Tạo lịch tuần này`.

The system must never silently create schedule weeks.

### Archive

Archiving a registration week keeps its data but removes it from the main active-week management area.

On `/admin/registration-weeks`:

- open/locked non-archived weeks remain in the primary management UI;
- archived weeks move into a separate `Tuần đã lưu trữ` section;
- this section is collapsed by default;
- archived rows remain intentionally compact: week/range, status, delete action;
- archived weeks may still be permanently deleted.

Employee registration selection continues to ignore archived weeks.

### Permanent deletion

Deleting a week means deleting the full workflow for that `week_start`.

A single transactional database operation must delete:

1. `availability_submissions` belonging to the registration week;
2. `schedule_entries` belonging to a matching schedule week;
3. matching `schedule_week`;
4. matching `registration_week`.

`availability_submissions` and `schedule_entries` may rely on their existing cascade relationships where appropriate, but the user-facing operation must be one atomic database transaction. If any part fails, nothing is partially deleted.

Deletion is keyed by the selected registration week and its `week_start`, not by an independently selected schedule week.

After successful deletion:

- the deleted week disappears from `/admin/registration-weeks`;
- it can no longer appear in `/admin/availability`;
- it can no longer appear in `/admin/schedule`;
- employee registration/my-schedule views can no longer select it;
- if it was the selected admin week, the admin UI resolves to the next valid registration week, or to the existing empty state when none remain.

The exported JPG is external to this lifecycle and is not managed/deleted by the web app.

## Permanent-delete confirmation UI

The existing basic delete confirmation is replaced with a styled destructive confirmation dialog.

The dialog must include:

- a clear warning icon/tone;
- the exact week display/range;
- explicit text that employee registrations and the official schedule for that week will both be permanently deleted;
- `Hủy` as the safe secondary action;
- `Xóa toàn bộ tuần` as the destructive action;
- a busy/loading state while deletion runs;
- no accidental dismissal while the delete operation is in progress.

On success, show a lightweight toast such as:

`Đã xóa tuần 05/10 – 11/10 và toàn bộ dữ liệu liên quan.`

The toast should match the existing admin visual language and disappear automatically after a short interval.

## Availability guidance inside Admin Scheduler

### Visual hierarchy

Each schedule cell shows official scheduled shifts first, and registration guidance second.

Preferred order:

```text
17:00 – 23:00

ĐK · 10:00 – 14:00
```

The registration guidance is visually subordinate:

- smaller than official shift chips;
- lighter background/border/text treatment;
- positioned below official shifts;
- compact enough not to make the grid visually noisy;
- no registration hint when no submission exists.

### Shift synchronization

The registration pill must use the shared shift definitions from `/admin/shifts` when the employee's registered interval(s) exactly match a configured `ShiftType`.

Exact-match behavior:

- normalize configured shift labels into one or two time intervals;
- normalize employee registration intervals;
- when the interval lists are equal, use the matching `ShiftType` label/color as the visual source;
- retain a lighter registration-specific presentation so it cannot be confused with an official scheduled shift.

Examples:

- registered `10:00-14:00` and configured shift `10:00-14:00` -> use that shift's configured color/label, visually muted;
- registered split intervals that exactly equal a configured split shift -> use that configured split shift;
- registered `10:00-18:00` with no configured exact shift -> display `ĐK · 10:00–18:00` using a neutral muted style;
- registered OFF -> display `ĐK · Nghỉ` using an OFF-specific muted style.

The scheduler must not create a new shift definition from a registration interval and must not loosely guess the nearest shift.

### Registration detail interaction

The registration pill is interactive.

Clicking it opens a small lightweight detail popover near the cell containing the full registered interval(s) and OFF reason when applicable.

The popover must not mutate registration data. It is read-only context for Admin.

Long OFF reasons stay out of the schedule cell itself to avoid layout clutter.

## `/admin/registration-weeks` information architecture

The page remains the sole place for registration-week lifecycle management.

Primary section:

- create week;
- select active/non-archived week;
- edit registration deadline;
- lock registration;
- reopen registration;
- archive;
- permanently delete.

Archived section:

- collapsed by default;
- compact list only;
- shows enough information to identify the week;
- supports permanent deletion;
- avoids repeating the large active-week management card UI.

No additional week-management controls should be added to `/admin/availability` or employee pages.

## Flow audit requirements

Implementation work begins with regression tests around the current flows before changing production code.

Audit and preserve if already correct:

1. Employee creation provisions Auth/profile/employee records and returns temporary credentials.
2. Employee name/group/position edits persist correctly.
3. Position create/rename/reorder/delete rules remain correct.
4. Soft-deleted employees disappear from operational lists and cannot log in while history is preserved.
5. Registration week Monday validation remains correct.
6. Vietnam-time deadline conversion and lock behavior remain correct at the exact boundary.
7. Creating/deleting weeks changes employee-visible registration selection correctly.
8. Employee submission refreshes `/app/my-schedule` after save.
9. Admin availability reads the same week's submissions.
10. `Xếp lịch tuần này` preserves `?week=` and opens the same week.
11. Schedule availability loader only reads submissions from the registration week with the same `week_start`.
12. Scheduler registration guidance remains non-blocking.
13. `/app/team-schedule` remains intentionally unavailable.

If an audited flow already has sufficient implementation and regression coverage, do not refactor it only for consistency.

## Database design

Add a migration exposing an Admin-only RPC for permanent week deletion, for example conceptually:

`delete_registration_workflow(target_registration_week_id uuid)`

The function must:

- verify/admin-authorize execution using the established security pattern;
- read the selected registration week's `week_start`;
- delete the matching schedule workflow and registration workflow inside the same PostgreSQL transaction;
- work whether or not a matching `schedule_week` exists;
- work for open, locked, or archived registration weeks;
- fail safely for an invalid/nonexistent registration week;
- not delete unrelated weeks.

The frontend `deleteWeek` API should call this RPC instead of issuing a direct registration-week delete.

## Error handling

- Failed permanent deletion leaves all week data intact and keeps the delete dialog open with an inline error.
- Failed registration pill detail rendering must not block scheduler usage; fallback to plain registration text.
- Failure to match a registered interval to a shift is not an error; it uses neutral styling.
- Existing employee/position/week/scheduler error messages remain unless a new flow requires a more specific message.

## Styling

Use dedicated CSS files and existing admin design tokens/patterns.

Likely touched styling areas:

- `RegistrationWeeks.css` for archived section and destructive dialog/toast presentation;
- `AdminSchedule.css` for official-shift-first cell layout, muted registration pill and popover;
- shared dialog/toast styles only if a reusable existing pattern makes that cleaner.

Avoid inline one-off layout styling where CSS classes are appropriate.

The visual priority is readability over decoration. No heavy animation, strong gradients, or competing colors should be introduced.

## Testing strategy

Use TDD for changed behavior.

Required coverage includes:

- database migration/RPC contract where feasible in existing Supabase tests;
- frontend API calls the transactional delete RPC;
- permanent delete handles weeks with and without matching schedule weeks;
- archived weeks are separated from active weeks and remain deletable;
- delete confirmation copy accurately describes full deletion;
- success toast appears after full deletion;
- employee registration week/date/time helpers remain timezone-safe;
- my-schedule/admin-availability continue reading the same submissions;
- exact registration interval -> configured shift match;
- split interval -> configured split shift match;
- unmatched registration interval -> neutral registration pill;
- OFF registration -> OFF pill;
- registration pill renders below official shifts;
- registration detail interaction exposes full context without mutating data;
- availability guidance remains non-blocking;
- existing full test/build/CI suite remains green.

## Non-goals

- Do not merge `registration_weeks` and `schedule_weeks` into one table.
- Do not auto-create schedule weeks when a registration week is created.
- Do not restore `/app/team-schedule`.
- Do not turn availability into a hard scheduling constraint.
- Do not auto-create shift types from employee registrations.
- Do not redesign unrelated admin pages.
- Do not change `main`; all implementation work stays on `feat/port-schedulework-scheduler` until explicitly requested otherwise.

## Success criteria

The flow is considered complete when an Admin can create a weekly registration window, employees see and submit against the exact intended week/deadline, the same submission is visible in both employee and admin views, Admin can schedule with clear low-noise registration guidance that reuses configured shift styling when exact matches exist, and Admin can archive or atomically delete the entire week's online workflow without leaving orphaned schedule data.
