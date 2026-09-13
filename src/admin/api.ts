import type { User } from "@supabase/supabase-js";
import { getSupabase } from "../lib/config";
import type {
  AdminEmployee,
  Availability,
  AvailabilitySubmission,
  RegistrationWeek,
  RegistrationWeekStatus,
} from "../types/domain";

function fail(error: { message: string } | null, message: string): void {
  if (error) {
    console.error(error);
    throw new Error(message);
  }
}

export async function isAdmin(user: User): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("user_id,role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  fail(error, "Không kiểm tra được quyền quản trị.");
  return data !== null;
}

export async function listEmployees(): Promise<AdminEmployee[]> {
  const { data, error } = await getSupabase()
    .from("employees")
    .select("id,name,active,created_at,updated_at")
    .order("name");
  fail(error, "Không tải được danh sách nhân viên.");
  return (data ?? []) as AdminEmployee[];
}

export async function listWeeks(): Promise<RegistrationWeek[]> {
  const { data, error } = await getSupabase()
    .from("registration_weeks")
    .select("*")
    .order("week_start", { ascending: false });
  fail(error, "Không tải được danh sách tuần đăng ký.");
  return (data ?? []) as RegistrationWeek[];
}

export async function createWeek(
  weekStart: string,
  lockAt: string,
): Promise<void> {
  const { error } = await getSupabase().from("registration_weeks").insert({
    week_start: weekStart,
    lock_at: lockAt,
    status: "open",
  });
  fail(
    error,
    "Không tạo được tuần đăng ký. Hãy kiểm tra ngày Thứ 2 và tuần trùng lặp.",
  );
}

export async function updateWeek(
  id: string,
  changes: { lock_at?: string; status?: RegistrationWeekStatus },
): Promise<void> {
  const { error } = await getSupabase()
    .from("registration_weeks")
    .update(changes)
    .eq("id", id);
  fail(error, "Không cập nhật được tuần đăng ký.");
}

export async function listSubmissions(
  weekId: string,
): Promise<AvailabilitySubmission[]> {
  const { data, error } = await getSupabase()
    .from("availability_submissions")
    .select("*")
    .eq("week_id", weekId);
  fail(error, "Không tải được đăng ký của nhân viên.");
  return (data ?? []) as AvailabilitySubmission[];
}

export async function saveAdminSubmission(input: {
  id?: string;
  weekId: string;
  employeeId: string;
  availability: Availability;
  note: string;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("availability_submissions")
    .upsert(
      {
        ...(input.id ? { id: input.id } : {}),
        week_id: input.weekId,
        employee_id: input.employeeId,
        availability: input.availability,
        note: input.note || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "week_id,employee_id" },
    );
  fail(error, "Không lưu được đăng ký của nhân viên.");
}
