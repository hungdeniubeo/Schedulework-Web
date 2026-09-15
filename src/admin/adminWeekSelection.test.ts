import { describe, expect, it } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import {
  adminWeekPath,
  resolveAdminRegistrationWeek,
  weekStartFromSearch,
} from "./adminWeekSelection";

const weeks: RegistrationWeek[] = [
  {
    id: "week-open",
    week_start: "2026-09-21",
    lock_at: "2099-09-18T15:00:00.000Z",
    status: "open",
    created_at: "",
    updated_at: "",
  },
  {
    id: "week-old",
    week_start: "2026-09-14",
    lock_at: "2026-09-11T15:00:00.000Z",
    status: "locked",
    created_at: "",
    updated_at: "",
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
