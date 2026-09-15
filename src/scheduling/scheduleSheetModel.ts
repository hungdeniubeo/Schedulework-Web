import type { CloudEmployee, Group, ScheduleEntry } from "./types";

export type ScheduleGroup = {
  group: Group;
  employees: CloudEmployee[];
};

export function buildScheduleGroups(
  groups: Group[],
  employees: CloudEmployee[],
): ScheduleGroup[] {
  const orderedGroups = [...groups].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const sections = [
    ...orderedGroups,
    {
      id: "ungrouped",
      name: "Chưa có nhóm",
      sortOrder: Number.MAX_SAFE_INTEGER,
    },
  ].map((group) => ({
    group,
    employees: employees
      .filter((employee) =>
        group.id === "ungrouped"
          ? !employee.groupId
          : employee.groupId === group.id,
      )
      .sort(
        (first, second) =>
          first.sortOrder - second.sortOrder ||
          first.name.localeCompare(second.name, "vi"),
      ),
  }));

  return sections.filter((section) => section.employees.length > 0);
}

export function employeesForSchedule(
  employees: CloudEmployee[],
  _entries: ScheduleEntry[],
): CloudEmployee[] {
  return employees.filter((employee) => employee.active);
}
