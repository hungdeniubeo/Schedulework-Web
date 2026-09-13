import { describe, expect, it } from "vitest";
import { findScheduleIssues, getEntryIssue, rangesForEntry } from "./overlap";
import type { ScheduleEntry, ShiftType } from "./types";

const shifts: ShiftType[] = [
  { id: "s1", label: "10:00-14:00", color: "#70AD47", isPreset: true },
  { id: "s2", label: "14:00-18:00", color: "#A6A6A6", isPreset: true },
  { id: "s3", label: "13:00-22:00", color: "#C55A5A", isPreset: true },
  { id: "split", label: "10h-14h/18h-23h", color: "#5B9BD5", isPreset: true },
];

function entry(id: string, shiftTypeId: string): ScheduleEntry {
  return {
    id,
    scheduleWeekId: "w1",
    employeeId: "e1",
    dayOfWeek: 1,
    shiftTypeId,
    customStart: null,
    customEnd: null,
    customLabel: null,
    sortOrderInCell: 0,
  };
}

describe("schedule conflict detection", () => {
  it("accepts back-to-back shifts", () => {
    expect(
      getEntryIssue(entry("b", "s2"), [entry("a", "s1")], shifts),
    ).toBeNull();
  });

  it("rejects overlapping shifts", () => {
    expect(
      getEntryIssue(entry("b", "s3"), [entry("a", "s1")], shifts)?.kind,
    ).toBe("overlap");
  });

  it("preserves split-shift ranges from desktop labels", () => {
    expect(rangesForEntry(entry("a", "split"), shifts[3])).toEqual([
      { start: 600, end: 840 },
      { start: 1080, end: 1380 },
    ]);
  });

  it("rejects an internally overlapping custom label", () => {
    const candidate = {
      ...entry("a", "s1"),
      customLabel: "10:00-15:00/14:00-18:00",
    };
    expect(getEntryIssue(candidate, [], shifts)?.kind).toBe("invalid");
  });

  it("validates a realistic 20 employee weekly schedule", () => {
    const entries = Array.from({ length: 20 }, (_, employeeIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => [
        {
          ...entry(`e${employeeIndex}-d${dayIndex}-a`, "s1"),
          employeeId: `e${employeeIndex}`,
          dayOfWeek: dayIndex + 1,
        },
        {
          ...entry(`e${employeeIndex}-d${dayIndex}-b`, "s2"),
          employeeId: `e${employeeIndex}`,
          dayOfWeek: dayIndex + 1,
        },
      ]),
    ).flat(2);

    expect(findScheduleIssues(entries, shifts)).toEqual([]);
    const conflicting = {
      ...entry("conflict", "s3"),
      employeeId: "e0",
      dayOfWeek: 1,
    };
    expect(findScheduleIssues([...entries, conflicting], shifts)).toHaveLength(
      3,
    );
  });
});
