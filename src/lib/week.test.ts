import { describe, expect, it } from "vitest";
import {
  formatDeadline,
  defaultRegistrationWindow,
  formatWeekRange,
  isoToVietnamDateTimeInput,
  isMondayDate,
  isRegistrationLocked,
  vietnamDateTimeToIso,
} from "./week";

describe("online week helpers", () => {
  it("recognizes Monday date-only values", () => {
    expect(isMondayDate("2026-09-21")).toBe(true);
    expect(isMondayDate("2026-09-22")).toBe(false);
    expect(isMondayDate("not-a-date")).toBe(false);
  });

  it("formats the Monday to Sunday range without timezone drift", () => {
    expect(formatWeekRange("2026-09-21")).toBe("21/09 - 27/09");
  });

  it("uses the Friday 22:00 Ho Chi Minh deadline and every non-open status", () => {
    const before = new Date("2026-09-18T14:59:59.999Z");
    const atDeadline = new Date("2026-09-18T15:00:00.000Z");
    const lockAt = "2026-09-18T15:00:00.000Z";
    expect(isRegistrationLocked("open", lockAt, before)).toBe(false);
    expect(isRegistrationLocked("open", lockAt, atDeadline)).toBe(true);
    expect(isRegistrationLocked("locked", lockAt, before)).toBe(true);
    expect(isRegistrationLocked("archived", lockAt, before)).toBe(true);
  });

  it("formats deadline in Ho Chi Minh time", () => {
    expect(formatDeadline("2026-09-24T15:00:00.000Z")).toContain("22:00");
  });

  it("converts deadline inputs using Vietnam timezone regardless of browser timezone", () => {
    expect(vietnamDateTimeToIso("2026-09-24T22:00")).toBe(
      "2026-09-24T15:00:00.000Z",
    );
    expect(isoToVietnamDateTimeInput("2026-09-24T15:00:00.000Z")).toBe(
      "2026-09-24T22:00",
    );
  });

  it("prefills the next week whose Friday 22:00 deadline is still in the future", () => {
    expect(
      defaultRegistrationWindow(new Date("2026-09-13T05:00:00.000Z")),
    ).toEqual({
      weekStart: "2026-09-21",
      lockAtInput: "2026-09-18T22:00",
    });
  });
});
