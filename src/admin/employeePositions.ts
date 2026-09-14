import type { CloudEmployee, Position } from "../scheduling/types";

export function employeesWithRenamedPosition(
  employees: CloudEmployee[],
  position: Position,
): CloudEmployee[] {
  return employees.map((employee) =>
    employee.positionId === position.id
      ? { ...employee, positionName: position.name }
      : employee,
  );
}

export function employeesWithUpdatedPosition(
  employees: CloudEmployee[],
  employeeId: string,
  positionId: string | null,
  positions: Position[],
): CloudEmployee[] {
  const positionName =
    positions.find((position) => position.id === positionId)?.name ?? null;
  return employees.map((employee) =>
    employee.id === employeeId
      ? { ...employee, positionId, positionName }
      : employee,
  );
}
