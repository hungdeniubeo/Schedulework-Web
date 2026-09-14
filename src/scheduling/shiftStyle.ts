import type { CSSProperties } from "react";

export const SEMANTIC_SHIFT_COLORS = {
  morning: "#70AD47",
  morningAfternoon: "#A6A6A6",
  afternoonNight: "#C55A5A",
  night: "#ED7D31",
  full: "#5B9BD5",
  long: "#8064A2",
} as const;

export type ShiftRange = { start: number; end: number };
export type ShiftSemantic = keyof typeof SEMANTIC_SHIFT_COLORS;
export type ShiftCategory =
  | "morning"
  | "morningAfternoon"
  | "afternoon"
  | "afternoonNight"
  | "night"
  | "full"
  | "long";

export const SHIFT_CATEGORY_LABELS: Record<ShiftCategory, string> = {
  morning: "Sáng",
  morningAfternoon: "Sáng + Trưa",
  afternoon: "Trưa",
  afternoonNight: "Trưa + Tối",
  night: "Tối",
  full: "Full",
  long: "Ca dài",
};

const CATEGORY_SEMANTICS: Record<ShiftCategory, ShiftSemantic> = {
  morning: "morning",
  morningAfternoon: "morningAfternoon",
  afternoon: "morningAfternoon",
  afternoonNight: "afternoonNight",
  night: "night",
  full: "full",
  long: "long",
};

export function clockToMinutes(value: string): number | null {
  const match = /^(\d{1,2})(?:h(\d{2})?|:(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? match[3] ?? "0");
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

export function shiftRangesFromLabel(label: string): ShiftRange[] {
  const ranges = label.split("/").map((part) => {
    const [startText, endText, extra] = part.split(/[-–—]/);
    if (extra !== undefined) return null;
    const start = clockToMinutes(startText ?? "");
    const end = clockToMinutes(endText ?? "");
    return start !== null && end !== null && end > start
      ? { start, end }
      : null;
  });
  return ranges.every((range): range is ShiftRange => range !== null)
    ? ranges
    : [];
}

export function classifyShiftRanges(
  sourceRanges: readonly ShiftRange[],
): ShiftCategory | null {
  const ranges = [...sourceRanges].sort(
    (first, second) => first.start - second.start || first.end - second.end,
  );
  if (
    ranges.length === 0 ||
    ranges.some(
      (range, index) =>
        range.end <= range.start ||
        (index > 0 && ranges[index - 1].end > range.start),
    )
  )
    return null;

  if (ranges.length === 1) {
    const [{ start, end }] = ranges;
    if (start === 600 && end === 1380) return "long";
    if (start >= 1020 && end <= 1380) return "night";
    if (start >= 840 && start < 1020 && end <= 1080) return "afternoon";
    if (start >= 840 && start < 1020 && end > 1080 && end <= 1380)
      return "afternoonNight";
    if (start < 840 && end <= 840) return "morning";
    if (start < 840 && end > 840 && end <= 1080)
      return "morningAfternoon";
  }

  const covers = (start: number, end: number) =>
    ranges.some((range) => range.start < end && range.end > start);
  const morning = covers(600, 840);
  const afternoon = covers(840, 1020);
  const night = covers(1020, 1380);
  if (morning && night) return "full";
  if (afternoon && night) return "afternoonNight";
  if (morning && afternoon) return "morningAfternoon";
  if (night) return "night";
  if (afternoon) return "afternoon";
  if (morning) return "morning";
  return null;
}

export function classifyShiftLabel(label: string): ShiftCategory | null {
  return classifyShiftRanges(shiftRangesFromLabel(label));
}

export function semanticShiftKind(label: string): ShiftSemantic | null {
  const category = classifyShiftLabel(label);
  return category ? CATEGORY_SEMANTICS[category] : null;
}

export function semanticShiftColor(label: string): string {
  const semantic = semanticShiftKind(label);
  return SEMANTIC_SHIFT_COLORS[semantic ?? "morning"];
}

export function resolvedShiftColor(
  label: string,
  persistedColor: string,
  deriveFromCoverage = false,
): string {
  const semantic = deriveFromCoverage ? semanticShiftKind(label) : null;
  return semantic ? SEMANTIC_SHIFT_COLORS[semantic] : persistedColor;
}

function clockLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function consolidatedShiftLabel(ranges: ShiftRange[]): string {
  const consolidated: ShiftRange[] = [];
  for (const range of [...ranges].sort(
    (first, second) => first.start - second.start || first.end - second.end,
  )) {
    const previous = consolidated[consolidated.length - 1];
    if (previous && range.start === previous.end) previous.end = range.end;
    else consolidated.push({ ...range });
  }
  return consolidated
    .map((range) => `${clockLabel(range.start)}-${clockLabel(range.end)}`)
    .join("/");
}

export function formatShiftLabel(label: string): string {
  return label
    .split("/")
    .map((range) =>
      range
        .split("-")
        .map((clock) => {
          const value = clock.trim();
          const match = /^(\d{1,2})(?:h(\d{2})?|:(\d{2}))?$/.exec(value);
          if (!match) return value;
          const minutes = match[2] ?? match[3] ?? "00";
          if (Number(match[1]) > 23 || Number(minutes) > 59) return value;
          return `${match[1].padStart(2, "0")}:${minutes}`;
        })
        .join(" – "),
    )
    .join(" / ");
}

export function shiftStyle(color: string): CSSProperties {
  const value = /^#[\da-f]{6}$/i.test(color) ? color.slice(1) : "C5D9C7";
  const rgb = [0, 2, 4].map((index) =>
    Number.parseInt(value.slice(index, index + 2), 16),
  );
  const mix = (target: number, weight: number) =>
    `rgb(${rgb.map((channel) => Math.round(channel * (1 - weight) + target * weight)).join(", ")})`;
  return {
    "--shift-bg": mix(255, 0.58),
    "--shift-border": mix(255, 0.18),
    "--shift-ink": mix(0, 0.62),
    "--shift-dot": mix(0, 0.24),
  } as CSSProperties;
}
