import { describe, expect, it } from "vitest";
import { buildScheduleGroups } from "./scheduleSheetModel";
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
  sortOrder,
  isHeadChef: false,
  isExecutiveChef: false,
  isManager: false,
  isFullTime: false,
  isNew: false,
  roleLabel: null,
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
