import { describe, expect, it } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import { selectEmployeeRegistrationWeek } from "./registrationWeekSelection";

function week(
  id: string,
  weekStart: string,
  status: RegistrationWeek["status"] = "open",
): RegistrationWeek {
  return {
    id,
    week_start: weekStart,
    lock_at: `${weekStart}T15:00:00.000Z`,
    status,
    created_at: "",
    updated_at: "",
  };
}

describe("registration-week synchronization for employee pages", () => {
  const now = new Date("2026-09-01T00:00:00.000Z").getTime();

  it("selects the nearest open week from weeks created by Admin", () => {
    const result = selectEmployeeRegistrationWeek(
      [
        week("week-3", "2026-09-14"),
        week("week-2", "2026-09-07"),
      ],
      now,
    );

    expect(result?.id).toBe("week-2");
  });

  it("falls through to the next created week after the current week is deleted", () => {
    const beforeDelete = [
      week("week-current", "2026-09-07"),
      week("week-next", "2026-09-14"),
    ];

    expect(selectEmployeeRegistrationWeek(beforeDelete, now)?.id).toBe(
      "week-current",
    );
    expect(
      selectEmployeeRegistrationWeek(
        beforeDelete.filter((item) => item.id !== "week-current"),
        now,
      )?.id,
    ).toBe("week-next");
  });

  it("never exposes an archived week as the active registration choice", () => {
    expect(
      selectEmployeeRegistrationWeek(
        [week("week-archived", "2026-09-07", "archived")],
        now,
      ),
    ).toBeNull();
  });
});
