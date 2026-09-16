import { selectEmployeeRegistrationWeek } from "../employee/registrationWeekSelection";
import type { RegistrationWeek } from "../types/domain";

export function weekStartFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("week")?.trim();
  return value || null;
}

export function resolveAdminRegistrationWeek(
  weeks: RegistrationWeek[],
  requestedWeekStart: string | null,
): { week: RegistrationWeek | null; invalidRequestedWeek: boolean } {
  if (requestedWeekStart) {
    const week =
      weeks.find(
        (item) =>
          item.week_start === requestedWeekStart && item.status !== "archived",
      ) ?? null;
    return { week, invalidRequestedWeek: week === null };
  }
  return {
    week: selectEmployeeRegistrationWeek(weeks),
    invalidRequestedWeek: false,
  };
}

export function adminWeekPath(path: string, weekStart: string): string {
  return `${path}?week=${encodeURIComponent(weekStart)}`;
}
