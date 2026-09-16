import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CloudEmployee, ShiftType } from "../scheduling/types";
import { ScheduleGrid } from "./ScheduleGrid";

const employee: CloudEmployee = {
  id: "employee-1",
  name: "Nguyễn Phi Hùng",
  active: true,
  groupId: "group-1",
  positionId: null,
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

function render(sidebarOpen: boolean) {
  return renderToStaticMarkup(
    <ScheduleGrid
      groups={[{ id: "group-1", name: "MEAT", sortOrder: 0 }]}
      employees={[employee]}
      entries={[]}
      shifts={[shift]}
      weekStart="2026-09-21"
      editable
      selectedShiftId={null}
      onSelectShift={() => undefined}
      onAssign={() => undefined}
      onMove={() => undefined}
      onEdit={() => undefined}
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={() => undefined}
    />,
  );
}

describe("ScheduleGrid legacy workspace layout", () => {
  it("shows a right-side shift sidebar with an explicit hide control", () => {
    const html = render(true);
    expect(html).toContain('aria-label="Ẩn danh sách ca"');
    expect(html).toContain("scheduler-palette");
    expect(html).toContain("scheduler-workspace");
  });

  it("lets the table consume the workspace when the sidebar is hidden", () => {
    const html = render(false);
    expect(html).toContain('aria-label="Hiện danh sách ca"');
    expect(html).toContain("sidebar-hidden");
    expect(html).not.toContain('<aside class="scheduler-palette"');
  });

  it("uses the reference employee-column width for both the live table and totals", () => {
    const html = render(true);
    expect(html).toContain("legacy-scheduler-live-surface");
    expect(html).toContain("--scheduler-employee-width:360px");
    expect(html).toContain("schedule-daily-summary");
  });
});
