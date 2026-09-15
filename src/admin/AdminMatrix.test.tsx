import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyAvailability } from "../lib/availability";
import { semanticShiftColor, shiftStyle } from "../scheduling/shiftStyle";
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
        weekStart="2026-09-14"
        onSelect={() => undefined}
      />,
    );

    expect(html).toContain('class="matrix-employee-button"');
    expect(html).toContain('aria-label="Xem đăng ký của Nguyễn Phi Hùng"');
    expect(html).toContain("14/09");
    expect(html).toContain("20/09");
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

  it("uses the shared purple shift style for legacy 10h–23h availability", () => {
    const employee: AdminEmployee = {
      id: "employee-1",
      name: "Nguyễn Phi Hùng",
      active: true,
      created_at: "",
      updated_at: "",
    };
    const availability = createEmptyAvailability();
    availability.version = 1;
    availability.days = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        String(index + 1),
        { status: "off", periods: [], start: null, end: null },
      ]),
    );
    availability.days["1"] = {
      status: "available",
      periods: ["morning", "afternoon", "evening"],
      start: "10:00",
      end: "23:00",
    };
    const submission: AvailabilitySubmission = {
      id: "submission-long",
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
    const purple = semanticShiftColor("10:00-23:00");
    const expectedBackground = (
      shiftStyle(purple) as Record<string, string>
    )["--shift-bg"];

    expect(purple).toBe("#8064A2");
    expect(html).toContain("10h–23h");
    expect(html).toContain("Full");
    expect(html).toContain(`--shift-bg:${expectedBackground}`);
    expect(html).toContain('class="matrix-cell working"');
  });
});
