import { describe, expect, it } from "vitest";
import { buildScheduleGroups, employeesForSchedule } from "./scheduleSheetModel";
import type { ScheduleEntry } from "./types";
import type { CloudEmployee, Group } from "./types";

const employee = (
  id: string,
  groupId: string | null,
  sortOrder: number,
): CloudEmployee => ({
  id,
  name: id,
  active: true,
  groupId,
  positionId: null,
  positionName: null,
  sortOrder,
  isNew: false,
});

describe("buildScheduleGroups", () => {
  it("renders desktop-style group sections and keeps ungrouped employees last", () => {
    const groups: Group[] = [
      { id: "g2", name: "Nhóm 2", sortOrder: 2 },
      { id: "g1", name: "Nhóm 1", sortOrder: 1 },
    ];
    const employees = [
      employee("b", "g1", 2),
      employee("a", "g1", 1),
      employee("c", null, 0),
    ];

    expect(
      buildScheduleGroups(groups, employees).map((section) => ({
        name: section.group.name,
        employees: section.employees.map((item) => item.id),
      })),
    ).toEqual([
      { name: "Nhóm 1", employees: ["a", "b"] },
      { name: "Chưa có nhóm", employees: ["c"] },
    ]);
  });
});

describe("employeesForSchedule", () => {
  it("hides inactive employees even when the selected week contains their history", () => {
    const active = employee("active", "g1", 1);
    const historical = { ...employee("historical", "g1", 2), active: false };
    const unrelated = { ...employee("unrelated", "g1", 3), active: false };
    const entries = [{ employeeId: historical.id }] as ScheduleEntry[];

    expect(employeesForSchedule([active, historical, unrelated], entries)).toEqual([
      active,
    ]);
  });
});
