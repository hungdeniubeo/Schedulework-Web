import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AdminEmployee } from "../types/domain";
import { AdminMatrix } from "./AdminMatrix";

describe("AdminMatrix accessibility", () => {
  it("makes selectable employee rows keyboard reachable", () => {
    const employee: AdminEmployee = {
      id: "employee-1",
      name: "Nguyễn Phi Hùng",
      active: true,
      created_at: "",
      updated_at: "",
    };
    const html = renderToStaticMarkup(
      <AdminMatrix
        employees={[employee]}
        submissions={[]}
        onSelect={() => undefined}
      />,
    );

    expect(html).toContain('class="matrix-employee-button"');
    expect(html).toContain('aria-label="Xem đăng ký của Nguyễn Phi Hùng"');
  });
});
