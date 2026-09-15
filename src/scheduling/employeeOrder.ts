import type { CloudEmployee } from "./types";

function sameGroup(first: string | null, second: string | null): boolean {
  return first === second;
}

function inGroup(
  employees: CloudEmployee[],
  groupId: string | null,
): CloudEmployee[] {
  return employees
    .filter((employee) => sameGroup(employee.groupId, groupId))
    .sort((first, second) => first.sortOrder - second.sortOrder);
}

function applyOrder(employees: CloudEmployee[]): CloudEmployee[] {
  return employees.map((employee, index) => ({ ...employee, sortOrder: index }));
}

export function moveEmployeeLocally(
  employees: CloudEmployee[],
  employeeId: string,
  targetGroupId: string | null,
  beforeEmployeeId?: string,
): CloudEmployee[] {
  const moved = employees.find((employee) => employee.id === employeeId);
  if (!moved || beforeEmployeeId === employeeId) return employees;

  const sourceGroupId = moved.groupId;
  const source = inGroup(employees, sourceGroupId).filter(
    (employee) => employee.id !== employeeId,
  );
  const target = sameGroup(sourceGroupId, targetGroupId)
    ? [...source]
    : inGroup(employees, targetGroupId);

  let targetIndex = 0;
  if (beforeEmployeeId) {
    targetIndex = target.findIndex((employee) => employee.id === beforeEmployeeId);
    if (targetIndex < 0) return employees;
  }

  const movedNext = { ...moved, groupId: targetGroupId };
  target.splice(targetIndex, 0, movedNext);

  const normalizedSource = sameGroup(sourceGroupId, targetGroupId)
    ? []
    : applyOrder(source);
  const normalizedTarget = applyOrder(target);
  const byId = new Map(
    [...normalizedSource, ...normalizedTarget].map((employee) => [
      employee.id,
      employee,
    ]),
  );

  return employees.map((employee) => byId.get(employee.id) ?? employee);
}
