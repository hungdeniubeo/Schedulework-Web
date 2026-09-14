import { describe, expect, it } from "vitest";
import { employeeFromRow } from "./api";

describe("employeeFromRow", () => {
  it("maps an employee position from the joined position row", () => {
    expect(
      employeeFromRow({
        id: "employee-1",
        name: "Nguyễn Phi Hùng",
        active: true,
        group_id: "group-1",
        position_id: "position-1",
        positions: { name: "Bếp trưởng" },
        sort_order: 2,
        is_full_time: true,
        is_new: false,
      }),
    ).toEqual({
      id: "employee-1",
      name: "Nguyễn Phi Hùng",
      active: true,
      groupId: "group-1",
      positionId: "position-1",
      positionName: "Bếp trưởng",
      sortOrder: 2,
      isFullTime: true,
      isNew: false,
    });
  });

  it("maps an employee without a position", () => {
    expect(
      employeeFromRow({
        id: "employee-2",
        name: "Không chức danh",
        active: true,
        group_id: null,
        position_id: null,
        positions: null,
        sort_order: 0,
        is_full_time: false,
        is_new: true,
      }),
    ).toMatchObject({ positionId: null, positionName: null });
  });
});
