import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import type { CloudEmployee, ScheduleEntry, ShiftType } from "../scheduling/types";
import { ScheduleGrid } from "./ScheduleGrid";

const employee: CloudEmployee = {
  id: "employee-1",
  name: "Nguyễn Phi Hùng",
  active: true,
  groupId: "group-1",
  positionId: "position-1",
  positionName: "Bếp trưởng",
  sortOrder: 0,
  isNew: false,
};
const shift: ShiftType = {
  id: "shift-1",
  label: "17:00-23:00",
  color: "#4f8fdb",
  isPreset: false,
};
const entry: ScheduleEntry = {
  id: "entry-1",
  scheduleWeekId: "schedule-week-1",
  employeeId: employee.id,
  dayOfWeek: 1,
  shiftTypeId: shift.id,
  customStart: null,
  customEnd: null,
  customLabel: null,
  sortOrderInCell: 0,
};

function render(availabilityByEmployee = {}) {
  return renderToStaticMarkup(
    <ScheduleGrid
      groups={[{ id: "group-1", name: "Bếp nóng", sortOrder: 0 }]}
      employees={[employee]}
      entries={[entry]}
      shifts={[shift]}
      weekStart="2026-09-21"
      editable
      selectedShiftId={null}
      onSelectShift={() => undefined}
      onAssign={() => undefined}
      onMove={() => undefined}
      onEdit={() => undefined}
      availabilityByEmployee={availabilityByEmployee}
    />,
  );
}

describe("Admin scheduler availability guidance", () => {
  it("shows exact custom registration separately from the official shift", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning_afternoon");
    const day = availability.days["1"];
    if ("intervals" in day) day.intervals[0].end = "18:00";
    const html = render({ [employee.id]: availability });
    expect(html).toContain("ĐK</span> · 10h–18h");
    expect(html).toContain("official-shifts");
    expect(html).toContain("17:00 – 23:00");
  });

  it("does not show a registration hint when no submission exists", () => {
    expect(render()).not.toContain("availability-hint");
  });
});
