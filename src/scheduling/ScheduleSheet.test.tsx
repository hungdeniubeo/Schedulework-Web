import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScheduleSheet } from "./ScheduleSheet";
import type { CloudEmployee } from "./types";

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
});
