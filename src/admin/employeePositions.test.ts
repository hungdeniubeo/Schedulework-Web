import { describe, expect, it } from "vitest";
import { employeesWithRenamedPosition } from "./employeePositions";
import type { CloudEmployee } from "../scheduling/types";

const employees: CloudEmployee[] = [
  {
    id: "employee-1",
    name: "Nguyễn Phi Hùng",
    active: true,
    groupId: "group-1",
    positionId: "position-1",
    positionName: "Bếp trưởng",
    sortOrder: 0,
    isFullTime: true,
    isNew: false,
  },
  {
    id: "employee-2",
    name: "Nhân viên khác",
    active: true,
    groupId: null,
    positionId: null,
    positionName: null,
    sortOrder: 1,
    isFullTime: false,
    isNew: true,
  },
];

describe("employeesWithRenamedPosition", () => {
  it("propagates a renamed position only to assigned employees", () => {
    const renamed = employeesWithRenamedPosition(employees, {
      id: "position-1",
      name: "Bếp chính",
      sortOrder: 0,
    });

    expect(renamed[0].positionName).toBe("Bếp chính");
    expect(renamed[1]).toBe(employees[1]);
  });
});
