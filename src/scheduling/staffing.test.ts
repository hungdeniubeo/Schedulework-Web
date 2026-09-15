import { describe, expect, it } from "vitest";
import {
  periodCounts,
  periodsForRange,
  staffingStatusForShiftCount,
} from "./staffing";
import type { ScheduleEntry, ShiftType } from "./types";

describe("staffing parity", () => {
  it.each([
    [0, "unset"],
    [1, "critical"],
    [2, "critical"],
    [3, "warning"],
    [4, "warning"],
    [5, "good"],
  ] as const)("maps %i shifts to %s", (count, status) =>
    expect(staffingStatusForShiftCount(count)).toBe(status),
  );

  it("counts each entry once per substantial S/T/Đ period it covers", () => {
    const shifts: ShiftType[] = [
      { id: "full", label: "10:00-23:00", color: "#000000", isPreset: false },
    ];
    const entries: ScheduleEntry[] = [
      {
        id: "e",
        scheduleWeekId: "w",
        employeeId: "p",
        dayOfWeek: 1,
        shiftTypeId: "full",
        customStart: null,
        customEnd: null,
        customLabel: null,
        sortOrderInCell: 0,
      },
    ];
    expect(periodCounts(entries, shifts)[0]).toEqual({ S: 1, T: 1, Đ: 1 });
  });

  it("matches the desktop rule for short shifts that cross a period boundary", () => {
    expect(periodsForRange({ start: 13 * 60 + 30, end: 14 * 60 + 30 })).toEqual([
      "S",
    ]);
    expect(periodsForRange({ start: 16 * 60 + 30, end: 17 * 60 + 30 })).toEqual([
      "T",
    ]);
  });

  it("keeps only substantial periods when one period clearly dominates", () => {
    expect(periodsForRange({ start: 13 * 60 + 30, end: 17 * 60 + 30 })).toEqual([
      "T",
    ]);
  });

  it("supports morning work before 10:00 like the desktop scheduler", () => {
    expect(periodsForRange({ start: 9 * 60, end: 12 * 60 })).toEqual(["S"]);
  });
});
