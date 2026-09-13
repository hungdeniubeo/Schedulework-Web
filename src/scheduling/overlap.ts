import type { ScheduleEntry, ShiftType } from "./types";

export type TimeRange = { start: number; end: number };
export type EntryIssue =
  | { kind: "invalid"; message: string }
  | { kind: "overlap"; other: ScheduleEntry; range: TimeRange };

function parseClock(token: string): number | null {
  const normalized = token
    .trim()
    .toLowerCase()
    .replace(/h$/, ":00")
    .replace("h", ":");
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

function parseRangeToken(token: string): TimeRange | null {
  const parts = token.split("-");
  if (parts.length !== 2) return null;
  const start = parseClock(parts[0]);
  const end = parseClock(parts[1]);
  return start !== null && end !== null && end > start ? { start, end } : null;
}

export function rangesForEntry(
  entry: ScheduleEntry,
  shiftType: ShiftType | undefined,
): TimeRange[] {
  let label = entry.customLabel || shiftType?.label;
  if (
    !entry.customLabel &&
    (entry.customStart !== null || entry.customEnd !== null)
  ) {
    if (!entry.customStart || !entry.customEnd) return [];
    label = `${entry.customStart}-${entry.customEnd}`;
  }
  if (!label) return [];
  const ranges = label.split("/").map(parseRangeToken);
  return ranges.every((range): range is TimeRange => range !== null)
    ? ranges
    : [];
}

function intersection(first: TimeRange, second: TimeRange): TimeRange | null {
  const start = Math.max(first.start, second.start);
  const end = Math.min(first.end, second.end);
  return start < end ? { start, end } : null;
}

export function getEntryIssue(
  candidate: ScheduleEntry,
  entries: ScheduleEntry[],
  types: ShiftType[],
): EntryIssue | null {
  const type = types.find((item) => item.id === candidate.shiftTypeId);
  if (!type)
    return { kind: "invalid", message: "Loại ca này không còn tồn tại." };
  const ranges = rangesForEntry(candidate, type);
  if (!ranges.length)
    return {
      kind: "invalid",
      message: "Giờ ca không hợp lệ. Giờ kết thúc phải sau giờ bắt đầu.",
    };
  for (let index = 0; index < ranges.length; index += 1) {
    for (
      let otherIndex = index + 1;
      otherIndex < ranges.length;
      otherIndex += 1
    ) {
      if (intersection(ranges[index], ranges[otherIndex])) {
        return {
          kind: "invalid",
          message: "Hai khoảng giờ trong ca bị trùng nhau.",
        };
      }
    }
  }
  for (const other of entries) {
    if (
      other.id === candidate.id ||
      other.employeeId !== candidate.employeeId ||
      other.dayOfWeek !== candidate.dayOfWeek
    )
      continue;
    const otherRanges = rangesForEntry(
      other,
      types.find((item) => item.id === other.shiftTypeId),
    );
    if (!otherRanges.length)
      return {
        kind: "invalid",
        message: "Ô này có ca chưa rõ giờ. Hãy sửa hoặc xóa ca đó trước.",
      };
    for (const range of ranges) {
      for (const otherRange of otherRanges) {
        const overlap = intersection(range, otherRange);
        if (overlap) return { kind: "overlap", other, range: overlap };
      }
    }
  }
  return null;
}

export function findScheduleIssues(
  entries: ScheduleEntry[],
  types: ShiftType[],
): Array<{ entry: ScheduleEntry; issue: EntryIssue }> {
  return entries.flatMap((entry) => {
    const issue = getEntryIssue(entry, entries, types);
    return issue ? [{ entry, issue }] : [];
  });
}

export function entryLabel(entry: ScheduleEntry, types: ShiftType[]): string {
  if (entry.customLabel) return entry.customLabel;
  if (entry.customStart && entry.customEnd)
    return `${entry.customStart}-${entry.customEnd}`;
  return (
    types.find((type) => type.id === entry.shiftTypeId)?.label ??
    "Ca không xác định"
  );
}
