import { getSupabase } from "../lib/config";

export async function reorderSchedulerEmployee(
  employeeId: string,
  targetGroupId: string,
  beforeEmployeeId?: string,
): Promise<void> {
  const { error } = await getSupabase().rpc("reorder_scheduler_employee", {
    target_employee_id: employeeId,
    target_group_id: targetGroupId,
    before_employee_id: beforeEmployeeId ?? null,
  });
  if (!error) return;
  console.error(error);
  throw new Error("Không sắp xếp được nhân viên.");
}
