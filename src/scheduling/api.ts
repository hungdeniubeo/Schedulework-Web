import { getSupabase } from "../lib/config";
import type {
  CloudEmployee,
  Group,
  Position,
  ScheduleEntry,
  ScheduleWeek,
  ScheduleWeekStatus,
  ShiftType,
} from "./types";
import type { AvailabilitySubmission } from "../types/domain";

function fail(error: { message: string } | null, message: string): void {
  if (error) {
    console.error(error);
    throw new Error(message);
  }
}

const employeeColumns =
  "id,name,active,group_id,position_id,positions(name),sort_order,is_new";

export function employeeFromRow(row: Record<string, unknown>): CloudEmployee {
  const position = row.positions as { name?: unknown } | null;
  return {
    id: String(row.id),
    name: String(row.name),
    active: Boolean(row.active),
    groupId: row.group_id ? String(row.group_id) : null,
    positionId: row.position_id ? String(row.position_id) : null,
    positionName: position?.name ? String(position.name) : null,
    sortOrder: Number(row.sort_order),
    isNew: Boolean(row.is_new),
  };
}

function entryFromRow(row: Record<string, unknown>): ScheduleEntry {
  const clock = (value: unknown) =>
    typeof value === "string" ? value.slice(0, 5) : null;
  return {
    id: String(row.id),
    scheduleWeekId: String(row.schedule_week_id),
    employeeId: String(row.employee_id),
    dayOfWeek: Number(row.day_of_week),
    shiftTypeId: String(row.shift_type_id),
    customStart: clock(row.custom_start),
    customEnd: clock(row.custom_end),
    customLabel: row.custom_label ? String(row.custom_label) : null,
    sortOrderInCell: Number(row.sort_order_in_cell),
  };
}

export async function listGroups(): Promise<Group[]> {
  const { data, error } = await getSupabase()
    .from("groups")
    .select("id,name,sort_order")
    .order("sort_order");
  fail(error, "Không tải được danh sách nhóm.");
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
  }));
}

export async function addGroup(name: string, sortOrder: number): Promise<void> {
  const { error } = await getSupabase()
    .from("groups")
    .insert({ name, sort_order: sortOrder });
  fail(error, "Không tạo được nhóm.");
}

export async function patchGroup(
  id: string,
  changes: { name?: string; sortOrder?: number },
): Promise<void> {
  const { error } = await getSupabase()
    .from("groups")
    .update({
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.sortOrder !== undefined
        ? { sort_order: changes.sortOrder }
        : {}),
    })
    .eq("id", id);
  fail(error, "Không cập nhật được nhóm.");
}

export async function removeGroup(id: string): Promise<void> {
  const { error } = await getSupabase().from("groups").delete().eq("id", id);
  fail(
    error,
    "Không thể xóa nhóm đang có nhân viên. Hãy chuyển nhân viên sang nhóm khác trước.",
  );
}

function positionFromRow(row: Record<string, unknown>): Position {
  return {
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
  };
}

export async function listPositions(): Promise<Position[]> {
  const { data, error } = await getSupabase()
    .from("positions")
    .select("id,name,sort_order")
    .order("sort_order");
  fail(error, "Không tải được danh sách vị trí.");
  return (data ?? []).map((row) => positionFromRow(row));
}

export async function addPosition(
  name: string,
  sortOrder: number,
): Promise<Position> {
  const { data, error } = await getSupabase()
    .from("positions")
    .insert({ name, sort_order: sortOrder })
    .select("id,name,sort_order")
    .single();
  fail(error, "Không tạo được vị trí.");
  return positionFromRow(data as Record<string, unknown>);
}

export async function patchPosition(
  id: string,
  changes: { name?: string; sortOrder?: number },
): Promise<void> {
  const { error } = await getSupabase()
    .from("positions")
    .update({
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.sortOrder !== undefined
        ? { sort_order: changes.sortOrder }
        : {}),
    })
    .eq("id", id);
  fail(error, "Không cập nhật được vị trí.");
}

export async function swapPositionOrder(
  firstPositionId: string,
  secondPositionId: string,
): Promise<void> {
  const { error } = await getSupabase().rpc("swap_position_sort_orders", {
    first_position_id: firstPositionId,
    second_position_id: secondPositionId,
  });
  fail(error, "Không sắp xếp được vị trí.");
}

export async function removePosition(id: string): Promise<void> {
  const { error } = await getSupabase().from("positions").delete().eq("id", id);
  if (!error) return;
  console.error(error);
  throw new Error(
    error.code === "23503"
      ? "Vị trí này đang được sử dụng. Hãy bỏ vị trí khỏi nhân viên trước khi xóa."
      : "Không xóa được vị trí.",
  );
}

export async function listSchedulerEmployees(): Promise<CloudEmployee[]> {
  const { data, error } = await getSupabase()
    .from("employees")
    .select(employeeColumns)
    .order("sort_order");
  fail(error, "Không tải được nhân viên.");
  return (data ?? []).map((row) => employeeFromRow(row));
}

export async function patchEmployee(
  id: string,
  changes: Partial<Omit<CloudEmployee, "id" | "positionName">>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (changes.name !== undefined) payload.name = changes.name;
  if (changes.active !== undefined) payload.active = changes.active;
  if (changes.groupId !== undefined) payload.group_id = changes.groupId;
  if (changes.positionId !== undefined) payload.position_id = changes.positionId;
  if (changes.sortOrder !== undefined) payload.sort_order = changes.sortOrder;
  if (changes.isNew !== undefined) payload.is_new = changes.isNew;
  const { error } = await getSupabase()
    .from("employees")
    .update(payload)
    .eq("id", id);
  fail(error, "Không cập nhật được nhân viên.");
}

export async function listShiftTypes(): Promise<ShiftType[]> {
  const { data, error } = await getSupabase()
    .from("shift_types")
    .select("id,label,color,is_preset")
    .order("created_at");
  fail(error, "Không tải được danh sách ca.");
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    color: row.color,
    isPreset: row.is_preset,
  }));
}

export async function addShiftType(
  input: Omit<ShiftType, "id">,
): Promise<void> {
  const { error } = await getSupabase().from("shift_types").insert({
    label: input.label,
    color: input.color,
    is_preset: input.isPreset,
  });
  fail(error, "Không tạo được ca làm.");
}

export async function patchShiftType(
  id: string,
  input: Omit<ShiftType, "id">,
): Promise<void> {
  const { error } = await getSupabase()
    .from("shift_types")
    .update({
      label: input.label,
      color: input.color,
      is_preset: input.isPreset,
    })
    .eq("id", id);
  fail(error, "Không cập nhật được ca làm.");
}

export async function removeShiftType(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("shift_types")
    .delete()
    .eq("id", id);
  fail(error, "Không thể xóa ca đang được dùng trong lịch.");
}

export async function listScheduleWeeks(): Promise<ScheduleWeek[]> {
  const { data, error } = await getSupabase()
    .from("schedule_weeks")
    .select("*")
    .order("week_start", { ascending: false });
  fail(error, "Không tải được tuần xếp lịch.");
  return (data ?? []).map((row) => ({
    id: row.id,
    weekStart: row.week_start,
    status: row.status,
    publishedAt: row.published_at,
    countOverrides: row.count_overrides ?? {},
  }));
}

export async function addScheduleWeek(weekStart: string): Promise<void> {
  const { error } = await getSupabase()
    .from("schedule_weeks")
    .insert({ week_start: weekStart, status: "draft" });
  fail(
    error,
    "Không tạo được tuần xếp lịch. Ngày bắt đầu phải là Thứ 2 và chưa tồn tại.",
  );
}

export async function patchScheduleWeek(
  id: string,
  changes: {
    status?: ScheduleWeekStatus;
    publishedAt?: string | null;
    countOverrides?: Record<string, number>;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (changes.status !== undefined) payload.status = changes.status;
  if (changes.publishedAt !== undefined)
    payload.published_at = changes.publishedAt;
  if (changes.countOverrides !== undefined)
    payload.count_overrides = changes.countOverrides;
  const { error } = await getSupabase()
    .from("schedule_weeks")
    .update(payload)
    .eq("id", id);
  fail(error, "Không cập nhật được tuần xếp lịch.");
}

export async function listScheduleEntries(
  weekId: string,
): Promise<ScheduleEntry[]> {
  const { data, error } = await getSupabase()
    .from("schedule_entries")
    .select("*")
    .eq("schedule_week_id", weekId)
    .order("sort_order_in_cell");
  fail(error, "Không tải được lịch đã xếp.");
  return (data ?? []).map((row) => entryFromRow(row));
}

export async function listScheduleAvailability(
  weekStart: string,
): Promise<AvailabilitySubmission[]> {
  const weekResult = await getSupabase()
    .from("registration_weeks")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();
  fail(weekResult.error, "Không tải được tuần đăng ký tương ứng.");
  if (!weekResult.data) return [];

  const { data, error } = await getSupabase()
    .from("availability_submissions")
    .select("*")
    .eq("week_id", weekResult.data.id);
  fail(error, "Không tải được nguyện vọng đăng ký.");
  return (data ?? []) as AvailabilitySubmission[];
}

export async function listAllScheduleEntries(): Promise<ScheduleEntry[]> {
  const { data, error } = await getSupabase()
    .from("schedule_entries")
    .select("*");
  fail(error, "Không tải được các ca đã xếp.");
  return (data ?? []).map((row) => entryFromRow(row));
}

function entryPayload(entry: Omit<ScheduleEntry, "id">) {
  return {
    schedule_week_id: entry.scheduleWeekId,
    employee_id: entry.employeeId,
    day_of_week: entry.dayOfWeek,
    shift_type_id: entry.shiftTypeId,
    custom_start: entry.customStart,
    custom_end: entry.customEnd,
    custom_label: entry.customLabel,
    sort_order_in_cell: entry.sortOrderInCell,
  };
}

export async function addScheduleEntry(
  entry: Omit<ScheduleEntry, "id">,
): Promise<void> {
  const { error } = await getSupabase()
    .from("schedule_entries")
    .insert(entryPayload(entry));
  fail(
    error,
    "Không thêm được ca vào lịch. Chỉ có thể sửa tuần đang ở trạng thái bản nháp.",
  );
}

export async function patchScheduleEntry(entry: ScheduleEntry): Promise<void> {
  const { error } = await getSupabase()
    .from("schedule_entries")
    .update(entryPayload(entry))
    .eq("id", entry.id);
  fail(error, "Không cập nhật được ca.");
}

export async function consolidateScheduleEntry(
  entry: ScheduleEntry,
  removeEntryIds: string[],
): Promise<void> {
  const { error } = await getSupabase().rpc("consolidate_schedule_entry", {
    keeper_entry_id: entry.id,
    target_employee_id: entry.employeeId,
    target_day_of_week: entry.dayOfWeek,
    target_shift_type_id: entry.shiftTypeId,
    target_custom_label: entry.customLabel,
    target_sort_order: entry.sortOrderInCell,
    remove_entry_ids: removeEntryIds,
  });
  fail(error, "Không gộp được ca trong ô lịch.");
}

export async function removeScheduleEntry(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("schedule_entries")
    .delete()
    .eq("id", id);
  fail(error, "Không xóa được ca.");
}

export async function clearScheduleWeek(weekId: string): Promise<void> {
  const { error } = await getSupabase().rpc("clear_schedule_week", {
    target_week_id: weekId,
  });
  fail(error, "Không xóa được lịch tuần.");
}
