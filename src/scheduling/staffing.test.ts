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

  it("uses the scheduler's 10-14 / 14-17(18) / 17(18)-23 periods", () => {
    expect(periodsForRange({ start: 10 * 60, end: 14 * 60 })).toEqual(["S"]);
    expect(periodsForRange({ start: 14 * 60, end: 17 * 60 })).toEqual(["T"]);
    expect(periodsForRange({ start: 14 * 60, end: 18 * 60 })).toEqual(["T"]);
    expect(periodsForRange({ start: 17 * 60, end: 23 * 60 })).toEqual(["Đ"]);
    expect(periodsForRange({ start: 18 * 60, end: 23 * 60 })).toEqual(["Đ"]);
  });

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

  it("keeps split morning/evening shifts out of the afternoon count", () => {
    const shifts: ShiftType[] = [
      {
        id: "split",
        label: "10:00-14:00/17:00-23:00",
        color: "#000000",
        isPreset: true,
      },
    ];
    const entries: ScheduleEntry[] = [
      {
        id: "e",
        scheduleWeekId: "w",
        employeeId: "p",
        dayOfWeek: 2,
        shiftTypeId: "split",
        customStart: null,
        customEnd: null,
        customLabel: null,
        sortOrderInCell: 0,
      },
    ];
    expect(periodCounts(entries, shifts)[1]).toEqual({ S: 1, T: 0, Đ: 1 });
  });

  it("matches the scheduler rule for short shifts that cross a period boundary", () => {
    expect(periodsForRange({ start: 13 * 60 + 30, end: 14 * 60 + 30 })).toEqual([
      "S",
    ]);
    expect(periodsForRange({ start: 16 * 60 + 30, end: 17 * 60 + 30 })).toEqual([
      "T",
    ]);
    expect(periodsForRange({ start: 17 * 60, end: 18 * 60 })).toEqual(["Đ"]);
  });

  it("keeps only substantial periods when one period clearly dominates", () => {
    expect(periodsForRange({ start: 13 * 60 + 30, end: 17 * 60 + 30 })).toEqual([
      "T",
    ]);
  });

  it("does not assign ranges that sit completely outside 10:00-23:00", () => {
    expect(periodsForRange({ start: 8 * 60, end: 10 * 60 })).toEqual([]);
    expect(periodsForRange({ start: 23 * 60, end: 24 * 60 })).toEqual([]);
  });
});
