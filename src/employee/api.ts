import type { User } from "@supabase/supabase-js";
import { getSupabase } from "../lib/config";
import { isRegistrationLocked } from "../lib/week";
import { hasEmployeeAccess } from "../auth/access";
import type {
  Availability,
  AvailabilitySubmission,
  EmployeePortalData,
  Profile,
  RegistrationWeek,
} from "../types/domain";

export class EmployeePortalError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "EmployeePortalError";
  }
}

export async function getOwnProfile(user: User): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("user_id,role,must_change_password,created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new EmployeePortalError(
      "Không kiểm tra được quyền truy cập.",
      "PROFILE_ERROR",
    );
  }
  return data as Profile | null;
}

export async function getEmployeeAccess(user: User): Promise<{
  allowed: boolean;
  mustChangePassword: boolean;
}> {
  const profile = await getOwnProfile(user);
  if (profile?.role !== "employee") {
    return { allowed: false, mustChangePassword: false };
  }

  const { data, error } = await getSupabase().rpc("my_employee").maybeSingle();
  if (error) {
    console.error(error);
    throw new EmployeePortalError(
      "Không kiểm tra được trạng thái nhân viên.",
      "EMPLOYEE_ERROR",
    );
  }
  return {
    allowed: hasEmployeeAccess(profile, data !== null),
    mustChangePassword: profile.must_change_password,
  };
}

function chooseWeek(weeks: RegistrationWeek[]): RegistrationWeek | null {
  const now = Date.now();
  return (
    weeks
      .filter(
        (week) =>
          week.status === "open" && new Date(week.lock_at).getTime() > now,
      )
      .sort((a, b) => a.week_start.localeCompare(b.week_start))[0] ??
    [...weeks]
      .filter((week) => week.status !== "archived")
      .sort((a, b) => b.week_start.localeCompare(a.week_start))[0] ??
    null
  );
}

export async function loadEmployeePortal(): Promise<EmployeePortalData> {
  const supabase = getSupabase();
  const employeeResult = await supabase.rpc("my_employee").maybeSingle();
  if (employeeResult.error) {
    console.error(employeeResult.error);
    throw new EmployeePortalError(
      "Không tải được thông tin nhân viên.",
      "EMPLOYEE_ERROR",
    );
  }
  if (!employeeResult.data) {
    throw new EmployeePortalError(
      "Tài khoản nhân viên chưa được kích hoạt hoặc đã ngừng hoạt động.",
      "EMPLOYEE_INACTIVE",
    );
  }
  const employee = employeeResult.data as {
    id: string;
    name: string;
    active: boolean;
  };

  const weeksResult = await supabase
    .from("registration_weeks")
    .select("*")
    .neq("status", "archived")
    .order("week_start", { ascending: false });
  if (weeksResult.error) {
    console.error(weeksResult.error);
    throw new EmployeePortalError("Không tải được tuần đăng ký.", "WEEK_ERROR");
  }
  const week = chooseWeek((weeksResult.data ?? []) as RegistrationWeek[]);
  if (!week) {
    throw new EmployeePortalError(
      "Hiện chưa có tuần đăng ký lịch. Vui lòng quay lại sau hoặc liên hệ quản lý.",
      "NO_ACTIVE_WEEK",
    );
  }

  const submissionResult = await supabase
    .from("availability_submissions")
    .select("*")
    .eq("week_id", week.id)
    .eq("employee_id", employee.id)
    .maybeSingle();
  if (submissionResult.error) {
    console.error(submissionResult.error);
    throw new EmployeePortalError(
      "Không tải được lịch đã đăng ký.",
      "SUBMISSION_ERROR",
    );
  }
  const submission = submissionResult.data as AvailabilitySubmission | null;
  return {
    employee: { id: employee.id, name: employee.name },
    week: {
      id: week.id,
      weekStart: week.week_start,
      lockAt: week.lock_at,
      status: week.status,
      locked:
        week.status !== "open" ||
        Date.now() >= new Date(week.lock_at).getTime(),
    },
    submission: submission
      ? {
          availability: submission.availability,
          note: submission.note ?? "",
          submittedAt: submission.submitted_at,
          updatedAt: submission.updated_at,
        }
      : null,
  };
}

export async function saveEmployeeAvailability(input: {
  weekId: string;
  employeeId: string;
  availability: Availability;
  note: string;
}): Promise<EmployeePortalData["submission"]> {
  const { data, error } = await getSupabase()
    .from("availability_submissions")
    .upsert(
      {
        week_id: input.weekId,
        employee_id: input.employeeId,
        availability: input.availability,
        note: input.note || null,
      },
      { onConflict: "week_id,employee_id" },
    )
    .select("availability,note,submitted_at,updated_at")
    .single();
  if (error) {
    console.error(error);
    let locked = false;
    if (error.code === "42501") {
      const weekResult = await getSupabase()
        .from("registration_weeks")
        .select("status,lock_at")
        .eq("id", input.weekId)
        .maybeSingle();
      locked =
        !weekResult.error &&
        weekResult.data !== null &&
        isRegistrationLocked(weekResult.data.status, weekResult.data.lock_at);
    }
    throw new EmployeePortalError(
      locked
        ? "Đăng ký đã khóa. Vui lòng liên hệ quản lý nếu cần thay đổi."
        : "Không lưu được đăng ký. Vui lòng thử lại.",
      locked ? "REGISTRATION_LOCKED" : "SAVE_ERROR",
    );
  }
  return {
    availability: data.availability as Availability,
    note: data.note ?? "",
    submittedAt: data.submitted_at,
    updatedAt: data.updated_at,
  };
}
