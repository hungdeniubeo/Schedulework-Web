import { describe, expect, it } from "vitest";
import { formatShiftLabel, semanticShiftColor } from "./shiftStyle";

describe("cloud shift display parity", () => {
  it("formats desktop clock and split-shift syntax", () => {
    expect(formatShiftLabel("10h-14h/18h-23h")).toBe(
      "10:00 – 14:00 / 18:00 – 23:00",
    );
  });

  it("derives stable semantic colors from coverage", () => {
    expect(semanticShiftColor("10:00-14:00")).toBe("#70AD47");
    expect(semanticShiftColor("17:00-23:00")).toBe("#ED7D31");
  });
});
