import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import { shiftStyle } from "../scheduling/shiftStyle";
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

function render(
  availabilityByEmployee = {},
  selectedShiftId: string | null = null,
  editable = true,
) {
  return renderToStaticMarkup(
    <ScheduleGrid
      groups={[{ id: "group-1", name: "Bếp nóng", sortOrder: 0 }]}
      employees={[employee]}
      entries={[entry]}
      shifts={[shift]}
      weekStart="2026-09-21"
      editable={editable}
      selectedShiftId={selectedShiftId}
      onSelectShift={() => undefined}
      onAssign={() => undefined}
      onMove={() => undefined}
      onEdit={() => undefined}
      onDelete={() => undefined}
      availabilityByEmployee={availabilityByEmployee}
    />,
  );
}

describe("Admin scheduler availability guidance", () => {
  it("renders official shifts before registration guidance", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning_afternoon");
    const day = availability.days["1"];
    if ("intervals" in day) day.intervals[0].end = "18:00";
    const html = render({ [employee.id]: availability });

    expect(html.indexOf("official-shifts")).toBeLessThan(
      html.indexOf("availability-detail"),
    );
    expect(html).toContain("17:00 – 23:00");
    expect(html).toContain("ĐK</span> · 10h–18h");
  });

  it("syncs an exact registration interval to the configured shift style", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("evening");
    const html = render({ [employee.id]: availability });
    const expectedBackground = (
      shiftStyle(shift.color) as unknown as Record<string, string>
    )["--shift-bg"];

    expect(html).toContain('class="availability-hint matched"');
    expect(html).toContain(`--shift-bg:${expectedBackground}`);
    expect(html).toContain("ĐK</span> · 17:00 – 23:00");
    expect(html).toContain("Khớp ca: 17:00 – 23:00");
  });

  it("keeps unmatched registration hours neutral instead of guessing a shift", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning_afternoon");
    const day = availability.days["1"];
    if ("intervals" in day) day.intervals[0].end = "18:00";
    const html = render({ [employee.id]: availability });

    expect(html).toContain('class="availability-hint neutral"');
    expect(html).toContain("ĐK</span> · 10h–18h");
    expect(html).not.toContain("Khớp ca:");
  });

  it("does not show a registration hint when no submission exists", () => {
    expect(render()).not.toContain("availability-hint");
  });

  it("keeps OFF compact in the cell and exposes the full reason in the detail popover", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = {
      status: "off",
      preset: null,
      intervals: [],
      offReason: "Em có lịch học ở trung tâm",
    };
    const html = render({ [employee.id]: availability });

    expect(html).toContain('class="availability-hint off"');
    expect(html).toContain("ĐK</span> · Nghỉ");
    expect(html).toContain('class="availability-popover"');
    expect(html).toContain("Lý do: Em có lịch học ở trung tâm");
    expect(html).toContain("official-shifts");
  });

  it("makes assignable cells keyboard reachable", () => {
    const html = render({}, shift.id);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Xếp ca cho Nguyễn Phi Hùng, ngày 1"');
  });

  it("offers direct deletion only for an editable official shift", () => {
    const editableHtml = render();
    const publishedHtml = render({}, null, false);

    expect(editableHtml).toContain(
      'aria-label="Xóa ca 17:00 – 23:00 của Nguyễn Phi Hùng"',
    );
    expect(editableHtml).not.toContain("Xóa đăng ký");
    expect(publishedHtml).not.toContain('aria-label="Xóa ca');
  });

  it("provides a trash target only for editable official shifts", () => {
    const editableHtml = render();
    const publishedHtml = render({}, null, false);

    expect(editableHtml).toContain(
      'aria-label="Thả ca chính thức vào đây để xóa"',
    );
    expect(publishedHtml).not.toContain(
      'aria-label="Thả ca chính thức vào đây để xóa"',
    );
  });

  it("explains whether the shift palette is ready or locked", () => {
    expect(render()).toContain("Chọn một ca để xếp nhanh");
    expect(render({}, null, false)).toContain("Tuần này đang khóa chỉnh sửa");
  });

  it("makes the shift selected for quick assignment explicit", () => {
    expect(render({}, shift.id)).toContain("Đang chọn để xếp nhanh");
  });

  it("shows the desktop-style weekly overview in the shift palette", () => {
    const html = render();
    expect(html).toContain("Tổng quan tuần");
    expect(html).toContain("1</strong><span>ca đã xếp");
    expect(html).toContain("1/1</strong><span>nhân viên có ca");
  });

  it("keeps staffing controls aligned inside the schedule table footer", () => {
    const html = renderToStaticMarkup(
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
        onDelete={() => undefined}
        countOverrides={{ "1:Đ": 4 }}
        onSetCountOverride={() => undefined}
      />,
    );

    expect(html).toContain("<tfoot>");
    expect(html).toContain(
      '<tr class="schedule-staffing-row"><th>Sáng</th>',
    );
    expect(html).toContain(
      '<tr class="schedule-staffing-row"><th>Trưa</th>',
    );
    expect(html).toContain(
      '<tr class="schedule-staffing-row"><th>Tối</th>',
    );
    expect(html.match(/class="staffing-count-input"/g)).toHaveLength(21);
    expect(html).toContain('aria-label="Tổng ca Tối ngày 1"');
    expect(html).toContain('value="4"');
    expect(html).not.toContain('class="staffing-summary"');
  });

  it("exposes readable employee name and position hooks", () => {
    const html = render();
    expect(html).toContain('class="schedule-employee-name"');
    expect(html).toContain('class="schedule-employee-position"');
    expect(html).toContain("Nguyễn Phi Hùng");
    expect(html).toContain("Bếp trưởng");
  });
});
