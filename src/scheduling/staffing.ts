import { rangesForEntry, type TimeRange } from "./overlap";
import type { ScheduleEntry, ShiftType } from "./types";

export type StaffingStatus = "unset" | "critical" | "warning" | "good";
export type StaffingPeriod = "S" | "T" | "Đ";

export function staffingStatusForShiftCount(
  shiftCount: number,
): StaffingStatus {
  if (shiftCount <= 0) return "unset";
  if (shiftCount <= 2) return "critical";
  if (shiftCount <= 4) return "warning";
  return "good";
}

export function periodsForRange(range: TimeRange): StaffingPeriod[] {
  const windows = [
    { key: "S" as const, start: 0, end: 14 * 60 },
    { key: "T" as const, start: 14 * 60, end: 17 * 60 },
    { key: "Đ" as const, start: 17 * 60, end: 24 * 60 },
  ];
  const coverage = windows.map((window) => ({
    key: window.key,
    overlap: Math.max(
      0,
      Math.min(range.end, window.end) - Math.max(range.start, window.start),
    ),
  }));
  const substantial = coverage
    .filter(({ overlap }) => overlap >= 2 * 60)
    .map(({ key }) => key);
  if (substantial.length) return substantial;
  return [
    coverage.reduce((best, current) =>
      current.overlap > best.overlap ? current : best,
    ).key,
  ];
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
