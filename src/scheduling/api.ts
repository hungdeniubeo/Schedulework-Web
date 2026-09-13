import { getSupabase } from "../lib/config";
import type {
  CloudEmployee,
  Group,
  ScheduleEntry,
  ScheduleWeek,
  ScheduleWeekStatus,
  ShiftType,
} from "./types";

function fail(error: { message: string } | null, message: string): void {
  if (error) {
    console.error(error);
    throw new Error(message);
  }
}

const employeeColumns =
  "id,name,active,group_id,sort_order,is_head_chef,is_executive_chef,is_manager,is_full_time,is_new,role_label";

function employeeFromRow(row: Record<string, unknown>): CloudEmployee {
  return {
    id: String(row.id),
    name: String(row.name),
    active: Boolean(row.active),
    groupId: row.group_id ? String(row.group_id) : null,
    sortOrder: Number(row.sort_order),
    isHeadChef: Boolean(row.is_head_chef),
    isExecutiveChef: Boolean(row.is_executive_chef),
    isManager: Boolean(row.is_manager),
    isFullTime: Boolean(row.is_full_time),
    isNew: Boolean(row.is_new),
    roleLabel: row.role_label ? String(row.role_label) : null,
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
  changes: Partial<Omit<CloudEmployee, "id">>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (changes.name !== undefined) payload.name = changes.name;
  if (changes.active !== undefined) payload.active = changes.active;
  if (changes.groupId !== undefined) payload.group_id = changes.groupId;
  if (changes.sortOrder !== undefined) payload.sort_order = changes.sortOrder;
  if (changes.isHeadChef !== undefined)
    payload.is_head_chef = changes.isHeadChef;
  if (changes.isExecutiveChef !== undefined)
    payload.is_executive_chef = changes.isExecutiveChef;
  if (changes.isManager !== undefined) payload.is_manager = changes.isManager;
  if (changes.isFullTime !== undefined)
    payload.is_full_time = changes.isFullTime;
  if (changes.isNew !== undefined) payload.is_new = changes.isNew;
  if (changes.roleLabel !== undefined) payload.role_label = changes.roleLabel;
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
