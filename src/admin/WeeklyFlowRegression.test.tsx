import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import type { ScheduleWeek } from "../scheduling/types";
import { AdminScheduler, prepareScheduleWeekForEditing } from "./AdminScheduler";
import { WeekManager } from "./WeekManager";
import adminSchedulerSource from "./AdminScheduler.tsx?raw";

const registrationWeek = (
  id: string,
  weekStart: string,
  status: RegistrationWeek["status"] = "archived",
): RegistrationWeek => ({
  id,
  week_start: weekStart,
  lock_at: `${weekStart}T15:00:00.000Z`,
  status,
  created_at: "",
  updated_at: "",
});

describe("weekly workflow regression coverage", () => {
  it("reopens an archived schedule as draft when Admin resumes editing an active registration week", async () => {
    const archivedWeek: ScheduleWeek = {
      id: "schedule-archived",
      weekStart: "2026-09-21",
      status: "archived",
      publishedAt: null,
      countOverrides: {},
    };
    const updateStatus = vi.fn(async () => undefined);

    await expect(
      prepareScheduleWeekForEditing(archivedWeek, updateStatus),
    ).resolves.toEqual({ ...archivedWeek, status: "draft" });
    expect(updateStatus).toHaveBeenCalledWith(archivedWeek.id, "draft");
  });

  it("keeps scheduling on the registration-week route with no second week lifecycle", () => {
    const html = renderToStaticMarkup(
      <AdminScheduler
        preferredWeekStart="2026-09-21"
        registrationWeekStarts={["2026-09-21"]}
      />,
    );

    expect(html).not.toContain('aria-label="Tuần xếp lịch"');
    expect(html).not.toContain('aria-label="Tạo lịch tuần mới"');
    expect(html).not.toContain("Tạo lịch tuần");
    expect(html).not.toContain("Tuần bắt đầu từ Thứ Hai");
    expect(html).toContain('aria-label="Tìm nhân viên"');
    expect(html).toContain('aria-label="Lọc theo nhóm"');

    expect(adminSchedulerSource).not.toContain("addScheduleWeek");
    expect(adminSchedulerSource).not.toContain("creatingWeek");
    expect(adminSchedulerSource).not.toContain("newWeekStart");
    expect(adminSchedulerSource).not.toContain("Tạo lịch tuần mới");
    expect(adminSchedulerSource).not.toContain("Tuần xếp lịch");
  });

  it("gives every archived-week delete action an explicit target label", () => {
    const first = registrationWeek("week-a", "2026-09-28");
    const second = registrationWeek("week-b", "2026-10-05");
    const html = renderToStaticMarkup(
      <WeekManager
        weeks={[first, second]}
        selectedId=""
        busy={false}
        onSelect={() => undefined}
        onCreate={async () => first}
        onUpdate={async () => undefined}
        onDelete={async () => undefined}
      />,
    );

    expect(html).toContain('aria-label="Xóa tuần 28/09 – 04/10"');
    expect(html).toContain('aria-label="Xóa tuần 05/10 – 11/10"');
  });
});
