import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyAvailability } from "../lib/availability";
import type { AdminEmployee, AvailabilitySubmission } from "../types/domain";
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

  it("shows the full reason below an off day", () => {
    const employee: AdminEmployee = {
      id: "employee-1",
      name: "Nguyễn Phi Hùng",
      active: true,
      created_at: "",
      updated_at: "",
    };
    const availability = createEmptyAvailability();
    availability.days["1"] = {
      status: "off",
      preset: null,
      intervals: [],
      offReason: "Em có lịch học",
    };
    const submission: AvailabilitySubmission = {
      id: "submission-1",
      week_id: "week-1",
      employee_id: employee.id,
      availability,
      note: null,
      submitted_at: "",
      updated_at: "",
    };

    const html = renderToStaticMarkup(
      <AdminMatrix
        employees={[employee]}
        submissions={[submission]}
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain("Nghỉ");
    expect(html).toContain("Em có lịch học");
  });
});
