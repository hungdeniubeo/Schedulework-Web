export type Availability = {
  version: number;
  days: Record<string, Record<string, unknown>>;
};

const DAY_KEYS = ["1", "2", "3", "4", "5", "6", "7"];
const PERIODS = new Set(["morning", "afternoon", "evening"]);
const PRESET_WINDOWS = {
  morning: [["10:00", "14:00"]],
  morning_afternoon: [["10:00", "18:00"]],
  evening: [["17:00", "23:00"]],
  full: [
    ["10:00", "14:00"],
    ["17:00", "23:00"],
  ],
  afternoon_evening: [["14:00", "23:00"]],
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
    (!working || value.trim() === "")
  );
}

function validateLegacyDay(day: Record<string, unknown>): boolean {
  if (
    (day.status !== "available" && day.status !== "off") ||
    !Array.isArray(day.periods) ||
    day.periods.some((period) => typeof period !== "string" || !PERIODS.has(period)) ||
    new Set(day.periods).size !== day.periods.length
  )
    return false;

  if (day.status === "off")
    return day.periods.length === 0 && day.start === null && day.end === null;

  if (day.start === null && day.end === null) return day.periods.length > 0;
  return (
    typeof day.start === "string" &&
    typeof day.end === "string" &&
    LEGACY_TIME.test(day.start) &&
    LEGACY_TIME.test(day.end) &&
    day.start < day.end
  );
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

  if (!validOffReason(day.offReason, true)) return false;
  if (
    typeof day.preset !== "string" ||
    !(day.preset in PRESET_WINDOWS)
  )
    return false;

  const windows = PRESET_WINDOWS[day.preset as keyof typeof PRESET_WINDOWS];
  if (day.intervals.length !== windows.length) return false;

  let previousEnd: string | null = null;
  return day.intervals.every((interval, index) => {
    if (!isRecord(interval)) return false;
    const { start, end } = interval;
    if (
      typeof start !== "string" ||
      typeof end !== "string" ||
      !HOUR_TIME.test(start) ||
      !HOUR_TIME.test(end) ||
      start >= end ||
      (previousEnd !== null && previousEnd >= start)
    )
      return false;
    const [minimum, maximum] = windows[index];
    if (start < minimum || end > maximum) return false;
    previousEnd = end;
    return true;
  });
}

export function validateAvailability(value: unknown): value is Availability {
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2) ||
    !isRecord(value.days) ||
    Object.keys(value.days).length !== 7
  )
    return false;

  const days = value.days;
  const version = value.version;
  return DAY_KEYS.every((key) => {
    const day = days[key];
    return (
      isRecord(day) &&
      (version === 1 ? validateLegacyDay(day) : validateV2Day(day))
    );
  });
}
