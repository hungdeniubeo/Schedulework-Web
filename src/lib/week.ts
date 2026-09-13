import type { RegistrationWeekStatus } from "../types/domain";

export const SYSTEM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

export function isMondayDate(value: string): boolean {
  return parseDateOnly(value)?.getUTCDay() === 1;
}

export function addDateOnlyDays(value: string, amount: number): string {
  const date = parseDateOnly(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function formatDateShort(value: string): string {
  const date = parseDateOnly(value);
  if (!date) return value;
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatWeekRange(weekStart: string): string {
  return `${formatDateShort(weekStart)} - ${formatDateShort(addDateOnlyDays(weekStart, 6))}`;
}

export function formatDeadline(lockAt: string): string {
  const date = new Date(lockAt);
  if (Number.isNaN(date.getTime())) return lockAt;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: SYSTEM_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function vietnamDateTimeToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Thời hạn đăng ký không hợp lệ.");
  }
  const date = new Date(`${value}:00+07:00`);
  if (Number.isNaN(date.getTime()))
    throw new Error("Thời hạn đăng ký không hợp lệ.");
  return date.toISOString();
}

export function isoToVietnamDateTimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYSTEM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function isRegistrationLocked(
  status: RegistrationWeekStatus,
  lockAt: string,
  now = new Date(),
): boolean {
  return status !== "open" || now.getTime() >= new Date(lockAt).getTime();
}

export function remainingUntil(lockAt: string, now = new Date()): string {
  const milliseconds = new Date(lockAt).getTime() - now.getTime();
  if (milliseconds <= 0) return "0 phút";
  const minutes = Math.ceil(milliseconds / 60_000);
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const rest = minutes % 60;
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${rest} phút`;
  return `${rest} phút`;
}

export function localDateInputValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYSTEM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function defaultRegistrationWindow(now = new Date()): {
  weekStart: string;
  lockAtInput: string;
} {
  const today = parseDateOnly(localDateInputValue(now))!;
  const daysUntilMonday = (8 - today.getUTCDay()) % 7;
  today.setUTCDate(today.getUTCDate() + daysUntilMonday);
  let weekStart = today.toISOString().slice(0, 10);
  let deadlineDate = addDateOnlyDays(weekStart, -3);
  let lockAtInput = `${deadlineDate}T22:00`;
  if (new Date(vietnamDateTimeToIso(lockAtInput)).getTime() <= now.getTime()) {
    weekStart = addDateOnlyDays(weekStart, 7);
    deadlineDate = addDateOnlyDays(weekStart, -3);
    lockAtInput = `${deadlineDate}T22:00`;
  }
  return { weekStart, lockAtInput };
}
