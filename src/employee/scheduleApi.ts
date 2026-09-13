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

export type PublishedScheduleData = {
  currentEmployeeId: string;
  week: ScheduleWeek;
  entries: ScheduleEntry[];
  employees: CloudEmployee[];
  groups: Group[];
  shifts: ShiftType[];
};

export async function loadPublishedSchedule(): Promise<PublishedScheduleData | null> {
  const own = await getSupabase().rpc("my_employee").maybeSingle();
  if (own.error) {
    console.error(own.error);
    throw new Error("Không tải được tài khoản nhân viên.");
  }
  if (!own.data) throw new Error("Tài khoản nhân viên đã ngừng hoạt động.");
  const ownEmployee = own.data as { id: string };
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
    currentEmployeeId: ownEmployee.id,
    week,
    entries,
    employees,
    groups,
    shifts,
  };
}
