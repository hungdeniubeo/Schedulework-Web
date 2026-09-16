import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CloudEmployee, ScheduleEntry, ShiftType } from "../scheduling/types";
import { AdminScheduleExport } from "./AdminScheduleExport";

const employee: CloudEmployee = {
  id: "employee-1",
  name: "Nguyễn Phi Hùng",
  active: true,
  groupId: "group-1",
  positionId: "position-1",
  positionName: "Bếp trưởng",
  sortOrder: 0,
  isNew: true,
};
const shift: ShiftType = {
  id: "shift-1",
  label: "10:00-14:00 / 17:00-23:00",
  color: "#5B9BD5",
  isPreset: true,
};
const entry: ScheduleEntry = {
  id: "entry-1",
  scheduleWeekId: "week-1",
  employeeId: employee.id,
  dayOfWeek: 1,
  shiftTypeId: shift.id,
  customStart: null,
  customEnd: null,
  customLabel: null,
  sortOrderInCell: 0,
};

describe("AdminScheduleExport", () => {
  it("exports the legacy table and totals without interactive or registration UI", () => {
    const html = renderToStaticMarkup(
      <AdminScheduleExport
        id="cloud-schedule-export"
        groups={[{ id: "group-1", name: "MEAT", sortOrder: 0 }]}
        employees={[employee]}
        entries={[entry]}
        shifts={[shift]}
        weekStart="2026-09-21"
        countOverrides={{ "1:Đ": 4 }}
      />,
    );

    expect(html).toContain('id="cloud-schedule-export"');
    expect(html).toContain("legacy-scheduler-table");
    expect(html).toContain("TỔNG CA");
    expect(html).toContain("Nguyễn Phi Hùng");
    expect(html).not.toContain("ĐK");
    expect(html).not.toContain("availability-detail");
    expect(html).not.toContain("schedule-entry-delete");
    expect(html).not.toContain("schedule-employee-drag-handle");
    expect(html).not.toContain("scheduler-palette");
  });
});
