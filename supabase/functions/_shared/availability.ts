export type Availability = {
  version: number;
  days: Record<string, Record<string, unknown>>;
};

const DAY_KEYS = ["1", "2", "3", "4", "5", "6", "7"];
const PERIODS = new Set(["morning", "afternoon", "evening"]);
const PRESETS = new Set([
  "morning",
  "morning_afternoon",
  "evening",
  "full",
  "afternoon_evening",
]);
const LEGACY_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const HOUR_TIME = /^(?:[01]\d|2[0-3]):00$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateLegacyDay(day: Record<string, unknown>): boolean {
  if (!Array.isArray(day.periods)) return false;
  if (
    new Set(day.periods).size !== day.periods.length ||
    !day.periods.every(
      (period) => typeof period === "string" && PERIODS.has(period),
    )
  ) return false;
  if (day.status === "off")
    return day.periods.length === 0 && day.start === null && day.end === null;
  if (day.status !== "available") return false;
  const bothNull = day.start === null && day.end === null;
  if (bothNull) return day.periods.length > 0;
  return (
    typeof day.start === "string" &&
    typeof day.end === "string" &&
    LEGACY_TIME.test(day.start) &&
    LEGACY_TIME.test(day.end) &&
    day.start < day.end
  );
}

function validateV2Day(day: Record<string, unknown>): boolean {
  if (!Array.isArray(day.intervals)) return false;
  if (day.status === "off")
    return day.preset === null && day.intervals.length === 0;
  if (
    day.status !== "available" ||
    typeof day.preset !== "string" ||
    !PRESETS.has(day.preset) ||
    day.intervals.length !== (day.preset === "full" ? 2 : 1)
  ) return false;
  let previousEnd: string | null = null;
  for (const candidate of day.intervals) {
    if (!isRecord(candidate)) return false;
    const { start, end } = candidate;
    if (
      typeof start !== "string" ||
      typeof end !== "string" ||
      !HOUR_TIME.test(start) ||
      !HOUR_TIME.test(end) ||
      start >= end ||
      (previousEnd !== null && previousEnd >= start)
    ) return false;
    previousEnd = end;
  }
  return true;
}

export function validateAvailability(value: unknown): value is Availability {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2))
    return false;
  const days = value.days;
  if (!isRecord(days)) return false;
  if (
    Object.keys(days).length !== 7 ||
    !DAY_KEYS.every((key) => key in days)
  ) return false;
  return DAY_KEYS.every((key) => {
    const day = days[key];
    if (!isRecord(day)) return false;
    return value.version === 1 ? validateLegacyDay(day) : validateV2Day(day);
  });
}
