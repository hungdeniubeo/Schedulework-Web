import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminNavigation } from "./AdminNavigation";
import adminNavigationCss from "./AdminNavigation.css?raw";

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

  it("groups workflow and management tabs without changing their order", () => {
    const html = renderToStaticMarkup(
      <AdminNavigation
        section="dashboard"
        selectedWeekStart="2026-10-05"
        navigate={vi.fn()}
      />,
    );

    expect(html).toContain('class="admin-tabs-primary"');
    expect(html).toContain('class="admin-tabs-divider"');
    expect(html).toContain('class="admin-tabs-management"');
    expect(html.indexOf("Xếp lịch")).toBeLessThan(
      html.indexOf('class="admin-tabs-divider"'),
    );
    expect(html.indexOf('class="admin-tabs-divider"')).toBeLessThan(
      html.indexOf("Nhân viên"),
    );
  });

  it("keeps the navigation left-aligned, stable on hover, and scrollable on small screens", () => {
    expect(adminNavigationCss).toContain("justify-content: flex-start");
    expect(adminNavigationCss).toContain(".admin-tabs-divider");
    expect(adminNavigationCss).toContain("overflow-x: auto");
    expect(adminNavigationCss).not.toContain("translateY(-1px)");
  });
});
