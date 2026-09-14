import { describe, expect, it } from "vitest";
import { consolidateCellEntry } from "./merge";
import { getEntryIssue } from "./overlap";
import { semanticShiftColor } from "./shiftStyle";
import type { ScheduleEntry, ShiftType } from "./types";

const shifts: ShiftType[] = [
  { id: "morning", label: "10:00-14:00", color: "#000000", isPreset: true },
  { id: "afternoon-night", label: "14:00-23:00", color: "#000000", isPreset: true },
  { id: "night-17", label: "17:00-23:00", color: "#000000", isPreset: true },
  { id: "night-18", label: "18:00-23:00", color: "#000000", isPreset: true },
  { id: "overlap", label: "13:00-17:00", color: "#000000", isPreset: false },
];

function entry(id: string, shiftTypeId: string): ScheduleEntry {
  return {
    id,
    scheduleWeekId: "week-1",
    employeeId: "employee-1",
    dayOfWeek: 1,
    shiftTypeId,
    customStart: null,
    customEnd: null,
    customLabel: null,
    sortOrderInCell: 0,
  };
}

describe("schedule cell consolidation", () => {
  it.each([
    ["night-17", "10:00-14:00/17:00-23:00", "#5B9BD5"],
    ["night-18", "10:00-14:00/18:00-23:00", "#5B9BD5"],
    ["afternoon-night", "10:00-23:00", "#8064A2"],
  ])("merges morning with %s into one semantic entry", (added, label, color) => {
    const merged = consolidateCellEntry(
      entry("new", added),
      [entry("existing", "morning")],
      shifts,
    );
    expect(merged.customLabel).toBe(label);
    expect(semanticShiftColor(merged.customLabel!)).toBe(color);
  });

  it("orders a reverse insertion chronologically", () => {
    const merged = consolidateCellEntry(
      entry("new", "morning"),
      [entry("existing", "night-17")],
      shifts,
    );
    expect(merged.customLabel).toBe("10:00-14:00/17:00-23:00");
  });

  it("rejects an actual overlap before consolidation", () => {
    const existing = entry("existing", "morning");
    const candidate = entry("new", "overlap");
    expect(getEntryIssue(candidate, [existing], shifts)?.kind).toBe("overlap");
  });
});
