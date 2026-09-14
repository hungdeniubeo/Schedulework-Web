import { describe, expect, it } from "vitest";
import {
  employeesWithRenamedPosition,
  employeesWithUpdatedPosition,
} from "./employeePositions";
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

describe("employeesWithUpdatedPosition", () => {
  it("updates an employee position assignment and keeps the new employee flag", () => {
    const updated = employeesWithUpdatedPosition(
      employees,
      "employee-2",
      "position-1",
      [
        { id: "position-1", name: "Bếp trưởng", sortOrder: 0 },
      ],
    );

    expect(updated[1]).toMatchObject({
      positionId: "position-1",
      positionName: "Bếp trưởng",
      isNew: true,
    });
  });

  it("removes an employee position without showing a stale label", () => {
    const updated = employeesWithUpdatedPosition(
      employees,
      "employee-1",
      null,
      [],
    );

    expect(updated[0]).toMatchObject({
      positionId: null,
      positionName: null,
      isNew: false,
    });
  });
});
