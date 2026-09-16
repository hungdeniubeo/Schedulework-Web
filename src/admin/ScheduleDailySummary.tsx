import { addDateOnlyDays, formatDateShort } from "../lib/week";
import {
  periodCounts,
  staffingStatusForShiftCount,
  type StaffingPeriod,
} from "../scheduling/staffing";
import type { ScheduleEntry, ShiftType } from "../scheduling/types";

const WEEKDAY_LABELS = [
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
  "Chủ nhật",
] as const;
const PERIODS: Array<{ key: StaffingPeriod; label: string }> = [
  { key: "S", label: "Sáng" },
  { key: "T", label: "Trưa" },
  { key: "Đ", label: "Tối" },
];

type Props = {
  weekStart: string;
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  countOverrides?: Record<string, number>;
  editable?: boolean;
  onSetCountOverride?: (
    day: number,
    period: StaffingPeriod,
    value: string,
  ) => void;
};

export function ScheduleDailySummary({
  weekStart,
  entries,
  shifts,
  countOverrides = {},
  editable = false,
  onSetCountOverride,
}: Props) {
  const automaticCounts = periodCounts(entries, shifts);
  const dailyShiftCounts = Array.from({ length: 7 }, (_, index) =>
    entries.filter((entry) => entry.dayOfWeek === index + 1).length,
  );

  return (
    <section className="schedule-daily-summary" aria-label="Tổng ca theo ngày">
      <header className="schedule-daily-summary-heading">
        <span className="schedule-summary-icon" aria-hidden="true">▦</span>
        <span>
          <strong>TỔNG CA</strong>
          <small>Theo buổi trong ngày</small>
        </span>
      </header>
      {WEEKDAY_LABELS.map((weekday, index) => {
        const day = index + 1;
        const date = addDateOnlyDays(weekStart, index);
        const shiftCount = dailyShiftCounts[index];
        const status = staffingStatusForShiftCount(shiftCount);
        return (
          <article
            className={`schedule-daily-summary-card ${shiftCount > 0 ? "has-shifts" : ""}`}
            key={date}
          >
            <span className="schedule-summary-date">
              <span>{weekday}</span>
              <strong>{formatDateShort(date)}</strong>
            </span>
            {PERIODS.map(({ key, label }) => {
              const value =
                countOverrides[`${day}:${key}`] ??
                automaticCounts[index][key];
              return (
                <div className="schedule-summary-line" key={key}>
                  <span>{label}</span>
                  {editable && onSetCountOverride ? (
                    <input
                      key={`${day}:${key}:${value}`}
                      className="staffing-count-input"
                      type="number"
                      min="0"
                      defaultValue={value}
                      aria-label={`Tổng ca ${label} ngày ${day}`}
                      title="Nhập số để chỉnh tay; xóa trắng để dùng số tự động"
                      onBlur={(event) =>
                        onSetCountOverride(day, key, event.currentTarget.value)
                      }
                    />
                  ) : (
                    <strong>{value}</strong>
                  )}
                </div>
              );
            })}
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
