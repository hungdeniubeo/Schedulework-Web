# ScheduleWork UI QA

Use this checklist after UI, routing, or scheduling changes. Test with real Admin
and Employee accounts when the change depends on Supabase data.

## Admin

- [ ] Dashboard
- [ ] Registration
- [ ] Scheduler
- [ ] Employees
- [ ] Groups
- [ ] Shifts

## Employee

- [ ] Login
- [ ] Password
- [ ] Availability
- [ ] My Schedule
- [ ] Team Schedule

## Responsive

- [ ] 360 × 800
- [ ] 390 × 844
- [ ] 412 × 915
- [ ] 1366 × 768
- [ ] 1440 × 900

## Interaction

- [ ] Hover and active states
- [ ] Visible keyboard focus
- [ ] Disabled and loading states
- [ ] Admin dropdown: arrows, Enter, Escape, outside click
- [ ] Modal: focus cycle, Escape, backdrop close
- [ ] Toast and inline success/error messages
- [ ] Mobile bottom sheet: preset and all Full interval hours

## Visual checks

- [ ] No whole-page horizontal overflow
- [ ] Sticky Save does not cover Sunday or notes
- [ ] Tables scroll inside their container
- [ ] Dropdowns and dialogs remain inside the viewport
- [ ] JPG export excludes controls, overlays, and availability hints
- [ ] Console has no React warnings or uncaught errors

Native date/time inputs remain intentional Admin controls. Employee preset and
hour fields use the custom bottom-sheet picker.
