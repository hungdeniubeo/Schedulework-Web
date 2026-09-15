import {
  formatAvailabilityCell,
  formatAvailabilityDetail,
  formatAvailabilityPreset,
} from "../lib/availability";
import { semanticShiftColor, shiftStyle } from "../scheduling/shiftStyle";
import {
  addDateOnlyDays,
  formatDateShort,
  formatWeekDisplay,
} from "../lib/week";
import { ArrowRightIcon } from "../components/Icons";
import { DAY_KEYS } from "../types/domain";
import { buildMatrixRows } from "./matrix";
import type { AdminEmployee, AvailabilitySubmission } from "../types/domain";

type Props = {
  employees: AdminEmployee[];
  submissions: AvailabilitySubmission[];
  weekStart?: string;
  onOpenScheduler?: () => void;
  onSelect: (
    employee: AdminEmployee,
    submission: AvailabilitySubmission | null,
  ) => void;
};

export function AdminMatrix({
  employees,
  submissions,
  weekStart,
  onOpenScheduler,
  onSelect,
}: Props) {
  const rows = buildMatrixRows(employees, submissions);
  return (
    <section className="panel matrix-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Đối chiếu theo ngày</span>
          <h2>Lịch nhân viên đăng ký</h2>
          <p>
            {weekStart
              ? formatWeekDisplay(weekStart)
              : "Chọn một nhân viên để xem hoặc chỉnh sửa chi tiết."}
          </p>
        </div>
        {onOpenScheduler && (
          <button
            type="button"
            className="button primary matrix-schedule-action"
            onClick={onOpenScheduler}
          >
            Xếp lịch tuần này <ArrowRightIcon />
          </button>
        )}
      </div>
      <div className="schedule-legend" aria-label="Chú giải lịch đăng ký">
        <span><i className="legend-dot working" />Có thể đi làm</span>
        <span><i className="legend-dot off" />Nghỉ</span>
        <span><i className="legend-dot missing" />Chưa đăng ký</span>
      </div>
      <div className="matrix-scroll">
        <table className="availability-matrix">
          <thead>
            <tr>
              <th>Nhân viên</th>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label, index) => (
                <th key={label} className="calendar-day-heading">
                  <strong>{label}</strong>
                  {weekStart && (
                    <small>{formatDateShort(addDateOnlyDays(weekStart, index))}</small>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.employee.id}
                onClick={() => onSelect(row.employee, row.submission)}
              >
                <th>
                  <button
                    type="button"
                    className="matrix-employee-button"
                    aria-label={`Xem đăng ký của ${row.employee.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(row.employee, row.submission);
                    }}
                  >
                    <strong>{row.employee.name}</strong>
                  </button>
                  {!row.submitted && <small>Chưa đăng ký</small>}
                </th>
                {DAY_KEYS.map((key) => {
                  const day = row.submission?.availability.days[key];
                  const preset = day ? formatAvailabilityPreset(day) : "";
                  const semanticColor =
                    day?.status === "available"
                      ? semanticShiftColor(formatAvailabilityCell(day))
                      : null;
                  const kind = !day
                    ? "missing"
                    : day.status === "off"
                      ? "off"
                      : "working";
                  return (
                    <td key={key}>
                      <span
                        className={`matrix-cell ${kind}`}
                        style={semanticColor ? shiftStyle(semanticColor) : undefined}
                      >
                        {day ? formatAvailabilityDetail(day) : "—"}
                        {preset && <small>{preset}</small>}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="empty-panel">Chưa có nhân viên đang hoạt động.</div>
      )}
    </section>
  );
}
