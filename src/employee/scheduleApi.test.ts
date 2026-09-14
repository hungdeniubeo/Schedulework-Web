import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "../lib/availability";
import type { AvailabilitySubmission, RegistrationWeek } from "../types/domain";
import {
  resolveMyScheduleSections,
  selectSubmittedAvailability,
  type MyScheduleData,
  type PublishedScheduleData,
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

const published = {
  currentEmployeeId: "employee-1",
  week: {
    id: "schedule-1",
    weekStart: "2026-09-21",
    status: "published",
    publishedAt: "2026-09-20T00:00:00Z",
    countOverrides: {},
  },
  entries: [],
  employees: [],
  groups: [],
  shifts: [],
} satisfies PublishedScheduleData;

describe("my schedule availability selection", () => {
  it("shows a submitted registration as primary before publication", () => {
    const data: MyScheduleData = {
      published: null,
      submitted: { weekStart: "2026-09-21", submission: submission("s1", "w1") },
    };
    expect(resolveMyScheduleSections(data)).toEqual({
      showOfficial: false,
      showSubmitted: true,
      submittedIsPrimary: true,
    });
  });

  it("keeps official and submitted schedules distinct after publication", () => {
    const data: MyScheduleData = {
      published,
      submitted: { weekStart: "2026-09-21", submission: submission("s1", "w1") },
    };
    expect(resolveMyScheduleSections(data)).toEqual({
      showOfficial: true,
      showSubmitted: true,
      submittedIsPrimary: false,
    });
    expect(data.published?.entries).toEqual([]);
  });

  it("shows official schedule when there is no registration", () => {
    expect(resolveMyScheduleSections({ published, submitted: null })).toEqual({
      showOfficial: true,
      showSubmitted: false,
      submittedIsPrimary: false,
    });
  });

  it("matches a submission to the exact published week and keeps custom hours", () => {
    const older = submission("older", "w1");
    const matching = submission("matching", "w2");
    matching.availability.days["2"] = createPresetDay("full");
    const day = matching.availability.days["2"];
    if ("intervals" in day) day.intervals[1].start = "18:00";

    const selected = selectSubmittedAvailability(
      [week("w1", "2026-09-14"), week("w2", "2026-09-21")],
      [older, matching],
      "2026-09-21",
    );
    expect(selected?.submission.id).toBe("matching");
    expect(selected?.submission.availability.days["2"]).toEqual(day);
  });
});
