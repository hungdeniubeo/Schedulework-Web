import { getSupabase } from "../lib/config";
import {
  listGroups,
  listScheduleEntries,
  listScheduleWeeks,
  listSchedulerEmployees,
  listShiftTypes,
} from "../scheduling/api";
import { selectLatestPublishedWeek } from "../scheduling/publication";
import type {
  CloudEmployee,
  Group,
  ScheduleEntry,
  ScheduleWeek,
  ShiftType,
} from "../scheduling/types";
import type {
  AvailabilitySubmission,
  RegistrationWeek,
} from "../types/domain";

export type PublishedScheduleData = {
  currentEmployeeId: string;
  week: ScheduleWeek;
  entries: ScheduleEntry[];
  employees: CloudEmployee[];
  groups: Group[];
  shifts: ShiftType[];
};

export type SubmittedAvailabilityData = {
  weekStart: string;
  submission: AvailabilitySubmission;
};

export type MyScheduleData = SubmittedAvailabilityData | null;

export function selectSubmittedAvailability(
  weeks: RegistrationWeek[],
  submissions: AvailabilitySubmission[],
  preferredWeekStart?: string,
): SubmittedAvailabilityData | null {
  const byWeek = new Map(submissions.map((submission) => [submission.week_id, submission]));
  const available = weeks
    .filter((week) => byWeek.has(week.id))
    .sort((first, second) => second.week_start.localeCompare(first.week_start));
  const week =
    available.find((item) => item.week_start === preferredWeekStart) ??
    available[0];
  return week
    ? { weekStart: week.week_start, submission: byWeek.get(week.id)! }
    : null;
}

export async function loadPublishedSchedule(
  knownEmployeeId?: string,
): Promise<PublishedScheduleData | null> {
  let employeeId = knownEmployeeId;
  if (!employeeId) {
    const own = await getSupabase().rpc("my_employee").maybeSingle();
    if (own.error) {
      console.error(own.error);
      throw new Error("Không tải được tài khoản nhân viên.");
    }
    if (!own.data) throw new Error("Tài khoản nhân viên đã ngừng hoạt động.");
    employeeId = (own.data as { id: string }).id;
  }
  const weeks = await listScheduleWeeks();
  const week = selectLatestPublishedWeek(weeks);
  if (!week) return null;
  const [entries, employees, groups, shifts] = await Promise.all([
    listScheduleEntries(week.id),
    listSchedulerEmployees(),
    listGroups(),
    listShiftTypes(),
  ]);
  return {
    currentEmployeeId: employeeId,
    week,
    entries,
    employees,
    groups,
    shifts,
  };
}

export async function loadMyScheduleData(employeeId: string): Promise<MyScheduleData> {
  const supabase = getSupabase();
  const [weeksResult, submissionsResult] = await Promise.all([
    supabase
      .from("registration_weeks")
      .select("*")
      .neq("status", "archived")
      .order("week_start", { ascending: false }),
    supabase
      .from("availability_submissions")
      .select("*")
      .eq("employee_id", employeeId),
  ]);
  if (weeksResult.error || submissionsResult.error) {
    console.error(weeksResult.error ?? submissionsResult.error);
    throw new Error("Không tải được lịch đã đăng ký.");
  }
  return selectSubmittedAvailability(
    (weeksResult.data ?? []) as RegistrationWeek[],
    (submissionsResult.data ?? []) as AvailabilitySubmission[],
  );
}
