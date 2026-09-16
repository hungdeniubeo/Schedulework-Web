import { isMondayDate } from "../lib/week";
import type {
  RegistrationWeek,
  RegistrationWeekStatus,
} from "../types/domain";

export function registrationWeekStatusLabel(
  status: RegistrationWeekStatus,
  effectivelyLocked = status !== "open",
): string {
  if (status === "archived") return "Đã lưu trữ";
  return effectivelyLocked ? "Đã khóa" : "Đang mở";
}

export function registrationWeekStatusTone(
  status: RegistrationWeekStatus,
  effectivelyLocked: boolean,
): "open" | "locked" | "archived" {
  if (status === "archived") return "archived";
  return effectivelyLocked ? "locked" : "open";
}

export function registrationWeekActionState(
  status: RegistrationWeekStatus,
  effectivelyLocked: boolean,
) {
  return {
    canEditDeadline: status !== "archived",
    canLock: status === "open" && !effectivelyLocked,
    canReopen: status !== "archived" && effectivelyLocked,
    canArchive: status !== "archived",
    canDelete: true,
  };
}

export function partitionRegistrationWeeks(weeks: RegistrationWeek[]) {
  return {
    active: weeks.filter((week) => week.status !== "archived"),
    archived: weeks.filter((week) => week.status === "archived"),
  };
}

export function validateRegistrationWeek(
  weekStart: string,
  weeks: RegistrationWeek[],
): string | null {
  if (!isMondayDate(weekStart)) {
    return "Ngày bắt đầu tuần phải là Thứ Hai.";
  }
  if (weeks.some((week) => week.week_start === weekStart)) {
    return "Tuần đăng ký này đã tồn tại.";
  }
  return null;
}
