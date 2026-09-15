import type { RegistrationWeek } from "../types/domain";

export function selectEmployeeRegistrationWeek(
  weeks: RegistrationWeek[],
  now = Date.now(),
): RegistrationWeek | null {
  return (
    weeks
      .filter(
        (week) =>
          week.status === "open" && new Date(week.lock_at).getTime() > now,
      )
      .sort((first, second) =>
        first.week_start.localeCompare(second.week_start),
      )[0] ??
    [...weeks]
      .filter((week) => week.status !== "archived")
      .sort((first, second) =>
        second.week_start.localeCompare(first.week_start),
      )[0] ??
    null
  );
}
