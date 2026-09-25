import { rangesForEntry, type TimeRange } from "./overlap";
import type { ScheduleEntry, ShiftType } from "./types";

export type StaffingStatus = "unset" | "critical" | "warning" | "good";
export type StaffingPeriod = "S" | "T" | "Đ";

const HOUR = 60;
const SUBSTANTIAL_OVERLAP = 2 * HOUR;
const PERIOD_WINDOWS: Array<{
  key: StaffingPeriod;
  start: number;
  end: number;
}> = [
  { key: "S", start: 10 * HOUR, end: 14 * HOUR },
  { key: "T", start: 14 * HOUR, end: 18 * HOUR },
  { key: "Đ", start: 17 * HOUR, end: 23 * HOUR },
];

export function staffingStatusForShiftCount(
  shiftCount: number,
): StaffingStatus {
  if (shiftCount <= 0) return "unset";
  if (shiftCount <= 2) return "critical";
  if (shiftCount <= 4) return "warning";
  return "good";
}

export function periodsForRange(range: TimeRange): StaffingPeriod[] {
  const coverage = PERIOD_WINDOWS.map((window) => ({
    key: window.key,
    overlap: Math.max(
      0,
      Math.min(range.end, window.end) - Math.max(range.start, window.start),
    ),
  }));
  const substantial = coverage
    .filter(({ overlap }) => overlap >= SUBSTANTIAL_OVERLAP)
    .map(({ key }) => key);
  if (substantial.length) return substantial;

  const overlapping = coverage.filter(({ overlap }) => overlap > 0);
  if (!overlapping.length) return [];

  const maxOverlap = Math.max(...overlapping.map(({ overlap }) => overlap));
  const tied = overlapping.filter(({ overlap }) => overlap === maxOverlap);
  if (tied.length === 1) return [tied[0].key];

  // 17:00-18:00 is the flexible hand-off between afternoon and evening.
  // A shift that starts at/after 17:00 belongs to evening; one that starts
  // before 17:00 stays with the earlier period when the overlap is tied.
  if (range.start >= 17 * HOUR && tied.some(({ key }) => key === "Đ")) {
    return ["Đ"];
  }
  if (range.start >= 14 * HOUR && tied.some(({ key }) => key === "T")) {
    return ["T"];
  }
  if (tied.some(({ key }) => key === "S")) return ["S"];
  return [tied[0].key];
}

export function periodCounts(
  entries: ScheduleEntry[],
  types: ShiftType[],
): Array<Record<StaffingPeriod, number>> {
  const counts = Array.from({ length: 7 }, () => ({ S: 0, T: 0, Đ: 0 }));
  for (const entry of entries) {
    if (entry.dayOfWeek < 1 || entry.dayOfWeek > 7) continue;
    const periods = new Set<StaffingPeriod>();
    const type = types.find((item) => item.id === entry.shiftTypeId);
    for (const range of rangesForEntry(entry, type)) {
      for (const period of periodsForRange(range)) periods.add(period);
    }
    for (const period of periods) counts[entry.dayOfWeek - 1][period] += 1;
  }
  return counts;
}
