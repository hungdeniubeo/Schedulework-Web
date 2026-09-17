import type { CloudEmployee, Group, ScheduleEntry } from "./types";

export type ScheduleGroup = {
  group: Group;
  employees: CloudEmployee[];
};

export const UNGROUPED_GROUP_ID = "ungrouped";

export function buildScheduleGroups(
  groups: Group[],
  employees: CloudEmployee[],
): ScheduleGroup[] {
  const orderedGroups = [...groups].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const employeeSort = (first: CloudEmployee, second: CloudEmployee) =>
    first.sortOrder - second.sortOrder ||
    first.name.localeCompare(second.name, "vi");

  const sections: ScheduleGroup[] = orderedGroups.map((group) => ({
    group,
    employees: employees
      .filter((employee) => employee.groupId === group.id)
      .sort(employeeSort),
  }));

  const ungrouped = employees
    .filter((employee) => !employee.groupId)
    .sort(employeeSort);

  if (ungrouped.length > 0) {
    sections.push({
      group: {
        id: UNGROUPED_GROUP_ID,
        name: "Chưa có nhóm",
        sortOrder: Number.MAX_SAFE_INTEGER,
      },
      employees: ungrouped,
    });
  }

  return sections;
}

export function employeesForSchedule(
  employees: CloudEmployee[],
  _entries: ScheduleEntry[],
): CloudEmployee[] {
  return employees.filter((employee) => employee.active);
}
