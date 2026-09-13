import type { AdminEmployee, AvailabilitySubmission } from "../types/domain";

export type MatrixRow = {
  employee: AdminEmployee;
  submission: AvailabilitySubmission | null;
  submitted: boolean;
};

export function buildMatrixRows(
  employees: AdminEmployee[],
  submissions: AvailabilitySubmission[],
): MatrixRow[] {
  const byEmployee = new Map(
    submissions.map((submission) => [submission.employee_id, submission]),
  );
  return employees
    .filter((employee) => employee.active)
    .map((employee) => {
      const submission = byEmployee.get(employee.id) ?? null;
      return { employee, submission, submitted: submission !== null };
    });
}
