import { describe, expect, it } from "vitest";
import { selectLatestPublishedWeek } from "./publication";
import type { ScheduleWeek } from "./types";

const week = (
  id: string,
  weekStart: string,
  status: ScheduleWeek["status"],
): ScheduleWeek => ({
  id,
  weekStart,
  status,
  publishedAt: status === "published" ? `${weekStart}T00:00:00Z` : null,
  countOverrides: {},
});

describe("selectLatestPublishedWeek", () => {
  it("never selects a newer draft or archived schedule for employees", () => {
    const weeks = [
      week("draft", "2026-09-28", "draft"),
      week("published", "2026-09-21", "published"),
      week("old", "2026-09-14", "archived"),
    ];

    expect(selectLatestPublishedWeek(weeks)?.id).toBe("published");
  });

  it("returns null when no schedule is published", () => {
    expect(
      selectLatestPublishedWeek([week("draft", "2026-09-28", "draft")]),
    ).toBeNull();
  });
});
