export type Availability = {
  version: number;
  days: Record<string, Record<string, unknown>>;
};

const DAY_KEYS = ["1", "2", "3", "4", "5", "6", "7"];
const PERIODS = new Set(["morning", "afternoon", "evening"]);
const PRESET_WINDOWS = {
  morning: [["10:00", "14:00"]],
  morning_afternoon: [["10:00", "18:00"]],
  afternoon: [["14:00", "18:00"]],
  afternoon_evening: [["14:00", "23:00"]],
  evening: [["17:00", "23:00"]],
  full: [
    ["10:00", "14:00"],
    ["17:00", "23:00"],
  ],
} as const;
const LEGACY_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const HOUR_TIME = /^(?:1\d|2[0-3]):00$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validOffReason(value: unknown, working: boolean): boolean {
  if (value === undefined || value === null) return true;
  return (
    typeof value === "string" &&
    value.trim().length <= 120 &&
    (!working || value.trim().length === 0)
  );
}

function validateLegacyDay(day: Record<string, unknown>): boolean {
  if (
    (day.status !== "available" && day.status !== "off") ||
    !Array.isArray(day.periods) ||
    day.periods.some(
      (period) => typeof period !== "string" || !PERIODS.has(period),
    ) ||
    new Set(day.periods).size !== day.periods.length
  )
    return false;
  if (day.status === "off")
    return day.periods.length === 0 && day.start === null && day.end === null;
  const noTimes = day.start === null && day.end === null;
  if (noTimes) return day.periods.length > 0;
  return (
    typeof day.start === "string" &&
    typeof day.end === "string" &&
    LEGACY_TIME.test(day.start) &&
    LEGACY_TIME.test(day.end) &&
    day.start < day.end
  );
}

type Interval = { start: string; end: string };

function categoryPreset(intervals: Interval[]): keyof typeof PRESET_WINDOWS | null {
  if (intervals.length === 2) {
    const [first, second] = intervals;
    return first.start >= "10:00" &&
      first.end <= "14:00" &&
      second.start >= "17:00" &&
      second.end <= "23:00"
      ? "full"
      : null;
  }
  if (intervals.length !== 1) return null;
  const [{ start, end }] = intervals;
  if (start >= "17:00" && end <= "23:00") return "evening";
  if (start >= "14:00" && start < "17:00" && end <= "18:00")
    return "afternoon";
  if (start >= "14:00" && start < "17:00" && end > "18:00")
    return "afternoon_evening";
  if (start < "14:00" && end <= "14:00") return "morning";
  if (start < "14:00" && end > "14:00" && end <= "18:00")
    return "morning_afternoon";
  return null;
}

function validateV2Day(day: Record<string, unknown>): boolean {
  if (
    (day.status !== "available" && day.status !== "off") ||
    !Array.isArray(day.intervals)
  )
    return false;
  if (day.status === "off")
    return (
      day.preset === null &&
      day.intervals.length === 0 &&
      validOffReason(day.offReason, false)
    );
  if (
    typeof day.preset !== "string" ||
    !(day.preset in PRESET_WINDOWS) ||
    !validOffReason(day.offReason, true)
  )
    return false;
  const preset = day.preset as keyof typeof PRESET_WINDOWS;
  const windows = PRESET_WINDOWS[preset];
  if (day.intervals.length !== windows.length) return false;

  let previousEnd: string | null = null;
  const intervals: Interval[] = [];
  for (let index = 0; index < day.intervals.length; index += 1) {
    const interval = day.intervals[index];
    if (!isRecord(interval)) return false;
    const { start, end } = interval;
    const window = windows[index];
    if (
      typeof start !== "string" ||
      typeof end !== "string" ||
      !HOUR_TIME.test(start) ||
      !HOUR_TIME.test(end) ||
      start < window[0] ||
      end > window[1] ||
      start >= end ||
      (previousEnd !== null && previousEnd >= start)
    )
      return false;
    intervals.push({ start, end });
    previousEnd = end;
  }
  return categoryPreset(intervals) === preset;
}

export function validateAvailability(value: unknown): value is Availability {
  if (!isRecord(value)) return false;
  const { version, days } = value;
  if (
    (version !== 1 && version !== 2) ||
    !isRecord(days) ||
    Object.keys(days).length !== 7
  ) return false;
  return DAY_KEYS.every((key) => {
    const day = days[key];
    return (
      isRecord(day) &&
      (version === 1 ? validateLegacyDay(day) : validateV2Day(day))
    );
  });
}
