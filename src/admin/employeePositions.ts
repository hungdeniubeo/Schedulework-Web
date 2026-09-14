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
