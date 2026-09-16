import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import type { EmployeePortalData } from "../types/domain";
import {
  canRefreshEmployeePortal,
  reconcileEmployeePortalRefresh,
} from "./employeePortalRefresh";

const portal = (weekId: string, locked = false): EmployeePortalData => ({
  employee: { id: "employee-1", name: "Hùng" },
  week: {
    id: weekId,
    weekStart: weekId === "week-1" ? "2026-09-21" : "2026-09-28",
    lockAt: "2099-09-18T15:00:00.000Z",
    status: locked ? "locked" : "open",
    locked,
  },
  submission: null,
});

describe("reconcileEmployeePortalRefresh", () => {
  it("preserves unsaved edits when the same editable week is refreshed", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning");

    const result = reconcileEmployeePortalRefresh({
      currentContext: portal("week-1"),
      currentAvailability: availability,
      hasDraft: true,
      nextContext: portal("week-1"),
      nextDraft: null,
      now: new Date("2026-09-16T00:00:00Z"),
    });

    expect(result.availability).toBe(availability);
    expect(result.hasDraft).toBe(true);
    expect(result.shouldClearDraft).toBe(false);
  });

  it("replaces local edits when the same week becomes locked", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("morning");

    const result = reconcileEmployeePortalRefresh({
      currentContext: portal("week-1"),
      currentAvailability: availability,
      hasDraft: true,
      nextContext: portal("week-1", true),
      nextDraft: null,
      now: new Date("2026-09-16T00:00:00Z"),
    });

    expect(result.hasDraft).toBe(false);
    expect(result.availability.days["1"].status).toBe("off");
    expect(result.shouldClearDraft).toBe(true);
  });

  it("switches to the replacement week when lifecycle selection changes", () => {
    const result = reconcileEmployeePortalRefresh({
      currentContext: portal("week-1"),
      currentAvailability: createEmptyAvailability(),
      hasDraft: false,
      nextContext: portal("week-2"),
      nextDraft: null,
      now: new Date("2026-09-16T00:00:00Z"),
    });

    expect(result.context.week.id).toBe("week-2");
    expect(result.hasDraft).toBe(false);
  });
});

describe("canRefreshEmployeePortal", () => {
  it("only refreshes when neither save nor another refresh is active", () => {
    expect(canRefreshEmployeePortal(false, false)).toBe(true);
    expect(canRefreshEmployeePortal(true, false)).toBe(false);
    expect(canRefreshEmployeePortal(false, true)).toBe(false);
    expect(canRefreshEmployeePortal(true, true)).toBe(false);
  });
});
