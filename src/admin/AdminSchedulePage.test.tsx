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
  it("sends Admin to week management when no registration week exists", () => {
    const html = renderToStaticMarkup(
      <AdminSchedulePage
        selectedWeek={null}
        invalidRequestedWeek={false}
        registrationWeekStarts={[]}
        navigate={vi.fn()}
      />,
    );

    expect(html).toContain("Chưa có tuần để xếp lịch");
    expect(html).toContain("Tạo tuần mới");
    expect(html).not.toContain("Tạo lịch tuần này");
  });

  it("renders the scheduler immediately for a valid registration week", () => {
    const html = renderToStaticMarkup(
      <AdminSchedulePage
        selectedWeek={week}
        invalidRequestedWeek={false}
        registrationWeekStarts={[week.week_start]}
        navigate={vi.fn()}
      />,
    );

    expect(html).toContain("Xếp lịch làm việc");
    expect(html).not.toContain("Công bố lịch");
    expect(html).not.toContain("Bản nháp");
    expect(html).not.toContain("Đã công bố");
    expect(html).not.toContain("Tuần này chưa có lịch xếp");
    expect(html).not.toContain("Tạo lịch tuần này");
  });

  it("shows a clear state for an invalid requested registration week", () => {
    const html = renderToStaticMarkup(
      <AdminSchedulePage
        selectedWeek={null}
        invalidRequestedWeek
        registrationWeekStarts={[]}
        navigate={vi.fn()}
      />,
    );
    expect(html).toContain("Không tìm thấy tuần đăng ký");
  });
});
