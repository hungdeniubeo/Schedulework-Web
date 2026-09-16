import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import type { ShiftType } from "./types";
import { findExactShiftForAvailability } from "./availabilityShiftMatch";

const shifts: ShiftType[] = [
  {
    id: "morning",
    label: "10:00-14:00",
    color: "#70AD47",
    isPreset: false,
  },
  {
    id: "night",
    label: "17h-23h",
    color: "#ED7D31",
    isPreset: false,
  },
  {
    id: "split",
    label: "10h-14h/17h-23h",
    color: "#5B9BD5",
    isPreset: false,
  },
];

describe("findExactShiftForAvailability", () => {
  it("matches one exact interval", () => {
    expect(
      findExactShiftForAvailability(createPresetDay("morning"), shifts)?.id,
    ).toBe("morning");
  });

  it("matches split intervals across h and colon label formats", () => {
    expect(
      findExactShiftForAvailability(createPresetDay("full"), shifts)?.id,
    ).toBe("split");
  });

  it("does not guess a nearby shift", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning_afternoon");

    expect(
      findExactShiftForAvailability(availability.days["1"], shifts),
    ).toBeNull();
  });

  it("never matches OFF", () => {
    expect(
      findExactShiftForAvailability(createEmptyAvailability().days["1"], shifts),
    ).toBeNull();
  });
});
