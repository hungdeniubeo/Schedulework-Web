import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyAvailability } from "../lib/availability";
import { semanticShiftColor, shiftStyle } from "../scheduling/shiftStyle";
import type { CloudEmployee, Group } from "../scheduling/types";
import type { AvailabilitySubmission } from "../types/domain";
import { AdminMatrix } from "./AdminMatrix";

const groups: Group[] = [
  { id: "group-service", name: "Service", sortOrder: 1 },
  { id: "group-meat", name: "Meat", sortOrder: 2 },
];

const employee: CloudEmployee = {
  id: "employee-1",
  name: "Nguyễn Phi Hùng",
  active: true,
  groupId: "group-meat",
  positionId: "position-1",
  positionName: "Part time",
  sortOrder: 1,
  isNew: false,
};

function submissionWith(
  update: (availability: ReturnType<typeof createEmptyAvailability>) => void,
): AvailabilitySubmission {
  const availability = createEmptyAvailability();
  update(availability);
  return {
    id: "submission-1",
    week_id: "week-1",
    employee_id: employee.id,
    availability,
    note: null,
    submitted_at: "",
    updated_at: "",
  };
}

describe("AdminMatrix", () => {
  it("reuses the grouped schedule grid and keeps configured empty groups visible", () => {
    const html = renderToStaticMarkup(
      <AdminMatrix
        employees={[employee]}
        groups={groups}
        submissions={[]}
        weekStart="2026-09-14"
      />,
    );

    expect(html).toContain("cloud-schedule-table");
    expect(html).toContain("schedule-group-row");
    expect(html).toContain("Service");
    expect(html).toContain("Meat");
    expect(html).toContain("Part time");
    expect(html).toContain("Nguyễn Phi Hùng");
    expect(html).toContain("14/09");
    expect(html).toContain("20/09");
    expect(html).not.toContain("matrix-employee-button");
    expect(html).not.toContain("Xem đăng ký của");
  });

  it("shows the full reason below an off day", () => {
    const submission = submissionWith((availability) => {
      availability.days["1"] = {
        status: "off",
        preset: null,
        intervals: [],
        offReason: "Em có lịch học",
      };
    });
    const html = renderToStaticMarkup(
      <AdminMatrix
        employees={[employee]}
        groups={groups}
        submissions={[submission]}
        weekStart="2026-09-14"
      />,
    );

    expect(html).toContain("Nghỉ · Em có lịch học");
  });

  it("shows split availability ranges on separate lines", () => {
    const submission = submissionWith((availability) => {
      availability.days["1"] = {
        status: "available",
        preset: "full",
        intervals: [
          { start: "10:00", end: "14:00" },
          { start: "19:00", end: "23:00" },
        ],
      };
    });
    const html = renderToStaticMarkup(
      <AdminMatrix
        employees={[employee]}
        groups={groups}
        submissions={[submission]}
        weekStart="2026-09-14"
      />,
    );

    expect(html).toContain('class="matrix-cell-shift-lines"');
    expect(html).toContain("<span>10h–14h /</span>");
    expect(html).toContain("<span>19h–23h</span>");
  });

  it("uses the existing semantic shift color for available hours", () => {
    const submission = submissionWith((availability) => {
      availability.days["1"] = {
        status: "available",
        preset: null,
        intervals: [{ start: "10:00", end: "23:00" }],
      };
    });
    const html = renderToStaticMarkup(
      <AdminMatrix
        employees={[employee]}
        groups={groups}
        submissions={[submission]}
        weekStart="2026-09-14"
      />,
    );
    const expectedBackground = (
      shiftStyle(semanticShiftColor("10h–23h")) as unknown as Record<
        string,
        string
      >
    )["--shift-bg"];

    expect(html).toContain(`--shift-bg:${expectedBackground}`);
    expect(html).toContain('class="matrix-cell working"');
  });
});
