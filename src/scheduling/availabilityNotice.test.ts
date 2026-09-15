import { describe, expect, it } from "vitest";
import type { DayAvailability } from "../types/domain";
import type { CloudEmployee, ScheduleEntry, ShiftType } from "./types";
import { availabilityNoticeForEntry } from "./availabilityNotice";

const employee: CloudEmployee = {
  id: "employee-1",
  name: "Nguyễn Văn A",
  active: true,
  groupId: "group-1",
  positionId: null,
  positionName: null,
  sortOrder: 0,
  isNew: false,
};

const shifts: ShiftType[] = [
  { id: "shift-day", label: "10:00-18:00", color: "#000000", isPreset: true },
  { id: "shift-late", label: "14:00-23:00", color: "#000000", isPreset: true },
  {
    id: "shift-split",
    label: "10:00-14:00/17:00-23:00",
    color: "#000000",
    isPreset: true,
  },
];

function entry(shiftTypeId: string, dayOfWeek = 2): ScheduleEntry {
  return {
    id: "entry-1",
    scheduleWeekId: "week-1",
    employeeId: employee.id,
    dayOfWeek,
    shiftTypeId,
    customStart: null,
    customEnd: null,
    customLabel: null,
    sortOrderInCell: 0,
  };
}

describe("availabilityNoticeForEntry", () => {
  it("shows OFF with the submitted reason and no extra assignment wording", () => {
    const day: DayAvailability = {
      status: "off",
      preset: null,
      intervals: [],
      offReason: "Đi khám bệnh",
    };

    expect(availabilityNoticeForEntry(entry("shift-day"), employee, day, shifts)).toBe(
      "Nguyễn Văn A đã đăng ký nghỉ Thứ Ba — lý do: Đi khám bệnh.",
    );
  });

  it("shows OFF without a reason", () => {
    const day: DayAvailability = {
      status: "off",
      preset: null,
      intervals: [],
      offReason: null,
    };

    expect(availabilityNoticeForEntry(entry("shift-day"), employee, day, shifts)).toBe(
      "Nguyễn Văn A đã đăng ký nghỉ Thứ Ba.",
    );
  });

  it("returns no notice when there is no registration data", () => {
    expect(
      availabilityNoticeForEntry(entry("shift-day"), employee, undefined, shifts),
    ).toBeNull();
  });

  it("notifies when any part of the assigned shift exceeds registration", () => {
    const day: DayAvailability = {
      status: "available",
      preset: null,
      intervals: [{ start: "10:00", end: "18:00" }],
    };

    expect(
      availabilityNoticeForEntry(entry("shift-late"), employee, day, shifts),
    ).toContain("nằm ngoài thời gian đã đăng ký");
  });

  it("returns no notice when the whole shift is contained", () => {
    const day: DayAvailability = {
      status: "available",
      preset: null,
      intervals: [{ start: "10:00", end: "18:00" }],
    };

    expect(availabilityNoticeForEntry(entry("shift-day"), employee, day, shifts)).toBeNull();
  });

  it("accepts a split shift when each work range fits a registered interval", () => {
    const day: DayAvailability = {
      status: "available",
      preset: "full",
      intervals: [
        { start: "10:00", end: "14:00" },
        { start: "17:00", end: "23:00" },
      ],
    };

    expect(
      availabilityNoticeForEntry(entry("shift-split"), employee, day, shifts),
    ).toBeNull();
  });
});
