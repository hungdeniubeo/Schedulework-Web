import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmployeeHeader } from "./EmployeeApp";

describe("shared employee header", () => {
  it("renders compact account actions and three accessible tabs", () => {
    const html = renderToStaticMarkup(
      <EmployeeHeader
        section="my-schedule"
        navigate={() => undefined}
        onLogout={() => undefined}
      />,
    );

    expect(html).toContain('class="employee-header"');
    expect(html).toContain("ScheduleWork");
    expect(html).toContain("Đổi mật khẩu");
    expect(html).toContain("Đăng xuất");
    expect(html).toContain("Đăng ký lịch");
    expect(html).toContain("Lịch của tôi");
    expect(html).toContain("Lịch tổng");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('class="active"');
  });
});
