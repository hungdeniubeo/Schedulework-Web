import { describe, expect, it } from "vitest";
import {
  PRESET_OPTIONS,
  availabilityByEmployee,
  createEmptyAvailability,
  createPresetDay,
  formatAvailabilityCell,
  formatAvailabilityPreset,
  normalizeAvailability,
  normalizeOffDay,
  validateAvailability,
} from "./availability";
import type { Availability, AvailabilityPreset } from "../types/domain";

const expectedPresets: Array<[AvailabilityPreset, string, string]> = [
  ["morning", "Sáng", "10h–14h"],
  ["morning_afternoon", "Sáng + Trưa", "10h–17h"],
  ["evening", "Tối", "17h–23h"],
  ["full", "Full", "10h–14h / 17h–23h"],
  ["afternoon_evening", "Trưa + Tối", "14h–23h"],
];

describe("availability presets", () => {
  it.each(expectedPresets)("creates %s with its default hours", (preset, label, hours) => {
    const day = createPresetDay(preset);
    expect(formatAvailabilityPreset(day)).toBe(label);
    expect(formatAvailabilityCell(day)).toBe(hours);
  });

  it("keeps customized hours for one and split intervals", () => {
    const single = createPresetDay("morning_afternoon");
    if ("intervals" in single) single.intervals[0].end = "18:00";
    expect(formatAvailabilityCell(single)).toBe("10h–18h");

    const full = createPresetDay("full");
    if ("intervals" in full) full.intervals[1].start = "18:00";
    expect(formatAvailabilityCell(full)).toBe("10h–14h / 18h–23h");
  });

  it("contains only the five required presets", () => {
    expect(PRESET_OPTIONS.map((option) => option.value)).toEqual(
      expectedPresets.map(([preset]) => preset),
    );
  });
});

describe("admin scheduler availability mapping", () => {
  it("maps the latest submitted payload by employee without creating schedule entries", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning_afternoon");
    const day = availability.days["1"];
    if ("intervals" in day) day.intervals[0].end = "18:00";
    const mapped = availabilityByEmployee([
      {
        id: "submission-1",
        week_id: "registration-week-1",
        employee_id: "employee-1",
        availability,
        note: null,
        submitted_at: "",
        updated_at: "",
      },
    ]);
    expect(formatAvailabilityCell(mapped["employee-1"].days["1"])).toBe("10h–18h");
    expect(mapped["missing-employee"]).toBeUndefined();
    expect(mapped).not.toHaveProperty("entries");
  });
});

describe("validateAvailability", () => {
  it("accepts a complete seven-day v2 payload", () => {
    expect(validateAvailability(createEmptyAvailability(), "")).toEqual([]);
  });

  it("rejects a payload without all seven days", () => {
    const availability = createEmptyAvailability();
    delete availability.days["7"];
    expect(validateAvailability(availability, "")).toContain(
      "Lịch đăng ký phải có đủ 7 ngày.",
    );
  });

  it("normalizes an off day to no preset or intervals", () => {
    expect(normalizeOffDay(createPresetDay("morning"))).toMatchObject({
      status: "available",
    });
    expect(
      normalizeOffDay({
        status: "off",
        preset: "morning",
        intervals: [{ start: "10:00", end: "14:00" }],
      }),
    ).toEqual({ status: "off", preset: null, intervals: [] });
  });

  it("rejects minute values and reversed hours", () => {
    const minutes = createEmptyAvailability();
    minutes.days["1"] = {
      status: "available",
      preset: "morning",
      intervals: [{ start: "10:30", end: "14:00" }],
    };
    expect(validateAvailability(minutes, "")).toContain(
      "Thứ 2: giờ đăng ký phải là giờ tròn.",
    );

    const reversed = createEmptyAvailability();
    reversed.days["1"] = {
      status: "available",
      preset: "morning",
      intervals: [{ start: "17:00", end: "10:00" }],
    };
    expect(validateAvailability(reversed, "")).toContain(
      "Thứ 2: giờ bắt đầu phải trước giờ kết thúc.",
    );
  });

  it("rejects overlapping Full intervals", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = {
      status: "available",
      preset: "full",
      intervals: [
        { start: "10:00", end: "18:00" },
        { start: "17:00", end: "23:00" },
      ],
    };
    expect(validateAvailability(availability, "")).toContain(
      "Thứ 2: các khoảng giờ không được chồng lấn.",
    );
  });

  it("keeps valid legacy v1 availability readable and normalizes it to v2", () => {
    const legacy: Availability = {
      version: 1,
      days: Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [
          String(index + 1),
          { status: "off", periods: [], start: null, end: null },
        ]),
      ),
    };
    legacy.days["1"] = {
      status: "available",
      periods: ["morning", "afternoon"],
      start: "10:00",
      end: "18:00",
    };
    expect(validateAvailability(legacy, "")).toEqual([]);
    expect(formatAvailabilityCell(legacy.days["1"])).toBe("10h–18h");
    const normalized = normalizeAvailability(legacy);
    expect(normalized.version).toBe(2);
    expect(normalized.days["1"]).toEqual({
      status: "available",
      preset: "morning_afternoon",
      intervals: [{ start: "10:00", end: "18:00" }],
    });
  });

  it("normalizes legacy minute values to hour-only controls when edited", () => {
    const legacy: Availability = {
      version: 1,
      days: Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [
          String(index + 1),
          { status: "off", periods: [], start: null, end: null },
        ]),
      ),
    };
    legacy.days["1"] = {
      status: "available",
      periods: ["morning"],
      start: "10:15",
      end: "14:45",
    };
    expect(formatAvailabilityCell(legacy.days["1"])).toBe("10:15–14:45");
    expect(normalizeAvailability(legacy).days["1"]).toMatchObject({
      intervals: [{ start: "10:00", end: "15:00" }],
    });
  });

  it("rejects notes longer than 500 characters", () => {
    expect(validateAvailability(createEmptyAvailability(), "x".repeat(501))).toContain(
      "Ghi chú không được dài quá 500 ký tự.",
    );
  });
});
