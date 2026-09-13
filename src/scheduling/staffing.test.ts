import { describe, expect, it } from "vitest";
import { periodCounts, staffingStatusForShiftCount } from "./staffing";
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

  it("counts each entry once per S/T/Đ period it covers", () => {
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
});
