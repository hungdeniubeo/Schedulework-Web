import type { ScheduleWeek } from "./types";

export function selectLatestPublishedWeek(
  weeks: ScheduleWeek[],
): ScheduleWeek | null {
  return (
    [...weeks]
      .filter((week) => week.status === "published")
      .sort((first, second) =>
        second.weekStart.localeCompare(first.weekStart),
      )[0] ?? null
  );
}
