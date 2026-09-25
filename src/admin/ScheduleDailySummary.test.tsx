import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScheduleEntry, ShiftType } from "../scheduling/types";
import { ScheduleDailySummary } from "./ScheduleDailySummary";

const shifts: ShiftType[] = [
  { id: "shift-1", label: "10:00-14:00 / 17:00-23:00", color: "#5B9BD5", isPreset: true },
];
const entries: ScheduleEntry[] = [
  {
    id: "entry-1",
    scheduleWeekId: "week-1",
    employeeId: "employee-1",
    dayOfWeek: 1,
    shiftTypeId: "shift-1",
    customStart: null,
    customEnd: null,
    customLabel: null,
    sortOrderInCell: 0,
  },
];

describe("ScheduleDailySummary", () => {
  it("renders compact period totals without repeating weekday and date labels", () => {
    const html = renderToStaticMarkup(
      <ScheduleDailySummary
        weekStart="2026-09-21"
        entries={entries}
        shifts={shifts}
      />,
    );

    expect(html).toContain("TỔNG CA");
    expect(html).toContain("Theo buổi trong ngày");
    expect(html).toContain("Sáng");
    expect(html).toContain("Trưa");
    expect(html).toContain("Tối");
    expect(html).not.toContain("schedule-summary-date");
    expect(html).not.toContain("Thứ hai");
    expect(html).not.toContain("21/09");
    expect(html).not.toContain("<tfoot>");
  });

  it("renders automatic totals as read-only values so schedule changes stay in sync", () => {
    const html = renderToStaticMarkup(
      <ScheduleDailySummary
        weekStart="2026-09-21"
        entries={entries}
        shifts={shifts}
      />,
    );

    expect(html).not.toContain("staffing-count-input");
    expect(html).not.toContain("<input");
    expect(html).toContain('aria-label="1 ca đã xếp"');
  });

  it("marks the summary for the compact centered presentation", () => {
    const html = renderToStaticMarkup(
      <ScheduleDailySummary
        weekStart="2026-09-21"
        entries={entries}
        shifts={shifts}
      />,
    );

    expect(html).toContain('class="schedule-daily-summary compact-summary"');
  });
});
