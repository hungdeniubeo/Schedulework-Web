import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import { AdminSchedulePage } from "./AdminSchedulePage";

const week: RegistrationWeek = {
  id: "registration-1",
  week_start: "2026-09-21",
  lock_at: "2099-09-18T15:00:00.000Z",
  status: "open",
  created_at: "",
  updated_at: "",
};

describe("AdminSchedulePage", () => {
  it("requires an explicit action before creating a missing schedule week", () => {
    const onCreate = vi.fn(async () => undefined);
    const html = renderToStaticMarkup(
      <AdminSchedulePage
        selectedWeek={week}
        invalidRequestedWeek={false}
        scheduleWeekStarts={[]}
        registrationWeekStarts={[week.week_start]}
        busy={false}
        navigate={vi.fn()}
        onCreate={onCreate}
      />,
    );

    expect(html).toContain("Tuần này chưa có lịch xếp");
    expect(html).toContain("Tạo lịch tuần này");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("shows a clear state for an invalid requested registration week", () => {
    const html = renderToStaticMarkup(
      <AdminSchedulePage
        selectedWeek={null}
        invalidRequestedWeek
        scheduleWeekStarts={[]}
        registrationWeekStarts={[]}
        busy={false}
        navigate={vi.fn()}
        onCreate={vi.fn(async () => undefined)}
      />,
    );
    expect(html).toContain("Không tìm thấy tuần đăng ký");
  });
});
