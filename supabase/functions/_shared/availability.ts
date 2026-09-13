export type Availability = {
  version: number;
  days: Record<
    string,
    {
      status: string;
      periods: unknown[];
      start: unknown;
      end: unknown;
    }
  >;
};

const DAY_KEYS = ["1", "2", "3", "4", "5", "6", "7"];
const PERIODS = new Set(["morning", "afternoon", "evening"]);
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validateAvailability(value: unknown): value is Availability {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Availability>;
  if (
    candidate.version !== 1 ||
    !candidate.days ||
    typeof candidate.days !== "object"
  )
    return false;
  if (
    Object.keys(candidate.days).length !== 7 ||
    !DAY_KEYS.every((key) => key in candidate.days!)
  )
    return false;
  return DAY_KEYS.every((key) => {
    const day = candidate.days![key];
    if (!day || typeof day !== "object" || !Array.isArray(day.periods))
      return false;
    if (
      new Set(day.periods).size !== day.periods.length ||
      !day.periods.every(
        (period) => typeof period === "string" && PERIODS.has(period),
      )
    )
      return false;
    if (day.status === "off")
      return day.periods.length === 0 && day.start === null && day.end === null;
    if (day.status !== "available") return false;
    const bothNull = day.start === null && day.end === null;
    if (bothNull) return day.periods.length > 0;
    return (
      typeof day.start === "string" &&
      typeof day.end === "string" &&
      TIME.test(day.start) &&
      TIME.test(day.end) &&
      day.start < day.end
    );
  });
}
