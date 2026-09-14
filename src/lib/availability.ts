import {
  AVAILABILITY_PRESETS,
  DAY_KEYS,
  PERIODS,
  type Availability,
  type AvailabilityInterval,
  type AvailabilityPreset,
  type AvailabilitySubmission,
  type DayAvailability,
  type DayKey,
  type LegacyDayAvailability,
  type Period,
} from "../types/domain";

export const DAY_LABELS: Record<DayKey, string> = {
  "1": "Thứ 2",
  "2": "Thứ 3",
  "3": "Thứ 4",
  "4": "Thứ 5",
  "5": "Thứ 6",
  "6": "Thứ 7",
  "7": "Chủ nhật",
};

export const PERIOD_LABELS: Record<Period, string> = {
  morning: "Sáng",
  afternoon: "Trưa",
  evening: "Tối",
};

export const PRESET_OPTIONS: ReadonlyArray<{
  value: AvailabilityPreset;
  label: string;
  pickerDescription: string;
  intervals: AvailabilityInterval[];
  windows: AvailabilityInterval[];
}> = [
  {
    value: "morning",
    label: "Sáng",
    pickerDescription: "10h–14h",
    intervals: [{ start: "10:00", end: "14:00" }],
    windows: [{ start: "10:00", end: "14:00" }],
  },
  {
    value: "morning_afternoon",
    label: "Sáng + Trưa",
    pickerDescription: "10h–17h/18h",
    intervals: [{ start: "10:00", end: "17:00" }],
    windows: [{ start: "10:00", end: "18:00" }],
  },
  {
    value: "evening",
    label: "Tối",
    pickerDescription: "17h/18h–23h",
    intervals: [{ start: "17:00", end: "23:00" }],
    windows: [{ start: "17:00", end: "23:00" }],
  },
  {
    value: "full",
    label: "Full",
    pickerDescription: "10h–14h / 17h/18h–23h",
    intervals: [
      { start: "10:00", end: "14:00" },
      { start: "17:00", end: "23:00" },
    ],
    windows: [
      { start: "10:00", end: "14:00" },
      { start: "17:00", end: "23:00" },
    ],
  },
  {
    value: "afternoon_evening",
    label: "Trưa + Tối",
    pickerDescription: "14h–23h",
    intervals: [{ start: "14:00", end: "23:00" }],
    windows: [{ start: "14:00", end: "23:00" }],
  },
];

export const HOUR_OPTIONS = Array.from({ length: 14 }, (_, index) =>
  `${String(index + 10).padStart(2, "0")}:00`,
);

const LEGACY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const HOUR_TIME_PATTERN = /^(?:[01]\d|2[0-3]):00$/;

function cloneIntervals(intervals: AvailabilityInterval[]) {
  return intervals.map((interval) => ({ ...interval }));
}

function legacyInterval(start: string, end: string): AvailabilityInterval {
  let startHour = Number(start.slice(0, 2));
  let endHour = Number(end.slice(0, 2));
  if (end.slice(3, 5) !== "00" && endHour < 23) endHour += 1;
  if (startHour >= endHour) {
    if (endHour < 23) endHour += 1;
    else startHour = Math.max(0, endHour - 1);
  }
  return {
    start: `${String(startHour).padStart(2, "0")}:00`,
    end: `${String(endHour).padStart(2, "0")}:00`,
  };
}

export function createPresetDay(preset: AvailabilityPreset): DayAvailability {
  const option = PRESET_OPTIONS.find((item) => item.value === preset)!;
  return {
    status: "available",
    preset,
    intervals: cloneIntervals(option.intervals),
    offReason: null,
  };
}

export function createEmptyAvailability(): Availability {
  return {
    version: 2,
    days: Object.fromEntries(
      DAY_KEYS.map((day) => [
        day,
        { status: "off", preset: null, intervals: [], offReason: null },
      ]),
    ),
  };
}

export function normalizeOffDay(day: DayAvailability): DayAvailability {
  return day.status === "off"
    ? {
        status: "off",
        preset: null,
        intervals: [],
        offReason: "offReason" in day ? day.offReason ?? null : null,
      }
    : day;
}

function presetOption(preset: AvailabilityPreset) {
  return PRESET_OPTIONS.find((option) => option.value === preset)!;
}

function intervalsFitPreset(
  preset: AvailabilityPreset,
  intervals: AvailabilityInterval[],
): boolean {
  const windows = presetOption(preset).windows;
  return (
    intervals.length === windows.length &&
    intervals.every(
      (interval, index) =>
        HOUR_TIME_PATTERN.test(interval.start) &&
        HOUR_TIME_PATTERN.test(interval.end) &&
        interval.start >= windows[index].start &&
        interval.end <= windows[index].end &&
        interval.start < interval.end,
    )
  );
}

export function hourOptionsForInterval(
  preset: AvailabilityPreset,
  intervalIndex: number,
  edge: "start" | "end",
  intervals: AvailabilityInterval[],
): string[] {
  const window = presetOption(preset).windows[intervalIndex];
  const interval = intervals[intervalIndex];
  if (!window || !interval) return [];
  return HOUR_OPTIONS.filter((hour) =>
    edge === "start"
      ? hour >= window.start && hour < interval.end
      : hour > interval.start && hour <= window.end,
  );
}

function isLegacyDay(day: DayAvailability): day is LegacyDayAvailability {
  return "periods" in day;
}

function presetFromLegacy(day: LegacyDayAvailability): AvailabilityPreset | null {
  const periods = day.periods.join(",");
  if (periods === "morning") return "morning";
  if (periods === "morning,afternoon") return "morning_afternoon";
  if (periods === "evening") return "evening";
  if (periods === "morning,afternoon,evening") return "full";
  if (periods === "afternoon,evening") return "afternoon_evening";
  return null;
}

export function normalizeDayAvailability(day: DayAvailability): DayAvailability {
  if (day.status === "off") {
    return normalizeOffDay(day);
  }
  if (!isLegacyDay(day)) {
    const preset = day.preset ?? "morning";
    const intervals = intervalsFitPreset(preset, day.intervals)
      ? day.intervals
      : presetOption(preset).intervals;
    return {
      status: "available",
      preset,
      intervals: cloneIntervals(intervals),
      offReason: null,
    };
  }
  let preset = presetFromLegacy(day);
  if (!preset)
    preset = day.start && day.start >= "14:00"
      ? "afternoon_evening"
      : "morning_afternoon";
  if (day.start && day.end) {
    if (preset === "full") preset = "morning_afternoon";
    const normalized = {
      status: "available",
      preset,
      intervals: [legacyInterval(day.start, day.end)],
      offReason: null,
    } satisfies DayAvailability;
    return intervalsFitPreset(preset, normalized.intervals)
      ? normalized
      : createPresetDay(preset);
  }
  return createPresetDay(preset);
}

export function normalizeAvailability(availability: Availability): Availability {
  return {
    version: 2,
    days: Object.fromEntries(
      DAY_KEYS.map((key) => [key, normalizeDayAvailability(availability.days[key])]),
    ),
  };
}

export function availabilityByEmployee(
  submissions: AvailabilitySubmission[],
): Record<string, Availability> {
  return Object.fromEntries(
    submissions.map((submission) => [
      submission.employee_id,
      submission.availability,
    ]),
  );
}

export function getPreset(day: DayAvailability): AvailabilityPreset | null {
  if (day.status === "off") return null;
  return isLegacyDay(day) ? presetFromLegacy(day) : day.preset;
}

export function getIntervals(day: DayAvailability): AvailabilityInterval[] {
  if (day.status === "off") return [];
  if (!isLegacyDay(day)) return day.intervals;
  if (day.start && day.end) return [{ start: day.start, end: day.end }];
  const preset = presetFromLegacy(day);
  return preset
    ? (createPresetDay(preset) as Exclude<DayAvailability, LegacyDayAvailability>).intervals
    : [];
}

export function getOffReason(day: DayAvailability): string {
  return day.status === "off" && !isLegacyDay(day)
    ? (day.offReason ?? "").trim()
    : "";
}

export function prepareAvailabilityForSave(
  availability: Availability,
): Availability {
  const normalized = normalizeAvailability(availability);
  return {
    version: 2,
    days: Object.fromEntries(
      DAY_KEYS.map((key) => {
        const day = normalized.days[key];
        return [
          key,
          day.status === "off" && !isLegacyDay(day)
            ? { ...day, offReason: getOffReason(day) || null }
            : day,
        ];
      }),
    ),
  };
}

export function isFullAvailabilityDay(day: DayAvailability): boolean {
  return getPreset(day) === "full";
}

export function validateAvailability(
  availability: Availability,
  note: string,
): string[] {
  const errors: string[] = [];
  if (
    ![1, 2].includes(availability.version) ||
    Object.keys(availability.days).length !== 7 ||
    !DAY_KEYS.every((key) => availability.days[key] != null)
  ) {
    errors.push("Lịch đăng ký phải có đủ 7 ngày.");
    return errors;
  }

  for (const key of DAY_KEYS) {
    const day = availability.days[key];
    const label = DAY_LABELS[key];
    if (day.status !== "available" && day.status !== "off") {
      errors.push(`${label}: trạng thái không hợp lệ.`);
      continue;
    }
    if (
      (availability.version === 1 && !isLegacyDay(day)) ||
      (availability.version === 2 && isLegacyDay(day))
    ) {
      errors.push(`${label}: dữ liệu ca không đúng phiên bản.`);
      continue;
    }
    if (isLegacyDay(day)) {
      if (
        day.periods.some((period) => !PERIODS.includes(period)) ||
        new Set(day.periods).size !== day.periods.length
      ) errors.push(`${label}: ca đăng ký không hợp lệ.`);
      if (day.status === "off") {
        if (day.periods.length > 0 || day.start !== null || day.end !== null)
          errors.push(`${label}: ngày nghỉ không được có ca hoặc giờ cụ thể.`);
        continue;
      }
      const bothNull = day.start === null && day.end === null;
      if (!bothNull && (day.start === null || day.end === null))
        errors.push(`${label}: vui lòng nhập đủ giờ bắt đầu và kết thúc.`);
      else if (
        !bothNull &&
        (!LEGACY_TIME_PATTERN.test(day.start!) || !LEGACY_TIME_PATTERN.test(day.end!))
      ) errors.push(`${label}: giờ cụ thể không hợp lệ.`);
      else if (!bothNull && day.start! >= day.end!)
        errors.push(`${label}: giờ bắt đầu phải trước giờ kết thúc.`);
      if (day.periods.length === 0 && bothNull)
        errors.push(`${label}: hãy chọn ít nhất một ca hoặc nhập giờ cụ thể.`);
      continue;
    }
    if (day.status === "off") {
      if (day.preset !== null || day.intervals.length > 0)
        errors.push(`${label}: ngày nghỉ không được có ca hoặc giờ cụ thể.`);
      if (
        day.offReason !== undefined &&
        day.offReason !== null &&
        typeof day.offReason !== "string"
      )
        errors.push(`${label}: lý do nghỉ không hợp lệ.`);
      else if ((day.offReason ?? "").trim().length > 120)
        errors.push(`${label}: lý do nghỉ không được dài quá 120 ký tự.`);
      continue;
    }
    if (!day.preset || !AVAILABILITY_PRESETS.includes(day.preset)) {
      errors.push(`${label}: ca đăng ký không hợp lệ.`);
      continue;
    }
    if ((day.offReason ?? "").trim())
      errors.push(`${label}: ngày đi làm không được có lý do nghỉ.`);
    const expectedLength = day.preset === "full" ? 2 : 1;
    if (day.intervals.length !== expectedLength) {
      errors.push(`${label}: ca đăng ký phải có đủ khoảng giờ.`);
      continue;
    }
    if (day.intervals.some(({ start, end }) => !HOUR_TIME_PATTERN.test(start) || !HOUR_TIME_PATTERN.test(end)))
      errors.push(`${label}: giờ đăng ký phải là giờ tròn.`);
    else if (day.intervals.some(({ start, end }) => start >= end))
      errors.push(`${label}: giờ bắt đầu phải trước giờ kết thúc.`);
    else if (day.intervals.some((interval, index) => index > 0 && day.intervals[index - 1].end >= interval.start))
      errors.push(`${label}: các khoảng giờ không được chồng lấn.`);
    else if (!intervalsFitPreset(day.preset, day.intervals))
      errors.push(`${label}: giờ đăng ký không phù hợp với ca ${presetOption(day.preset).label}.`);
  }
  if (note.length > 500) errors.push("Ghi chú không được dài quá 500 ký tự.");
  return errors;
}

export function formatAvailabilityCell(day: DayAvailability): string {
  if (day.status === "off") return "Nghỉ";
  const intervals = getIntervals(day);
  if (!intervals.length && isLegacyDay(day))
    return day.periods.map((period) => PERIOD_LABELS[period]).join(" + ") || "—";
  return intervals.length ? formatAvailabilityIntervals(day) : "—";
}

export function formatAvailabilityDetail(day: DayAvailability): string {
  const value = formatAvailabilityCell(day);
  const reason = getOffReason(day);
  return reason ? `${value} · ${reason}` : value;
}

export function formatHour(value: string): string {
  return value.endsWith(":00") ? `${Number(value.slice(0, 2))}h` : value;
}

export function formatAvailabilityIntervals(day: DayAvailability): string {
  return getIntervals(day)
    .map(({ start, end }) => `${formatHour(start)}–${formatHour(end)}`)
    .join(" / ");
}

export function formatAvailabilityPreset(day: DayAvailability): string {
  const preset = getPreset(day);
  return PRESET_OPTIONS.find((item) => item.value === preset)?.label ?? "";
}
