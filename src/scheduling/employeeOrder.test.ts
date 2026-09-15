import { describe, expect, it } from "vitest";
import type { CloudEmployee, ScheduleEntry } from "./types";
import { moveEmployeeLocally } from "./employeeOrder";

function employee(id: string, groupId: string, sortOrder: number): CloudEmployee {
  return {
    id,
    name: id.toUpperCase(),
    active: true,
    groupId,
    positionId: null,
    positionName: null,
    sortOrder,
    isNew: false,
  };
}

function idsInGroup(employees: CloudEmployee[], groupId: string): string[] {
  return employees
    .filter((item) => item.groupId === groupId)
    .sort((first, second) => first.sortOrder - second.sortOrder)
    .map((item) => item.id);
}

describe("moveEmployeeLocally", () => {
  it("reorders an employee inside the same group", () => {
    const employees = [
      employee("a", "meat", 0),
      employee("b", "meat", 1),
      employee("c", "meat", 2),
    ];

    const result = moveEmployeeLocally(employees, "c", "meat", "a");

    expect(idsInGroup(result, "meat")).toEqual(["c", "a", "b"]);
    expect(result.map((item) => item.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("moves an employee between groups and normalizes both orders", () => {
    const employees = [
      employee("a", "meat", 0),
      employee("b", "meat", 1),
      employee("c", "soup", 0),
      employee("d", "soup", 1),
    ];

    const result = moveEmployeeLocally(employees, "b", "soup", "d");

    expect(idsInGroup(result, "meat")).toEqual(["a"]);
    expect(idsInGroup(result, "soup")).toEqual(["c", "b", "d"]);
    expect(result.find((item) => item.id === "b")?.groupId).toBe("soup");
  });

  it("dropping on a group header inserts the employee at the start", () => {
    const employees = [
      employee("a", "meat", 0),
      employee("b", "soup", 0),
      employee("c", "soup", 1),
    ];

    const result = moveEmployeeLocally(employees, "a", "soup");

    expect(idsInGroup(result, "soup")).toEqual(["a", "b", "c"]);
  });

  it("does not mutate schedule ownership when employee rows move", () => {
    const employees = [employee("a", "meat", 0), employee("b", "meat", 1)];
    const entries: ScheduleEntry[] = [
      {
        id: "entry-a",
        scheduleWeekId: "week",
        employeeId: "a",
        dayOfWeek: 1,
        shiftTypeId: "shift",
        customStart: null,
        customEnd: null,
        customLabel: null,
        sortOrderInCell: 0,
      },
      {
        id: "entry-b",
        scheduleWeekId: "week",
        employeeId: "b",
        dayOfWeek: 1,
        shiftTypeId: "shift",
        customStart: null,
        customEnd: null,
        customLabel: null,
        sortOrderInCell: 0,
      },
    ];

    moveEmployeeLocally(employees, "b", "meat", "a");

    expect(entries.map((entry) => [entry.id, entry.employeeId])).toEqual([
      ["entry-a", "a"],
      ["entry-b", "b"],
    ]);
  });
});
