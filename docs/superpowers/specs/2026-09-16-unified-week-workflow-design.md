# Unified Week Workflow Design

## Goal

Make weekly scheduling easy to understand by treating a registration week and its schedule as one workflow. Admin creates the week once in `/admin/registration-weeks`; the matching schedule draft exists automatically and `/admin/schedule?week=YYYY-MM-DD` is immediately ready for shift assignment.

## Problem

The current UI exposes two separate lifecycle concepts:

- `registration_weeks` controls when employees can submit availability.
- `schedule_weeks` controls the official schedule.

Because these are created separately, Admin can create a registration week and then still land on `/admin/schedule` with a message that no schedule exists yet. This makes the product feel like the same week has to be created twice.

## Core Rule

A registration week is the parent workflow for the same calendar week.

For every `registration_weeks.week_start`, there must be a matching `schedule_weeks.week_start`.

The Admin mental model becomes:

`Create week -> employee registration -> review availability -> schedule shifts -> publish -> export JPG -> archive/delete`

Admin never manually creates a separate schedule week.

## Create Week Behavior

Creating a week from `/admin/registration-weeks` must atomically create both:

1. `registration_weeks` row with the requested `week_start`, `lock_at`, and status `open`.
2. `schedule_weeks` row with the same `week_start` and status `draft`.

The operation must be transactional. If either insert fails, neither row should remain.

After creation, the UI keeps the newly created week selected and all week-sensitive admin routes use the same `week_start` query parameter.

## Existing Data Backfill

A migration must create missing `schedule_weeks` rows for any existing `registration_weeks.week_start` that currently has no matching schedule week.

Backfilled schedule weeks use status `draft`.

The migration must not overwrite or duplicate existing schedule weeks.

## `/admin/schedule` Behavior

### When at least one registration week exists

The schedule page is driven by the selected registration week (`?week=YYYY-MM-DD`).

If the URL specifies a valid registration week, the matching schedule is loaded directly and is ready to edit.

The page must not expose a separate week selector or a separate `Create schedule week` action.

### When no registration week exists

Show a dedicated empty state:

- Heading: `Chưa có tuần để xếp lịch`
- Body explains that Admin must create a registration week first and the schedule will be created automatically.
- Primary button: `Tạo tuần mới`
- Button navigates to `/admin/registration-weeks`.

There must be no API path that creates a standalone `schedule_week` from this empty state.

### Invalid requested week

If `/admin/schedule?week=...` references a week that no longer exists in `registration_weeks`, show the existing not-found/invalid-week state and route the Admin back to week management.

## Admin Navigation

`Tuần đăng ký` is the single place that owns week lifecycle creation and deletion.

`Xếp lịch` is only for scheduling, publication, export, filtering, and editing the selected week.

The scheduler should therefore not contain controls whose purpose is creating another week.

## Week Lifecycle

The existing delete flow remains the lifecycle authority:

Deleting a registration week deletes the complete workflow for that `week_start`, including employee submissions, official schedule entries, the matching schedule week, and the registration week.

Archived registration weeks remain deletable from the archived section.

## Schedule Status

A schedule starts as `draft` automatically when the registration week is created.

`published` can be returned to `draft` when Admin edits it again.

`archived` schedule state must not block Admin from resuming work on an active registration workflow; editing may reopen it as `draft` according to the current scheduler behavior.

The registration-week lifecycle remains the primary lifecycle exposed to users.

## Employee Flow

No change to the employee registration data model is required.

Employees see registration weeks based on `registration_weeks` only. Their availability submissions continue to use the selected registration week ID. Admin availability and Admin scheduler continue to read those same submissions.

## Timezone and Calendar Rules

Keep the existing rules unchanged:

- week starts on Monday;
- week dates are matched by the same `week_start` string;
- registration deadline behavior remains in `Asia/Ho_Chi_Minh`;
- no timezone conversion may change the calendar date used to match `registration_weeks` and `schedule_weeks`.

## Data/API Design

Introduce a database RPC for creation, for example:

`create_registration_workflow(target_week_start date, target_lock_at timestamptz)`

It returns the created registration week and creates the matching schedule week in the same transaction.

Frontend `createWeek()` uses this RPC instead of inserting directly into `registration_weeks`.

The existing standalone `addScheduleWeek()` must no longer be used by the Admin week creation/schedule page flow. It may remain only if another verified flow still depends on it; otherwise it should be removed or made internal as part of implementation cleanup.

## Error Handling

Creation errors must be surfaced to the Admin with actionable Vietnamese copy.

Duplicate week creation must not produce two partial records.

If the database rejects the workflow creation, the UI stays on the current state and does not navigate as if creation succeeded.

## UI Simplification

On `/admin/schedule?week=...`:

- keep current selected week title;
- keep schedule status, publish, export, archive/clear controls that are still relevant to schedule editing;
- keep employee search, group filter, refresh, shift palette, availability pills, and schedule grid;
- remove the separate schedule-week picker;
- remove `Tạo lịch tuần` from the scheduler toolbar/filter area;
- avoid duplicate language implying a second week lifecycle.

When there is no week, the only creation CTA sends Admin to `/admin/registration-weeks`.

## Testing

Add regression coverage for:

1. Creating a registration workflow calls the transactional creation RPC.
2. A created registration week always has a matching schedule week after migration/RPC behavior.
3. `/admin/schedule` with no registration weeks shows `Tạo tuần mới` and links to `/admin/registration-weeks`.
4. `/admin/schedule?week=<valid>` renders the scheduler without a separate week picker or `Tạo lịch tuần` action.
5. Existing registration-week creation UI still selects the created week.
6. Existing employee registration, availability display, scheduler availability pills, publish/export, archive/delete flows remain green.
7. Database migration is idempotent for weeks that already have a schedule row.

## Scope Boundaries

Do not merge `registration_weeks` and `schedule_weeks` into one database table in this change.

Do not restore `/app/team-schedule`.

Do not change employee-position logic, availability semantics, shift matching, or JPG export behavior unless a regression test shows this workflow change requires it.

All changes stay on `feat/port-schedulework-scheduler`; do not modify or merge `main`.
