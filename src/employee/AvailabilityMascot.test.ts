import { describe, expect, it } from "vitest";
import { pickRandomMascot } from "./AvailabilityMascot";

describe("availability mascot randomizer", () => {
  it("picks one item from the available mascot list", () => {
    const mascots = ["first", "second", "third"] as const;

    expect(pickRandomMascot(mascots, () => 0)).toBe("first");
    expect(pickRandomMascot(mascots, () => 0.5)).toBe("second");
    expect(pickRandomMascot(mascots, () => 0.999)).toBe("third");
  });

  it("can use the same randomizer for mascot click reactions", () => {
    const reactions = ["pop", "wiggle", "twirl"] as const;

    expect(pickRandomMascot(reactions, () => 0.01)).toBe("pop");
    expect(pickRandomMascot(reactions, () => 0.51)).toBe("wiggle");
    expect(pickRandomMascot(reactions, () => 0.99)).toBe("twirl");
  });

  it("returns null when the mascot folder is empty", () => {
    expect(pickRandomMascot([], () => 0.5)).toBeNull();
  });
});
