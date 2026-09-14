import { describe, expect, it } from "vitest";
import {
  classifyShiftLabel,
  consolidatedShiftLabel,
  formatShiftLabel,
  resolvedShiftColor,
  semanticShiftColor,
} from "./shiftStyle";

describe("cloud shift display parity", () => {
  it("formats desktop clock and split-shift syntax", () => {
    expect(formatShiftLabel("10h-14h/18h-23h")).toBe(
      "10:00 – 14:00 / 18:00 – 23:00",
    );
  });

  it.each([
    ["10:00-14:00", "#70AD47"],
    ["10:00-17:00", "#A6A6A6"],
    ["10:00-18:00", "#A6A6A6"],
    ["14:00-23:00", "#C55A5A"],
    ["17:00-23:00", "#ED7D31"],
    ["18:00-23:00", "#ED7D31"],
    ["10:00-14:00/17:00-23:00", "#5B9BD5"],
    ["10:00-14:00/18:00-23:00", "#5B9BD5"],
    ["10:00-23:00", "#8064A2"],
  ])("classifies %s with the desktop semantic color", (label, color) => {
    expect(semanticShiftColor(label)).toBe(color);
  });

  it.each([
    ["10:00-14:00", "morning"],
    ["10:00-17:00", "morningAfternoon"],
    ["10:00-18:00", "morningAfternoon"],
    ["14:00-17:00", "afternoon"],
    ["14:00-18:00", "afternoon"],
    ["14:00-23:00", "afternoonNight"],
    ["17:00-23:00", "night"],
    ["18:00-23:00", "night"],
    ["10:00-14:00/17:00-23:00", "full"],
    ["10:00-23:00", "long"],
  ])("classifies %s as %s", (label, category) => {
    expect(classifyShiftLabel(label)).toBe(category);
  });

  it("uses saved colors for base shifts and semantic colors for changed coverage", () => {
    expect(resolvedShiftColor("10:00-14:00", "#123456")).toBe("#123456");
    expect(resolvedShiftColor("10:00-14:00", "#123456", true)).toBe(
      "#70AD47",
    );
  });

  it("sorts ranges and merges only touching coverage", () => {
    expect(
      consolidatedShiftLabel([
        { start: 1020, end: 1380 },
        { start: 600, end: 840 },
      ]),
    ).toBe("10:00-14:00/17:00-23:00");
    expect(
      consolidatedShiftLabel([
        { start: 840, end: 1380 },
        { start: 600, end: 840 },
      ]),
    ).toBe("10:00-23:00");
  });
});
