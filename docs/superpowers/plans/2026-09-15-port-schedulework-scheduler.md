# Port ScheduleWork Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the scheduling interactions from `Schedulework` into `/admin/schedule` while preserving Supabase persistence, availability registration, and draft/publish/archive behavior.

**Architecture:** `AdminScheduler` remains the page/state orchestrator, `ScheduleGrid` remains the interaction layer, and domain logic is moved into small scheduling helpers. Employee reorder is persisted atomically with a Supabase RPC; schedule entries remain bound to stable employee IDs. Availability produces non-blocking informational notices after valid schedule mutations.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, @dnd-kit/core, Supabase/Postgres

**Spec:** `docs/superpowers/specs/2026-09-15-port-schedulework-scheduler-design.md`

## Global Constraints

- Preserve Vietnamese scheduling terms such as `Sáng`, `Trưa`, `Tối`, and `xếp lịch`.
- Keep availability separate from official schedule data.
- Employee reorder must never transfer official schedule entries between employees.
- Availability mismatches are informational and never block an otherwise valid assignment.
- Do not add new state libraries, UI frameworks, or unnecessary dependencies.
- Keep schedule grid desktop/tablet-first with horizontal scrolling on mobile.
- All persistent web mutations use Supabase with RLS/admin authorization; never port Tauri/local storage.

---

### Task 1: Employee reorder domain semantics

**Files:**
- Create: `src/scheduling/employeeOrder.ts`
- Create: `src/scheduling/employeeOrder.test.ts`

**Interfaces:**
- Produces: `moveEmployeeLocally(employees, employeeId, targetGroupId, beforeEmployeeId?) => CloudEmployee[]`
- Produces: `EmployeeMoveTarget` describing `{ targetGroupId: string | null; beforeEmployeeId?: string }`

- [ ] **Step 1: Write failing tests** covering reorder inside a group, move between groups, drop on group header/start, and unchanged employee IDs.
- [ ] **Step 2: Run `npm test -- src/scheduling/employeeOrder.test.ts` and verify failure.**
- [ ] **Step 3: Implement immutable reorder logic that normalizes `sortOrder` in source and target groups without touching schedule entries.**
- [ ] **Step 4: Run the focused tests and verify pass.**
- [ ] **Step 5: Commit `test/feat: add employee reorder semantics`.**

### Task 2: Persist employee reorder atomically

**Files:**
- Create: `supabase/migrations/202609150001_reorder_scheduler_employees.sql`
- Modify: `src/scheduling/api.ts`

**Interfaces:**
- Produces RPC: `public.reorder_scheduler_employee(target_employee_id uuid, target_group_id uuid, before_employee_id uuid default null)`
- Produces frontend: `reorderSchedulerEmployee(employeeId, targetGroupId, beforeEmployeeId?) => Promise<void>`

- [ ] **Step 1: Add SQL migration with admin authorization and fixed search path.**
- [ ] **Step 2: Normalize source and target group sort orders inside one transaction/function call; reject a `before_employee_id` outside the target group.**
- [ ] **Step 3: Add frontend API wrapper calling the RPC and map database errors to `Không sắp xếp được nhân viên.`**
- [ ] **Step 4: Run TypeScript/build validation for the API shape.**
- [ ] **Step 5: Commit `feat: persist scheduler employee reorder`.**

### Task 3: Employee drag/drop in schedule grid

**Files:**
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSchedule.css`
- Modify/Create: relevant `src/admin/*test.tsx`

**Interfaces:**
- `ScheduleGrid` gains `onMoveEmployee(employeeId, targetGroupId, beforeEmployeeId?)`.
- Employee drag payload is distinct from palette/entry payloads.

- [ ] **Step 1: Add failing component/domain tests proving employee drag routes to employee move and never schedule-entry move.**
- [ ] **Step 2: Add draggable employee handle and droppable employee/group targets modeled after `Schedulework/src/ScheduleTable.tsx`.**
- [ ] **Step 3: Update collision detection so employee drags collide only with employee/group targets and shift drags collide only with schedule cells/trash.**
- [ ] **Step 4: In `AdminScheduler`, perform optimistic local reorder, call `reorderSchedulerEmployee`, then reload employees; on failure restore canonical state and show error.**
- [ ] **Step 5: Add visual reorder/drop-target states without changing schedule ownership.**
- [ ] **Step 6: Run focused tests.**
- [ ] **Step 7: Commit `feat: drag employees in scheduler`.**

### Task 4: Availability advisory evaluation

**Files:**
- Create: `src/scheduling/availabilityNotice.ts`
- Create: `src/scheduling/availabilityNotice.test.ts`
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSchedule.css`

**Interfaces:**
- Produces `availabilityNoticeForEntry(entry, employee, dayAvailability, shifts) => string | null`.

- [ ] **Step 1: Write failing tests for OFF with reason, OFF without reason, missing availability, partial mismatch, full containment, and split-shift containment across multiple intervals.**
- [ ] **Step 2: Implement interval containment using the same parsed schedule ranges as overlap validation.**
- [ ] **Step 3: Add neutral `schedule-notice` state in `AdminScheduler`, separate from `error`.**
- [ ] **Step 4: After successful assign/move/save of a schedule entry, evaluate the target employee/day and show the neutral notice when non-null.**
- [ ] **Step 5: Ensure employee reorder never calls availability evaluation.**
- [ ] **Step 6: Run focused tests and commit `feat: add advisory availability notices`.**

### Task 5: Match desktop scheduler interaction polish

**Files:**
- Modify: `src/admin/ScheduleGrid.tsx`
- Modify: `src/admin/AdminScheduler.tsx`
- Modify: `src/admin/AdminSchedule.css`

**Interfaces:** Existing scheduler props only; no new persistence model.

- [ ] **Step 1: Add Escape key behavior to clear selected shift.**
- [ ] **Step 2: Add today/weekend cell/header styling equivalent to the desktop scheduler where supported by `ScheduleSheet`.**
- [ ] **Step 3: Keep drag preview and blocked overlap feedback distinct; invalid schedule drops remain blocked.**
- [ ] **Step 4: Keep search/group filter UI and full exported schedule behavior unchanged.**
- [ ] **Step 5: Add/adjust tests and commit `feat: align scheduler interactions with desktop app`.**

### Task 6: Verify split-shift consolidation and staffing parity

**Files:**
- Modify only if tests reveal parity gaps: `src/scheduling/merge.ts`, `src/scheduling/staffing.ts`, `src/scheduling/ScheduleSheet.tsx`
- Add/modify matching tests.

**Interfaces:** Existing consolidation/staffing interfaces remain stable.

- [ ] **Step 1: Add parity tests using desktop examples: back-to-back valid shifts, non-overlapping split shifts merge in chronological order, overlapping split ranges rejected, S/T/Đ calculation and manual override behavior preserved.**
- [ ] **Step 2: Run tests; change implementation only for failing parity cases.**
- [ ] **Step 3: Commit only if implementation/tests changed.**

### Task 7: Export/publish parity and final validation

**Files:**
- Modify only if required: `src/admin/AdminScheduler.tsx`, `src/scheduling/exportJpg.ts`, tests/docs.

**Interfaces:** Existing publish/export commands remain stable.

- [ ] **Step 1: Test that invalid/overlap entries block publish/export and valid schedules proceed.**
- [ ] **Step 2: Verify clear-week only removes the selected week's entries/overrides.**
- [ ] **Step 3: Run `npm test`.**
- [ ] **Step 4: Run `npm run build`.**
- [ ] **Step 5: Run `npx --yes deno@latest test --config supabase/functions/deno.json supabase/functions/_shared/*_test.ts`.**
- [ ] **Step 6: Run `npx --yes deno@latest check --config supabase/functions/deno.json supabase/functions/admin-users/index.ts`.**
- [ ] **Step 7: Run `git diff --check`; run `supabase test db` when local Supabase is available and report explicitly if it is not.**
- [ ] **Step 8: Open a PR summarizing behavior port, availability rules, DB migration, tests, and any remaining deliberate differences from desktop.**
