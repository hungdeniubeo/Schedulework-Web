import { describe, expect, it } from "vitest";
import {
  createEmptyAvailability,
  formatAvailabilityCell,
  validateAvailability,
} from "./availability";
import type { Availability } from "../types/domain";

describe("validateAvailability", () => {
  it("accepts a complete seven-day payload", () => {
    expect(validateAvailability(createEmptyAvailability(), "")).toEqual([]);
  });

  it("rejects a payload without all seven days", () => {
    const availability = createEmptyAvailability();
    delete availability.days["7"];
    expect(validateAvailability(availability, "")).toContain(
      "Lịch đăng ký phải có đủ 7 ngày.",
    );
  });

  it("rejects periods and times on an off day", () => {
    const availability = createEmptyAvailability();
    availability.days["2"] = {
      status: "off",
      periods: ["morning"],
      start: "09:00",
      end: "17:00",
    };
    expect(validateAvailability(availability, "")).toContain(
      "Thứ 3: ngày nghỉ không được có ca hoặc giờ cụ thể.",
    );
  });

  it("requires paired, ordered custom times", () => {
    const missingEnd = createEmptyAvailability();
    missingEnd.days["1"] = {
      status: "available",
      periods: [],
      start: "09:00",
      end: null,
    };
    expect(validateAvailability(missingEnd, "")).toContain(
      "Thứ 2: vui lòng nhập đủ giờ bắt đầu và kết thúc.",
    );

    const reversed = createEmptyAvailability();
    reversed.days["1"] = {
      status: "available",
      periods: [],
      start: "17:00",
      end: "09:00",
    };
    expect(validateAvailability(reversed, "")).toContain(
      "Thứ 2: giờ bắt đầu phải trước giờ kết thúc.",
    );
  });

  it("rejects notes longer than 500 characters", () => {
    expect(
      validateAvailability(createEmptyAvailability(), "x".repeat(501)),
    ).toContain("Ghi chú không được dài quá 500 ký tự.");
  });
});

describe("formatAvailabilityCell", () => {
  it.each([
    [{ status: "off", periods: [], start: null, end: null }, "Nghỉ"],
    [
      {
        status: "available",
        periods: ["morning", "afternoon"],
        start: null,
        end: null,
      },
      "S, Tr",
    ],
    [
      {
        status: "available",
        periods: ["morning", "afternoon", "evening"],
        start: null,
        end: null,
      },
      "Cả ngày",
    ],
    [
      { status: "available", periods: [], start: "17:00", end: "22:00" },
      "17:00–22:00",
    ],
  ] satisfies Array<[Availability["days"][string], string]>)(
    "formats a matrix cell as %s",
    (day, expected) => expect(formatAvailabilityCell(day)).toBe(expected),
  );
});
