import { getIntervals, getOffReason } from "../lib/availability";
import type { DayAvailability } from "../types/domain";
import { clockToMinutes, formatShiftLabel } from "./shiftStyle";
import { entryLabel, rangesForEntry } from "./overlap";
import type { CloudEmployee, ScheduleEntry, ShiftType } from "./types";

const DAY_NAMES: Record<number, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ Nhật",
};

function availabilityRanges(day: DayAvailability) {
  return getIntervals(day).flatMap(({ start, end }) => {
    const startMinutes = clockToMinutes(start);
    const endMinutes = clockToMinutes(end);
    return startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
      ? [{ start: startMinutes, end: endMinutes }]
      : [];
  });
}

export function availabilityNoticeForEntry(
  entry: ScheduleEntry,
  employee: CloudEmployee,
  day: DayAvailability | undefined,
  shifts: ShiftType[],
): string | null {
  if (!day) return null;
  const dayName = DAY_NAMES[entry.dayOfWeek] ?? `ngày ${entry.dayOfWeek}`;

  if (day.status === "off") {
    const reason = getOffReason(day);
    return reason
      ? `${employee.name} đã đăng ký nghỉ ${dayName} — lý do: ${reason}.`
      : `${employee.name} đã đăng ký nghỉ ${dayName}.`;
  }

  const registered = availabilityRanges(day);
  if (registered.length === 0) return null;
  const shiftType = shifts.find((shift) => shift.id === entry.shiftTypeId);
  const scheduled = rangesForEntry(entry, shiftType);
  if (scheduled.length === 0) return null;

  const fullyContained = scheduled.every((range) =>
    registered.some(
      (availability) =>
        availability.start <= range.start && availability.end >= range.end,
    ),
  );
  if (fullyContained) return null;

  return `${employee.name} đã đăng ký khung giờ khác vào ${dayName}. Ca ${formatShiftLabel(entryLabel(entry, shifts))} nằm ngoài thời gian đã đăng ký.`;
}
