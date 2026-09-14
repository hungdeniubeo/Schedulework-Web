import { describe, expect, it } from "vitest";
import {
  PRESET_OPTIONS,
  HOUR_OPTIONS,
  availabilityPresetForIntervals,
  availabilityByEmployee,
  createEmptyAvailability,
  createPresetDay,
  formatAvailabilityCell,
  formatAvailabilityDetail,
  formatAvailabilityPreset,
  getOffReason,
  getIntervals,
  hourOptionsForInterval,
  normalizeAvailability,
  normalizeDayAvailability,
  normalizeOffDay,
  prepareAvailabilityForSave,
  updateAvailabilityInterval,
  validateAvailability,
} from "./availability";
import type { Availability, AvailabilityPreset } from "../types/domain";

const expectedPresets: Array<[AvailabilityPreset, string, string]> = [
  ["morning", "Sáng", "10h–14h"],
  ["morning_afternoon", "Sáng + Trưa", "10h–17h"],
  ["afternoon", "Trưa", "14h–17h"],
  ["afternoon_evening", "Trưa + Tối", "14h–23h"],
  ["evening", "Tối", "17h–23h"],
  ["full", "Full", "10h–14h / 17h–23h"],
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

  it("contains the six shared employee presets", () => {
    expect(PRESET_OPTIONS.map((option) => option.value)).toEqual(
      expectedPresets.map(([preset]) => preset),
    );
  });

  it("describes adjustable picker ranges without changing defaults", () => {
    expect(
      Object.fromEntries(
        PRESET_OPTIONS.map((option) => [option.value, option.pickerDescription]),
      ),
    ).toEqual({
      morning: "10h–14h",
      morning_afternoon: "10h–17h/18h",
      afternoon: "14h–17h/18h",
      afternoon_evening: "14h–23h",
      evening: "17h/18h–23h",
      full: "10h–14h / 17h/18h–23h",
    });
  });

  it("offers only restaurant whole hours", () => {
    expect(HOUR_OPTIONS).toEqual([
      "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00",
      "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
    ]);
  });

  it("filters start and end choices by preset and interval", () => {
    const morning = createPresetDay("morning");
    expect(hourOptionsForInterval("morning", 0, "start", getIntervals(morning))).toEqual([
      "10:00", "11:00", "12:00", "13:00",
    ]);
    expect(hourOptionsForInterval("morning", 0, "end", getIntervals(morning))).toEqual([
      "11:00", "12:00", "13:00", "14:00",
    ]);

    const full = createPresetDay("full");
    expect(hourOptionsForInterval("full", 0, "end", getIntervals(full))).not.toContain("23:00");
    expect(hourOptionsForInterval("full", 1, "start", getIntervals(full))).not.toContain("10:00");
    expect(hourOptionsForInterval("full", 1, "end", getIntervals(full))).toContain("23:00");
  });

  it("resets stale impossible preset hours and rejects them before saving", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = {
      status: "available",
      preset: "morning",
      intervals: [{ start: "10:00", end: "23:00" }],
    };

    expect(validateAvailability(availability, "")).toContain(
      "Thứ 2: giờ đăng ký không phù hợp với ca Sáng.",
    );
    expect(normalizeAvailability(availability).days["1"]).toMatchObject({
      intervals: [{ start: "10:00", end: "14:00" }],
    });
  });

  it("reclassifies edited hours so preset and time cannot contradict", () => {
    const afternoonNight = createPresetDay("afternoon_evening");
    const night = updateAvailabilityInterval(
      afternoonNight,
      0,
      "start",
      "19:00",
    );
    expect(night).toMatchObject({
      preset: "evening",
      intervals: [{ start: "19:00", end: "23:00" }],
    });
    expect(formatAvailabilityPreset(night)).toBe("Tối");

    const morningAfternoon = createPresetDay("morning_afternoon");
    const afternoon = updateAvailabilityInterval(
      morningAfternoon,
      0,
      "start",
      "14:00",
    );
    expect(afternoon).toMatchObject({ preset: "afternoon" });
    expect(formatAvailabilityPreset(afternoon)).toBe("Trưa");
  });

  it("maps actual whole-hour intervals back to the shared preset", () => {
    expect(
      availabilityPresetForIntervals([{ start: "14:00", end: "18:00" }]),
    ).toBe("afternoon");
    expect(
      availabilityPresetForIntervals([{ start: "18:00", end: "23:00" }]),
    ).toBe("evening");
    expect(
      availabilityPresetForIntervals([
        { start: "10:00", end: "14:00" },
        { start: "18:00", end: "23:00" },
      ]),
    ).toBe("full");
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
    ).toEqual({
      status: "off",
      preset: null,
      intervals: [],
      offReason: null,
    });
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

  it("saves and restores an optional trimmed reason for an off day", () => {
    const availability = createEmptyAvailability();
    availability.days["3"] = {
      status: "off",
      preset: null,
      intervals: [],
      offReason: "  Em có lịch học  ",
    };

    const saved = prepareAvailabilityForSave(availability);
    expect(getOffReason(saved.days["3"])).toBe("Em có lịch học");
    expect(getOffReason(normalizeAvailability(saved).days["3"])).toBe(
      "Em có lịch học",
    );
    expect(formatAvailabilityDetail(saved.days["3"])).toBe(
      "Nghỉ · Em có lịch học",
    );
  });

  it("accepts an off day without a reason", () => {
    const availability = createEmptyAvailability();
    expect(validateAvailability(availability, "")).toEqual([]);
    expect(getOffReason(availability.days["1"])).toBe("");
  });

  it("clears stale off reasons from working days", () => {
    const normalized = normalizeDayAvailability({
      status: "available",
      preset: "morning",
      intervals: [{ start: "10:00", end: "14:00" }],
      offReason: "Không được lưu",
    });
    expect(normalized).toMatchObject({ status: "available", offReason: null });
    expect(formatAvailabilityCell(normalized)).toBe("10h–14h");
  });

  it("rejects an off reason longer than 120 characters", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = {
      status: "off",
      preset: null,
      intervals: [],
      offReason: "x".repeat(121),
    };
    expect(validateAvailability(availability, "")).toContain(
      "Thứ 2: lý do nghỉ không được dài quá 120 ký tự.",
    );
  });

  it("keeps older v2 days without offReason readable", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = {
      status: "off",
      preset: null,
      intervals: [],
    };
    expect(validateAvailability(availability, "")).toEqual([]);
    expect(getOffReason(availability.days["1"])).toBe("");
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
      offReason: null,
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
      intervals: [{ start: "10:00", end: "14:00" }],
    });
  });

  it("rejects notes longer than 500 characters", () => {
    expect(validateAvailability(createEmptyAvailability(), "x".repeat(501))).toContain(
      "Ghi chú không được dài quá 500 ký tự.",
    );
  });
});
