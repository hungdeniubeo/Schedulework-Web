import { describe, expect, it } from "vitest";
import source from "./AdminScheduler.tsx?raw";

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

  it("refreshes group and employee structure separately from official entries", () => {
    expect(source).toContain("loadStructure");
    expect(source).toContain("listGroups()");
    expect(source).toContain("listSchedulerEmployees()");
    expect(source).toContain("Không làm mới được nhóm và nhân viên");
  });

  it("routes JPG export through the shared exporter", () => {
    expect(source).toContain("exportScheduleJpg");
    expect(source).toContain('exportScheduleJpg("cloud-schedule-export"');
  });
});
