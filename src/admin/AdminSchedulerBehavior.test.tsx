import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/admin/AdminScheduler.tsx", "utf8");

describe("AdminScheduler workflow", () => {
  it("does not expose publication controls or publication status copy", () => {
    expect(source).not.toContain("Công bố lịch");
    expect(source).not.toContain("Đã công bố");
    expect(source).not.toContain("Bản nháp");
    expect(source).not.toContain("publishSchedule");
  });

  it("keeps legacy status normalization before protected schedule mutations", () => {
    expect(source).toContain("prepareScheduleWeekForEditing");
    expect(source).toContain("ensureDraftWeek");
  });

  it("refreshes registration guidance without refreshing official entries", () => {
    expect(source).toContain("subscribePageRefresh");
    expect(source).toContain("loadAvailability");
    expect(source).toContain("intervalMs: 15_000");
  });

  it("uses the clean admin export layout instead of the legacy shared ScheduleSheet", () => {
    expect(source).toContain("AdminScheduleExport");
    expect(source).not.toContain('import { ScheduleSheet }');
    expect(source).toContain('id="cloud-schedule-export"');
  });
});
