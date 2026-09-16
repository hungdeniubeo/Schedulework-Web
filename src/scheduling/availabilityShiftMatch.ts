import { getIntervals } from "../lib/availability";
import type { DayAvailability } from "../types/domain";
import { clockToMinutes, shiftRangesFromLabel } from "./shiftStyle";
import type { ShiftType } from "./types";

type Range = { start: number; end: number };

function availabilityRanges(day: DayAvailability): Range[] {
  return getIntervals(day).flatMap(({ start, end }) => {
    const startMinutes = clockToMinutes(start);
    const endMinutes = clockToMinutes(end);
    return startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
      ? [{ start: startMinutes, end: endMinutes }]
      : [];
  });
}

function sorted(ranges: readonly Range[]): Range[] {
  return [...ranges].sort(
    (first, second) => first.start - second.start || first.end - second.end,
  );
}

function sameRanges(left: readonly Range[], right: readonly Range[]): boolean {
  if (left.length === 0 || left.length !== right.length) return false;
  const first = sorted(left);
  const second = sorted(right);
  return first.every(
    (range, index) =>
      range.start === second[index].start && range.end === second[index].end,
  );
}

export function findExactShiftForAvailability(
  day: DayAvailability,
  shifts: ShiftType[],
): ShiftType | null {
  if (day.status !== "available") return null;
  const source = availabilityRanges(day);
  if (source.length === 0) return null;
  return (
    shifts.find((shift) =>
      sameRanges(source, shiftRangesFromLabel(shift.label)),
    ) ?? null
  );
}
