import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CloudEmployee, ScheduleEntry, ShiftType } from "../scheduling/types";
import {
  SchedulerTable,
  compareScheduleEntriesByTime,
  employeeColumnWidthPx,
} from "./SchedulerTable";

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

const shifts: ShiftType[] = [
  { id: "early", label: "10:00-14:00", color: "#70AD47", isPreset: true },
  { id: "late", label: "17:00-23:00", color: "#ED7D31", isPreset: true },
];

const entries: ScheduleEntry[] = [
  {
    id: "late-entry",
    scheduleWeekId: "week-1",
    employeeId: employee.id,
    dayOfWeek: 1,
    shiftTypeId: "late",
    customStart: null,
    customEnd: null,
    customLabel: null,
    sortOrderInCell: 0,
  },
  {
    id: "early-entry",
    scheduleWeekId: "week-1",
    employeeId: employee.id,
    dayOfWeek: 1,
    shiftTypeId: "early",
    customStart: null,
    customEnd: null,
    customLabel: null,
    sortOrderInCell: 9,
  },
];

describe("SchedulerTable legacy parity", () => {
  it("renders the approved weekly heading, full weekdays, employee context and group row", () => {
    const html = renderToStaticMarkup(
      <SchedulerTable
        groups={[{ id: "group-1", name: "MEAT", sortOrder: 0 }]}
        employees={[employee]}
        entries={entries}
        shifts={shifts}
        weekStart="2026-09-21"
      />,
    );

    expect(html).toContain("Tuần 4");
    expect(html).toContain("Tháng 9, 2026");
    expect(html).toContain("21/09");
    expect(html).toContain("27/09");
    expect(html).toContain("Thứ hai");
    expect(html).toContain("Chủ nhật");
    expect(html).toContain('class="scheduler-name-cell');
    expect(html).toContain("Nguyễn Phi Hùng");
    expect(html).toContain("Bếp trưởng");
    expect(html).toContain("NEW");
    expect(html).toContain('colspan="8"');
    expect(html).toContain("MEAT");
    expect(html.indexOf("10:00 – 14:00")).toBeLessThan(
      html.indexOf("17:00 – 23:00"),
    );
  });

  it("sorts entries by actual start time before sortOrderInCell", () => {
    expect(compareScheduleEntriesByTime(entries[0], entries[1], shifts)).toBeGreaterThan(0);
  });

  it("keeps the employee column useful without letting it consume the week grid", () => {
    expect(employeeColumnWidthPx([{ ...employee, name: "A" }])).toBe(210);
    expect(
      employeeColumnWidthPx([
        { ...employee, name: "Tên nhân viên rất rất rất rất rất rất rất rất rất rất dài" },
      ]),
    ).toBeLessThanOrEqual(320);
  });
});
