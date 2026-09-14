import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import type { AvailabilitySubmission, RegistrationWeek } from "../types/domain";

const supabase = vi.hoisted(() => ({ client: null as any }));

vi.mock("../lib/config", () => ({
  getSupabase: () => supabase.client,
}));

import {
  loadMyScheduleData,
  selectSubmittedAvailability,
} from "./scheduleApi";

const week = (id: string, weekStart: string): RegistrationWeek => ({
  id,
  week_start: weekStart,
  lock_at: "2026-09-18T15:00:00Z",
  status: "locked",
  created_at: "",
  updated_at: "",
});

const submission = (id: string, weekId: string): AvailabilitySubmission => ({
  id,
  week_id: weekId,
  employee_id: "employee-1",
  availability: createEmptyAvailability(),
  note: null,
  submitted_at: "2026-09-14T04:30:00Z",
  updated_at: "2026-09-14T04:30:00Z",
});

describe("my schedule availability selection", () => {
  it("returns the latest matching employee submission", () => {
    const older = submission("older", "week-old");
    const matching = submission("matching", "week-current");
    matching.availability.days["2"] = createPresetDay("full");
    const day = matching.availability.days["2"];
    if ("intervals" in day) day.intervals[1].start = "18:00";

    const selected = selectSubmittedAvailability(
      [week("week-old", "2026-09-14"), week("week-current", "2026-09-21")],
      [older, matching],
    );

    expect(selected?.submission.id).toBe("matching");
    expect(selected?.submission.availability.days["2"]).toEqual(day);
  });

  it("returns null when the employee has no submission", () => {
    expect(
      selectSubmittedAvailability([week("week-1", "2026-09-21")], []),
    ).toBeNull();
  });

  it("ignores archived weeks even when they contain the newest submission", () => {
    const current = week("week-current", "2026-09-21");
    const archived = {
      ...week("week-archived", "2026-09-28"),
      status: "archived" as const,
    };

    const selected = selectSubmittedAvailability(
      [archived, current],
      [
        submission("archived-submission", archived.id),
        submission("current-submission", current.id),
      ],
    );

    expect(selected?.submission.id).toBe("current-submission");
  });
});

describe("loadMyScheduleData", () => {
  beforeEach(() => {
    const weeks = [week("week-1", "2026-09-21")];
    const submissions = [submission("submission-1", "week-1")];
    const weekQuery = {
      select: () => weekQuery,
      neq: () => weekQuery,
      order: async () => ({ data: weeks, error: null }),
    };
    const submissionQuery = {
      select: () => submissionQuery,
      eq: async () => ({ data: submissions, error: null }),
    };
    const from = vi.fn((table: string) =>
      table === "registration_weeks" ? weekQuery : submissionQuery,
    );
    supabase.client = { from };
  });

  it("loads only registration weeks and the employee's own submissions", async () => {
    const data = await loadMyScheduleData("employee-1");

    expect(data?.submission.id).toBe("submission-1");
    expect(
      supabase.client.from.mock.calls.map(([table]: [string]) => table),
    ).toEqual(["registration_weeks", "availability_submissions"]);
  });
});
