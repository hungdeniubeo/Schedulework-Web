# Scheduler Reference Parity and Refresh Design

Date: 2026-09-16
Branch: `feat/port-schedulework-scheduler`

## Goal

Make `/admin/schedule` look and behave like the proven scheduler from `hungdeniubeo/Schedulework`, while keeping `Schedulework-Web` as the source of truth for Supabase persistence, weekly registration workflow, employee/position data, availability submissions, and permissions.

The target visual is the approved legacy ScheduleWork table: compact Excel-like density, full seven-day visibility, clear employee/group structure, colored shift chips, and a separate daily staffing summary. The web-only availability pill (`ĐK`) must be added without making the table noisy.

This change also closes stale-data gaps between Admin and Employee pages and removes the user-facing schedule publication workflow.

## Sources of truth

Use three explicit sources of truth:

1. **Visual and interaction source of truth:** `hungdeniubeo/Schedulework`, especially `src/ScheduleTable.tsx`, `src/App.tsx`, and the scheduler styles in `src/index.css`.
2. **Data and persistence source of truth:** `Schedulework-Web` Supabase schema, APIs, RLS, `registration_weeks`, `schedule_weeks`, `schedule_entries`, `employees`, `positions`, `groups`, `shift_types`, and `availability_submissions`.
3. **Weekly lifecycle source of truth:** the unified week workflow in `2026-09-16-unified-week-workflow-design.md`: Admin creates one registration week and the matching schedule draft exists automatically.

Do not copy the old Tauri/local-storage state container into the web app.

## Product flow

The scheduling workflow becomes:

`Create week -> employee registration -> review availability -> schedule shifts -> export JPG / continue editing -> archive or delete week`

There is no user-facing publish step.

- No `Công bố lịch` action.
- No `Bản nháp` / `Đã công bố` badge in the scheduler UI.
- No requirement for employees to wait for a published schedule state.
- Week archive/delete remains owned by `/admin/registration-weeks`.
- `/admin/schedule` is only a scheduling workspace for the selected registration week.

The existing database `schedule_weeks.status` column is retained for backward compatibility in this change. Legacy `published` or `archived` schedule rows must not make an otherwise active registration workflow uneditable. The frontend may normalize a legacy non-draft schedule to `draft` before the first mutation. Do not drop legacy status values or rewrite historical data destructively as part of this UI change.

## Employee lifecycle refresh

### `/app/availability`

The employee registration page must detect Admin-side lifecycle changes without requiring F5.

Refresh triggers:

- browser window receives focus;
- document becomes visible after being hidden;
- explicit retry from an empty/error state.

The refresh must detect:

- a newly created registration week;
- a reopened week;
- a locked week;
- an archived week;
- a deleted week;
- a different open/relevant week becoming the employee target.

Refresh must be non-destructive to local editing:

- If the employee has unsaved changes for the same still-valid week, preserve those local availability edits while refreshing week metadata/lock state.
- If the current week is deleted or archived and can no longer accept a submission, resolve the next valid employee week and replace the inaccessible context.
- Do not fire duplicate concurrent refreshes while a save is in progress.

### `/app/my-schedule`

`Lịch của tôi` is read-only and may safely refetch its data on the same focus and visibility triggers.

It should also continue to refresh immediately after the employee successfully submits or updates availability through the existing `submissionRevision` mechanism.

## Scheduler availability refresh

`/admin/schedule` must keep employee registration guidance current while Admin is scheduling.

Refresh only availability data; do not reload official schedule entries or reset DnD/search/selection state.

Triggers:

- window focus;
- document becomes visible;
- a lightweight 15-second interval while the scheduler page is visible.

Behavior:

- call the existing week-scoped availability loader for the selected `week_start`;
- replace `availabilityByEmployee` from the canonical response;
- leave `entries`, selected shift, filters, drag state, and unsaved UI interaction untouched;
- a refresh failure must not block scheduling; surface it using the existing non-destructive error/notice pattern.

## Scheduler table visual parity

### Overall density

The main schedule must use the compact, spreadsheet-like structure from the legacy repo rather than the current card-heavy interpretation.

Desktop goals:

- seven day columns visible in one primary table where viewport width permits;
- compact row height;
- employee column wide enough for real names;
- shift chips use only the space they need;
- horizontal scroll only when genuinely necessary;
- no ellipsis-only employee names;
- visual hierarchy comes from grid lines, group rows, shift colors, and typography rather than large cards.

### Header

The schedule sheet header follows the legacy layout:

- left: `Tuần N · Tháng M, YYYY`;
- right: calendar icon plus exact Monday-Sunday range;
- below: table header with `Nhân viên` and seven day columns;
- each day column shows full weekday name and `dd/mm` date;
- current day may keep the existing today indicator.

Week navigation itself remains controlled by the web route/query (`?week=YYYY-MM-DD`). Do not restore the old desktop Month/Year/Week selectors that would create a second week-navigation model.

### Employee column

Match the legacy structure while preserving web data:

- colored area/group dot;
- employee name as the primary label;
- compact position information from `positionName` as secondary context;
- `NEW` badge when `isNew` is true;
- drag/reorder affordance remains available but visually quiet when idle;
- name must wrap or the column must expand rather than truncate important information.

The employee column should use the legacy dynamic-width idea: calculate a sensible width from the longest visible employee name/content with a practical minimum. It must not become excessively wide; cap it so the seven-day grid remains useful.

The old desktop role flags (executive chef/head chef/full-time) are not copied as new database fields. The web app continues using `positionName` and existing employee fields. No duplicate role model is introduced only to imitate an icon from the screenshot.

### Group rows

Groups render as full-width separator rows similar to `MEAT`, `SOUP`, and `SALAD` in the legacy scheduler.

- group name centered;
- compact group mark/icon treatment where an existing generic icon can be used;
- stable group ordering from Supabase `sort_order`;
- generic/custom group names remain supported; do not hard-code the system to only three groups;
- employee drag between groups remains supported.

### Official shift chips

Official shifts have visual priority.

- compact colored rectangle;
- one interval on one line;
- split shift rendered as two lines inside one chip;
- preserve configured/custom shift color rules;
- entries in one employee/day cell are ordered by actual start time, with `sortOrderInCell` only as a deterministic tie-breaker;
- edit, drag, and delete remain accessible without permanently reserving large button chrome inside every cell.

Overlap/invalid-time validation remains blocking exactly as today.

### Availability guidance (`ĐK`)

Registration guidance remains below official shifts and visually subordinate.

Examples:

```text
┌───────────────┐
│ 10:00 – 14:00 │
└───────────────┘
ĐK · 10h–14h
```

and:

```text
ĐK · Nghỉ
```

Rules:

- exact availability interval(s) matching a configured ShiftType reuse that shift's visual identity in a muted style;
- unmatched custom availability uses a neutral muted style;
- OFF uses a muted OFF style;
- click opens the existing read-only detail popover with full intervals/reason;
- no submission means no `ĐK` pill;
- availability remains advisory and never blocks a valid official assignment.

## Shift palette and controls

Port the legacy workspace relationship between the schedule and shift sidebar rather than keeping the current permanently dominant left palette.

- compact shift sidebar beside the table;
- sidebar can be shown/hidden;
- hidden state lets the table consume the available width;
- selecting a shift enables rapid click-to-assign;
- drag from palette to cell remains supported;
- Escape clears selected shift;
- search and group filtering remain available in a compact toolbar;
- shift CRUD remains owned by the existing `Ca làm` manager, not duplicated into the scheduler.

Do not restore legacy desktop controls that conflict with web navigation or data ownership.

## Daily staffing summary

Replace the current staffing rows inside the table `<tfoot>` with a separate legacy-style `TỔNG CA` section below the main grid.

For each day show:

- weekday/date;
- Sáng count;
- Trưa count;
- Tối count;
- existing manual count override behavior;
- compact staffing-status indicator when useful.

Automatic counts continue to come from official schedule entries and existing staffing helpers. Availability (`ĐK`) must not affect official staffing totals.

The summary must align visually with the seven schedule day columns and remain compact enough to scan across the week.

## Editing and DnD behavior to preserve

The redesign must preserve all working scheduler behavior:

- select shift then click cell to assign;
- drag shift from palette into a cell;
- drag an existing entry to another employee/day;
- edit a scheduled entry/custom time;
- delete a scheduled entry by explicit action or existing trash interaction where retained;
- reject overlaps/invalid time ranges;
- consolidate valid split shifts according to existing domain behavior;
- drag employees within and between groups;
- persist employee order/group changes to Supabase;
- search employee;
- filter groups;
- clear the current week's official schedule with confirmation;
- export high-resolution JPG;
- preserve informational availability notices.

The visual port must not create a second scheduling engine. Existing web domain helpers/APIs stay authoritative.

## Export behavior

JPG export continues to contain the official work schedule and staffing information only.

Do not export:

- `ĐK` availability pills/popovers;
- drag handles;
- delete buttons;
- transient drop targets/notices;
- search/filter controls;
- shift palette.

Export styling should follow the compact schedule table visual language and remain readable at high resolution.

## Publication removal

Remove publication from the user-facing scheduler flow.

Remove or stop rendering:

- publish button/action;
- draft/published status badges/copy;
- validation whose sole purpose is to permit publication;
- automatic `published -> draft` UX messaging.

Do not remove schedule validation needed for normal editing, overlap safety, or JPG export correctness.

Employee pages continue to represent employee registration/my-schedule flows; this change does not restore `/app/team-schedule` and does not introduce an employee-facing official-team-schedule page.

## Error handling

- Availability refresh failure: non-blocking; existing official scheduling remains usable.
- Employee lifecycle refresh failure: keep current usable context when safe and expose retry.
- Official schedule mutation failure: keep/reload canonical official data using current error path.
- Overlap/invalid shift: block mutation and show the existing specific error.
- Employee reorder failure: reload canonical employee ordering and report the failure.
- Export failure: show existing export error and leave schedule intact.

## CSS and component boundaries

Prefer adapting the existing web scheduler components instead of copying the entire desktop component tree unchanged.

Expected areas:

- `AdminScheduler`: page orchestration, availability refresh, filters, export/clear actions, no publication UI;
- `ScheduleGrid`: DnD interaction and legacy-style table composition;
- focused employee/group/shift cell components may be extracted if `ScheduleGrid` becomes too large;
- `AdminSchedule.css`: legacy-parity schedule/grid/sidebar/summary styling;
- shared `ScheduleSheet` should only remain in paths where it is still the right abstraction (for example read-only/export) and must not force the admin interactive grid into the wrong markup;
- employee refresh logic should be isolated in a reusable focus/visibility refresh helper or hook rather than duplicated event-listener code across pages.

Do not add a new state-management library or UI framework.

## Testing strategy

Use TDD for behavior changes.

Required automated coverage:

1. employee registration lifecycle refresh reacts to focus/visibility without clobbering same-week unsaved edits;
2. deleted/archived current employee week resolves to a valid replacement/empty state;
3. My Schedule refetches on focus/visibility and after submission revision;
4. Admin Scheduler availability refresh updates `ĐK` data without replacing official entries;
5. publication controls/status copy no longer render;
6. legacy published/archived schedule status does not block editing an active registration workflow;
7. header renders week/month/year and exact Monday-Sunday range;
8. employee cell renders full name, position context, group indicator, and NEW badge as applicable;
9. group rows span all eight columns and remain droppable for employee reorder;
10. split shifts render as two compact lines and entries are ordered chronologically;
11. `ĐK` remains below official shifts and is not part of export markup;
12. daily staffing summary is outside the table footer and preserves Sáng/Trưa/Tối override semantics;
13. search/group filter/DnD/overlap/consolidation/employee reorder regression tests remain green;
14. full test suite, build, Deno checks, and diff whitespace validation remain green.

Because the target includes visual parity with an existing reference screenshot/repo, finish with a manual browser smoke test at desktop width comparing:

- header density;
- employee-column width;
- day header alignment;
- group separators;
- shift chip sizes/colors/line wrapping;
- `ĐK` subordinate styling;
- daily summary alignment;
- sidebar open/closed states;
- horizontal overflow behavior.

## Spec precedence

This document supersedes earlier scheduler/publication/UI sections that conflict with it.

In particular:

- `2026-09-15-port-schedulework-scheduler-design.md`: publication lifecycle and older scheduler presentation are superseded.
- `2026-09-15-admin-registration-flow-redesign.md`: explicit schedule creation and older schedule-page assumptions are superseded by the unified week workflow and this scheduler design.
- `2026-09-16-scheduling-flow-audit-and-week-lifecycle-design.md`: explicit manual schedule creation and publication-related assumptions are superseded.
- `2026-09-16-unified-week-workflow-design.md`: remains authoritative for one-week creation/lifecycle; this document supersedes only its references to publish as a user-facing scheduler step.

## Non-goals

- Do not restore `/app/team-schedule`.
- Do not add auto-scheduling/AI scheduling.
- Do not duplicate employee/position/shift data models from the old desktop repo.
- Do not reintroduce old Month/Year/Week selectors that conflict with `?week=` routing.
- Do not hard-code the web app to only MEAT/SOUP/SALAD groups.
- Do not make availability a hard scheduling constraint.
- Do not drop legacy database status values in this change.
- Do not modify or merge `main`; implementation remains on `feat/port-schedulework-scheduler`.

## Success criteria

The change is complete when an Admin can open `/admin/schedule?week=...` and work in a compact scheduler that visually and behaviorally matches the legacy ScheduleWork table, while all data still persists through Supabase; employee lifecycle changes and availability updates appear without manual F5; official scheduling remains fully editable without a publication step; `ĐK` guidance stays current and unobtrusive; the daily staffing summary matches the legacy layout; and existing scheduling safety, DnD, export, week lifecycle, and employee data flows continue to work.