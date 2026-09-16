import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScheduleEntry, ShiftType } from "../scheduling/types";
import legacyCss from "./AdminScheduleLegacy.css?inline";
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
  it("renders a separate legacy-style total section for all daily periods", () => {
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
    expect(html).toContain("Thứ hai");
    expect(html).toContain("21/09");
    expect(html).not.toContain("<tfoot>");
  });

  it("uses the manual override while keeping the existing input semantics", () => {
    const html = renderToStaticMarkup(
      <ScheduleDailySummary
        weekStart="2026-09-21"
        entries={entries}
        shifts={shifts}
        countOverrides={{ "1:Đ": 4 }}
        editable
        onSetCountOverride={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="Tổng ca Tối ngày 1"');
    expect(html).toContain('value="4"');
  });

  it("keeps the summary compact, centered and evenly aligned", () => {
    expect(legacyCss).toMatch(
      /\.schedule-daily-summary-heading\s*\{[^}]*justify-content:\s*center;[^}]*text-align:\s*center;/s,
    );
    expect(legacyCss).toMatch(
      /\.schedule-daily-summary-card\s*\{[^}]*align-content:\s*center;[^}]*gap:\s*2px;/s,
    );
    expect(legacyCss).toMatch(
      /\.schedule-summary-date\s*\{[^}]*justify-content:\s*center;[^}]*align-items:\s*center;/s,
    );
    expect(legacyCss).toMatch(
      /\.schedule-summary-line\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*34px;[^}]*min-height:\s*18px;/s,
    );
    expect(legacyCss).toMatch(
      /\.schedule-summary-line \.staffing-count-input\s*\{[^}]*width:\s*34px;[^}]*height:\s*20px;/s,
    );
  });
});
