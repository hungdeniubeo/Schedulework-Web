import { validateAvailability, type Availability } from "./availability.ts";

function completeAvailability(): Availability {
  return {
    version: 1,
    days: Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        String(index + 1),
        { status: "off", periods: [], start: null, end: null },
      ]),
    ),
  };
}

function completeV2Availability(): Availability {
  return {
    version: 2,
    days: Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        String(index + 1),
        { status: "off", preset: null, intervals: [] },
      ]),
    ),
  };
}

Deno.test("accepts a complete seven-day availability payload", () => {
  if (!validateAvailability(completeAvailability())) {
    throw new Error("expected payload to be valid");
  }
});

Deno.test("rejects a payload that omits a day", () => {
  const value = completeAvailability();
  delete value.days["7"];
  if (validateAvailability(value))
    throw new Error("expected payload to be invalid");
});

Deno.test("rejects work periods on an off day", () => {
  const value = completeAvailability();
  value.days["1"].periods = ["morning"];
  if (validateAvailability(value))
    throw new Error("expected payload to be invalid");
});

Deno.test("accepts ordered custom hours on an available day", () => {
  const value = completeAvailability();
  value.days["1"] = {
    status: "available",
    periods: [],
    start: "17:00",
    end: "22:00",
  };
  if (!validateAvailability(value))
    throw new Error("expected payload to be valid");
});

Deno.test("accepts v2 hour-only presets including a split Full shift", () => {
  const value = completeV2Availability();
  value.days["1"] = {
    status: "available",
    preset: "full",
    intervals: [
      { start: "10:00", end: "14:00" },
      { start: "18:00", end: "23:00" },
    ],
  };
  if (!validateAvailability(value)) throw new Error("expected v2 payload to be valid");
});

Deno.test("rejects v2 minutes and overlapping split intervals", () => {
  const minutes = completeV2Availability();
  minutes.days["1"] = {
    status: "available",
    preset: "morning",
    intervals: [{ start: "10:30", end: "14:00" }],
  };
  if (validateAvailability(minutes)) throw new Error("expected minutes to be invalid");

  const overlap = completeV2Availability();
  overlap.days["1"] = {
    status: "available",
    preset: "full",
    intervals: [
      { start: "10:00", end: "18:00" },
      { start: "17:00", end: "23:00" },
    ],
  };
  if (validateAvailability(overlap)) throw new Error("expected overlap to be invalid");
});
