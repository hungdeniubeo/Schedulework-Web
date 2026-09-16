import { describe, expect, it } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import {
  adminWeekPath,
  resolveAdminRegistrationWeek,
  weekStartFromSearch,
} from "./adminWeekSelection";

function week(
  id: string,
  weekStart: string,
  status: RegistrationWeek["status"] = "open",
): RegistrationWeek {
  return {
    id,
    week_start: weekStart,
    lock_at: "2099-09-18T15:00:00.000Z",
    status,
    created_at: "",
    updated_at: "",
  };
}

const weeks: RegistrationWeek[] = [
  week("week-open", "2026-09-21"),
  {
    ...week("week-old", "2026-09-14", "locked"),
    lock_at: "2026-09-11T15:00:00.000Z",
  },
];

describe("admin week selection", () => {
  it("reads the week query", () => {
    expect(weekStartFromSearch("?week=2026-09-21")).toBe("2026-09-21");
    expect(weekStartFromSearch("")).toBeNull();
  });

  it("uses an explicitly requested existing week", () => {
    expect(resolveAdminRegistrationWeek(weeks, "2026-09-14")).toEqual({
      week: weeks[1],
      invalidRequestedWeek: false,
    });
  });

  it("falls back only when no week was requested", () => {
    expect(resolveAdminRegistrationWeek(weeks, null).week?.id).toBe("week-open");
  });

  it("marks an unknown requested week invalid", () => {
    expect(resolveAdminRegistrationWeek(weeks, "2026-10-05")).toEqual({
      week: null,
      invalidRequestedWeek: true,
    });
  });

  it("does not treat an archived week as an active requested admin week", () => {
    const archived = week("archived", "2026-09-28", "archived");
    expect(
      resolveAdminRegistrationWeek([archived], archived.week_start),
    ).toEqual({
      week: null,
      invalidRequestedWeek: true,
    });
  });

  it("handles an empty week list", () => {
    expect(resolveAdminRegistrationWeek([], null)).toEqual({
      week: null,
      invalidRequestedWeek: false,
    });
  });

  it("builds a week-preserving path", () => {
    expect(adminWeekPath("/admin/schedule", "2026-09-21")).toBe(
      "/admin/schedule?week=2026-09-21",
    );
  });
});
