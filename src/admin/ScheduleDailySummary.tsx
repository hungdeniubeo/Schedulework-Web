import {
  periodCounts,
  staffingStatusForShiftCount,
  type StaffingPeriod,
} from "../scheduling/staffing";
import type { ScheduleEntry, ShiftType } from "../scheduling/types";
import "./ScheduleDailySummaryCompact.css";

const DAYS = Array.from({ length: 7 }, (_, index) => index + 1);
const PERIODS: Array<{ key: StaffingPeriod; label: string }> = [
  { key: "S", label: "Sáng" },
  { key: "T", label: "Trưa" },
  { key: "Đ", label: "Tối" },
];

type Props = {
  weekStart: string;
  entries: ScheduleEntry[];
  shifts: ShiftType[];
};

export function ScheduleDailySummary({
  entries,
  shifts,
}: Props) {
  const automaticCounts = periodCounts(entries, shifts);
  const dailyShiftCounts = DAYS.map((day) =>
    entries.filter((entry) => entry.dayOfWeek === day).length,
  );

  return (
    <section
      className="schedule-daily-summary compact-summary"
      aria-label="Tổng ca theo ngày"
    >
      <header className="schedule-daily-summary-heading">
        <span>
          <strong>TỔNG CA</strong>
          <small>Theo buổi trong ngày</small>
        </span>
      </header>
      {DAYS.map((day, index) => {
        const shiftCount = dailyShiftCounts[index];
        const status = staffingStatusForShiftCount(shiftCount);
        return (
          <article
            className={`schedule-daily-summary-card ${shiftCount > 0 ? "has-shifts" : ""}`}
            key={day}
          >
            {PERIODS.map(({ key, label }) => (
              <div className="schedule-summary-line" key={key}>
                <span>{label}</span>
                <strong>{automaticCounts[index][key]}</strong>
              </div>
            ))}
            <span
              className={`schedule-summary-status staffing-status-${status}`}
              aria-label={`${shiftCount} ca đã xếp`}
            />
          </article>
        );
      })}
    </section>
  );
}
