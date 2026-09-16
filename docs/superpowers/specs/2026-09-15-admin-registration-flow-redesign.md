> **SUPERSEDED IN PART — 2026-09-16**
>
> The manual schedule-week creation flow and older `/admin/schedule` presentation in this document are superseded by `2026-09-16-unified-week-workflow-design.md` and `2026-09-16-scheduler-reference-parity-and-refresh-design.md`. Navigation and page-responsibility guidance remains historical context unless a newer spec conflicts.

# Admin Registration Flow Redesign

## Goal

Restructure the admin registration workflow so each page has one clear responsibility, while preserving the existing admin header, current scheduling behavior, and the intentionally removed employee team-schedule page.

## Scope

This redesign covers three admin areas:

- `/admin/registration-weeks`: manage registration weeks.
- `/admin/availability`: display employee registration availability for one selected week.
- `/admin/schedule`: open the scheduling workspace for the same selected week and improve table readability/layout.

The employee route `/app/team-schedule` stays removed and must not be restored.

## Navigation

The admin navigation becomes:

`Trang chủ | Đăng ký nhân viên | Tuần đăng ký | Xếp lịch | Nhân viên | Nhóm | Ca làm`

`Tuần đăng ký` is a first-class admin tab and points to `/admin/registration-weeks`.

The existing admin header structure remains intact. The tab bar gets a visual redesign with rounded tab surfaces, a clear active state, subtle shadow/indicator treatment, hover/focus transitions, balanced spacing, and responsive behavior. Styling belongs in dedicated CSS, not inline styles.

## Shared Week Selection

The selected registration week is represented by the `week` query parameter using the registration week start date:

- `/admin/registration-weeks?week=2026-09-28`
- `/admin/availability?week=2026-09-28`
- `/admin/schedule?week=2026-09-28`

The query string is the source of truth for cross-page navigation.

If `/admin/availability` or `/admin/schedule` is opened without a `week` parameter, the app automatically resolves the best default registration week using the same existing business intent as the current registration-week selection: prefer the currently relevant/open week, otherwise the nearest sensible week.

If a `week` parameter references no existing registration week, the page must show a clear empty/error state rather than silently switching to an unrelated week.

## `/admin/registration-weeks`

This page owns all registration-week administration.

It contains the existing WeekManager capabilities:

- choose the week being managed;
- create a new registration week;
- edit the registration deadline;
- lock registration;
- reopen registration;
- archive a registration week;
- delete a registration week when allowed by existing business rules.

The week selector is displayed at the top of this page. Selecting a week updates `?week=<week_start>`.

The page may reuse the existing `WeekManager`, `WeekDialogs`, registration-week status helpers, and existing API functions. No duplicate week-management implementation should be introduced.

## `/admin/availability`

This page is reduced to the employee registration matrix only.

The content area contains the existing visual block represented by `AdminMatrix`:

- eyebrow `ĐỐI CHIẾU THEO NGÀY`;
- title `Lịch nhân viên đăng ký`;
- selected week label;
- availability legend;
- employee-by-day registration matrix;
- group/area headings such as `MEAT`;
- `Xếp lịch tuần này →` button.

The page must not contain:

- WeekManager;
- create/edit/delete week controls;
- progress hero;
- separate weekly summary card;
- registration deadline management.

The `Xếp lịch tuần này →` action navigates to `/admin/schedule?week=<same_week_start>`.

## `/admin/schedule`

The schedule page must honor the `week` query parameter.

If a schedule week already exists for that week start, open that schedule directly and render the current scheduling table.

If the registration week exists but no schedule week exists yet, do not create one automatically. Show an intentional empty state such as:

`Tuần này chưa có lịch xếp. Hãy tạo lịch tuần này để bắt đầu.`

The empty state includes an explicit `Tạo lịch tuần này` action that creates the draft using the existing schedule-week creation flow.

Existing schedule behavior remains unchanged: drag/drop, employee reorder, split-shift consolidation, conflict validation, availability informational notices, publish/archive/export/clear behavior, and staffing overrides.

## Schedule Table Layout Improvements

The schedule table should become easier to scan and use on desktop without breaking drag/drop.

Requirements:

- Employee names are never hidden behind ellipsis as the only presentation.
- Long employee names may wrap to two lines and remain centered/readable.
- Employee name, position, group/area heading, day headings, shift chips, and staffing cells are visually centered and aligned.
- The first employee column becomes wider than it is now so names have more room.
- Shift chips should use less horizontal space inside a schedule cell: tighter padding, compact typography, sensible wrapping for split shifts, and no unnecessary full-width expansion.
- The reduced chip footprint should leave more usable visual room inside each day column.
- Group headings such as `MEAT` remain clearly centered across the full table width.
- Drag handles remain accessible without forcing the employee name to become truncated.
- Responsive/mobile behavior must not regress.

## Styling Boundaries

Styles must be separated by responsibility:

- admin shell/header/tab navigation styles live in the shared admin styling area;
- availability matrix/page styles remain in `AdminAvailability.css`;
- registration-week page styles live in a dedicated registration-week CSS file or a focused existing week-manager stylesheet if one already exists;
- scheduler table/layout styles remain in `AdminSchedule.css` and existing shared schedule styles where appropriate.

Avoid adding new presentation logic as inline `style` props except where the existing shift-color system already requires CSS variables.

## Data Flow

`AdminDashboard` (or a focused extracted admin-week coordination unit if needed) continues to load employees, groups, registration weeks, and submissions through existing APIs.

Page responsibility becomes:

- registration-weeks page: mutates registration weeks;
- availability page: reads selected registration week + submissions and renders `AdminMatrix`;
- schedule page: receives the selected week start and resolves/creates schedule weeks through existing scheduler APIs.

Cross-page state must not rely only on React component memory; the `week` query parameter keeps refreshes, direct links, and navigation deterministic.

## Error and Empty States

Required states:

- no registration weeks exist: availability page explains that no registration week has been created and directs the admin to `Tuần đăng ký`;
- invalid `?week=`: show that the requested registration week does not exist;
- valid registration week but no schedule week: schedule page displays the non-automatic creation state described above;
- no active employees: keep the existing matrix empty state;
- API failures: keep existing inline/app error patterns.

## Testing

Add or update tests for:

- router recognizes `/admin/registration-weeks`;
- admin navigation contains the new `Tuần đăng ký` tab and highlights it correctly;
- `/admin/availability` no longer renders WeekManager controls;
- selected week is resolved from `?week=` and propagated into availability/schedule navigation;
- missing query parameter falls back to the default relevant registration week;
- invalid query parameter yields the intended empty/error state;
- schedule page does not auto-create a schedule week when none exists;
- the explicit create action creates/selects the schedule week;
- removed `/app/team-schedule` remains `not-found`;
- schedule table markup/classes support wrapped employee names and centered/compact cells;
- full test suite, build, Deno checks, and diff whitespace validation remain green.

## Non-Goals

This redesign does not:

- restore `/app/team-schedule`;
- redesign employee-facing pages;
- change availability business semantics;
- introduce automatic schedule generation;
- duplicate existing WeekManager business logic;
- change Supabase schema unless implementation reveals a strictly necessary persistence gap.
