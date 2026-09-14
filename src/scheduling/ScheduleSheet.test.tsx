import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScheduleSheet } from "./ScheduleSheet";
import { shiftStyle } from "./shiftStyle";
import type { CloudEmployee, ScheduleEntry, ShiftType } from "./types";

const employee = (positionName: string | null): CloudEmployee => ({
  id: "employee-1",
  name: "Nguyễn Phi Hùng",
  active: true,
  groupId: null,
  positionId: positionName ? "position-1" : null,
  positionName,
  sortOrder: 0,
  isNew: false,
});

function renderEmployee(positionName: string | null) {
  return renderToStaticMarkup(
    <ScheduleSheet
      groups={[]}
      employees={[employee(positionName)]}
      entries={[]}
      shifts={[]}
      weekStart="2026-09-14"
    />,
  );
}

describe("ScheduleSheet employee labels", () => {
  it("renders the assigned position beneath the employee name", () => {
    expect(renderEmployee("Bếp trưởng")).toContain("Bếp trưởng");
  });

  it("does not render a placeholder when the employee has no position", () => {
    expect(renderEmployee(null)).not.toContain("Không có vị trí");
  });

  it("keeps private availability hints out of the published/export sheet", () => {
    expect(renderEmployee("Bếp trưởng")).not.toContain("ĐK");
  });

  it("provides a stable group-label hook for the mobile team schedule", () => {
    const html = renderEmployee("Bếp trưởng");
    expect(html).toContain('class="schedule-group-label"');
    expect(html).toContain("Chưa có nhóm");
  });

  it("keeps unassigned official cells blank instead of labeling them off", () => {
    const html = renderEmployee("Bếp trưởng");
    expect(html).not.toContain("Nghỉ");
    expect(html.match(/<td><\/td>/g)).toHaveLength(7);
  });

  it("renders an assigned official shift", () => {
    const shift: ShiftType = {
      id: "shift-1",
      label: "10:00-14:00",
      color: "#000000",
      isPreset: true,
    };
    const entry: ScheduleEntry = {
      id: "entry-1",
      scheduleWeekId: "week-1",
      employeeId: "employee-1",
      dayOfWeek: 1,
      shiftTypeId: shift.id,
      customStart: null,
      customEnd: null,
      customLabel: null,
      sortOrderInCell: 0,
    };
    const html = renderToStaticMarkup(
      <ScheduleSheet
        groups={[]}
        employees={[employee(null)]}
        entries={[entry]}
        shifts={[shift]}
        weekStart="2026-09-14"
      />,
    );
    expect(html).toContain("10:00 – 14:00");
  });

  it("renders a base official shift with its latest persisted ShiftType color", () => {
    const shift: ShiftType = {
      id: "shift-1",
      label: "10:00-14:00",
      color: "#123456",
      isPreset: true,
    };
    const entry: ScheduleEntry = {
      id: "entry-1",
      scheduleWeekId: "week-1",
      employeeId: "employee-1",
      dayOfWeek: 1,
      shiftTypeId: shift.id,
      customStart: null,
      customEnd: null,
      customLabel: null,
      sortOrderInCell: 0,
    };
    const html = renderToStaticMarkup(
      <ScheduleSheet
        groups={[]}
        employees={[employee(null)]}
        entries={[entry]}
        shifts={[shift]}
        weekStart="2026-09-14"
      />,
    );
    const expectedBackground = String(
      (shiftStyle(shift.color) as Record<string, string>)["--shift-bg"],
    );
    expect(html).toContain(`--shift-bg:${expectedBackground}`);
  });

  it("adds the employee-only current-row marker only when requested", () => {
    const highlighted = renderToStaticMarkup(
      <ScheduleSheet
        groups={[]}
        employees={[employee(null)]}
        entries={[]}
        shifts={[]}
        weekStart="2026-09-14"
        highlightEmployeeId="employee-1"
      />,
    );
    expect(highlighted).toContain("current-employee-row");
    expect(highlighted).toContain(">Bạn<");
    expect(renderEmployee(null)).not.toContain(">Bạn<");
  });
});
