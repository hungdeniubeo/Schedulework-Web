import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatAdminDeadline,
  formatDeadline,
  defaultRegistrationWindow,
  formatRegistrationWeekLabel,
  formatWeekRange,
  isoToVietnamDateTimeInput,
  isMondayDate,
  isRegistrationLocked,
  vietnamDateTimeToIso,
} from "./week";

describe("online week helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("recognizes Monday date-only values", () => {
    expect(isMondayDate("2026-09-21")).toBe(true);
    expect(isMondayDate("2026-09-22")).toBe(false);
    expect(isMondayDate("not-a-date")).toBe(false);
  });

  it("formats the Monday to Sunday range without timezone drift", () => {
    expect(formatWeekRange("2026-09-21")).toBe("21/09 – 27/09");
  });

  it("formats the registration week from its Monday inside the month", () => {
    expect(formatRegistrationWeekLabel("2026-09-21")).toBe(
      "Đăng ký lịch tuần 4 tháng 9",
    );
    expect(formatRegistrationWeekLabel("2026-12-28")).toBe(
      "Đăng ký lịch tuần 5 tháng 12",
    );
    expect(formatRegistrationWeekLabel("2027-01-04")).toBe(
      "Đăng ký lịch tuần 2 tháng 1",
    );
  });

  it("formats the configured deadline in Ho Chi Minh City with date", () => {
    expect(formatDeadline("2026-09-18T15:00:00.000Z")).toBe(
      "22:00 Thứ Sáu, 18/09",
    );
    expect(formatDeadline("2026-09-20T02:30:00.000Z")).toBe(
      "09:30 Chủ Nhật, 20/09",
    );
  });

  it("formats the Admin deadline with the configured date and year", () => {
    expect(formatAdminDeadline("2026-09-18T15:00:00.000Z")).toBe(
      "22:00 · Thứ Sáu, 18/09/2026",
    );
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

  it("keeps the 2026-09-21 registration open on Monday in Ho Chi Minh time", () => {
    expect(
      isRegistrationLocked(
        "open",
        "2026-09-18T22:00:00+07:00",
        new Date("2026-09-14T00:00:00+07:00"),
      ),
    ).toBe(false);
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

  it("prefills the same next week across input and runtime timezones", () => {
    vi.stubEnv("TZ", "America/Los_Angeles");

    const expected = {
      weekStart: "2026-09-21",
      lockAtInput: "2026-09-18T22:00",
    };

    expect(
      defaultRegistrationWindow(new Date("2026-09-14T00:00:00+07:00")),
    ).toEqual(expected);
    expect(
      defaultRegistrationWindow(new Date("2026-09-14T02:00:00+09:00")),
    ).toEqual(expected);
  });
});
