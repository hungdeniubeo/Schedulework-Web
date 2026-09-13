import {
  DAY_KEYS,
  PERIODS,
  type Availability,
  type DayAvailability,
  type DayKey,
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

const PERIOD_SHORT: Record<Period, string> = {
  morning: "S",
  afternoon: "Tr",
  evening: "T",
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function createEmptyAvailability(): Availability {
  return {
    version: 1,
    days: Object.fromEntries(
      DAY_KEYS.map((day) => [
        day,
        { status: "off", periods: [], start: null, end: null },
      ]),
    ),
  };
}

export function normalizeOffDay(day: DayAvailability): DayAvailability {
  return day.status === "off"
    ? { status: "off", periods: [], start: null, end: null }
    : day;
}

function isValidTime(value: string | null): boolean {
  return value === null || TIME_PATTERN.test(value);
}

export function validateAvailability(
  availability: Availability,
  note: string,
): string[] {
  const errors: string[] = [];
  if (
    availability.version !== 1 ||
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
      day.periods.some((period) => !PERIODS.includes(period)) ||
      new Set(day.periods).size !== day.periods.length
    ) {
      errors.push(`${label}: ca đăng ký không hợp lệ.`);
    }
    if (day.status === "off") {
      if (day.periods.length > 0 || day.start !== null || day.end !== null) {
        errors.push(`${label}: ngày nghỉ không được có ca hoặc giờ cụ thể.`);
      }
      continue;
    }
    if (!isValidTime(day.start) || !isValidTime(day.end)) {
      errors.push(`${label}: giờ cụ thể không hợp lệ.`);
    } else if ((day.start === null) !== (day.end === null)) {
      errors.push(`${label}: vui lòng nhập đủ giờ bắt đầu và kết thúc.`);
    } else if (day.start !== null && day.end !== null && day.start >= day.end) {
      errors.push(`${label}: giờ bắt đầu phải trước giờ kết thúc.`);
    }
    if (day.periods.length === 0 && day.start === null && day.end === null) {
      errors.push(`${label}: hãy chọn ít nhất một ca hoặc nhập giờ cụ thể.`);
    }
  }
  if (note.length > 500) errors.push("Ghi chú không được dài quá 500 ký tự.");
  return errors;
}

export function formatAvailabilityCell(day: DayAvailability): string {
  if (day.status === "off") return "Nghỉ";
  if (day.start && day.end) return `${day.start}–${day.end}`;
  if (day.periods.length === 3) return "Cả ngày";
  return day.periods.map((period) => PERIOD_SHORT[period]).join(", ") || "—";
}
