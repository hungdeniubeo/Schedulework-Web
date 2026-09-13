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
