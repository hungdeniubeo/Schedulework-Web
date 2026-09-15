import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNavigation } from "./AdminNavigation";

describe("AdminNavigation", () => {
  it("renders the registration week tab in the requested order", () => {
    const html = renderToStaticMarkup(
      <AdminNavigation
        section="registration-weeks"
        selectedWeekStart="2026-09-21"
        navigate={vi.fn()}
      />,
    );
    const labels = [
      "Trang chủ",
      "Đăng ký nhân viên",
      "Tuần đăng ký",
      "Xếp lịch",
      "Nhân viên",
      "Nhóm",
      "Ca làm",
    ];
    let previous = -1;
    for (const label of labels) {
      const index = html.indexOf(label);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(html).toContain('aria-current="page"');
  });

  it("preserves the selected week on week-sensitive tabs", () => {
    const html = renderToStaticMarkup(
      <AdminNavigation
        section="availability"
        selectedWeekStart="2026-09-21"
        navigate={vi.fn()}
      />,
    );
    expect(html).toContain("/admin/availability?week=2026-09-21");
    expect(html).toContain("/admin/registration-weeks?week=2026-09-21");
    expect(html).toContain("/admin/schedule?week=2026-09-21");
  });
});
