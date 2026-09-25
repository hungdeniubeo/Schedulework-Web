import {
  formatAvailabilityCell,
  formatAvailabilityDetail,
  formatAvailabilityPreset,
} from "../lib/availability";
import { formatWeekDisplay } from "../lib/week";
import { ArrowRightIcon } from "../components/Icons";
import { ScheduleSheet } from "../scheduling/ScheduleSheet";
import { semanticShiftColor, shiftStyle } from "../scheduling/shiftStyle";
import type { CloudEmployee, Group } from "../scheduling/types";
import type { AvailabilitySubmission, DayKey } from "../types/domain";
import "./AdminAvailability.css";

type Props = {
  employees: CloudEmployee[];
  groups: Group[];
  submissions: AvailabilitySubmission[];
  weekStart: string;
  onOpenScheduler?: () => void;
};

export function AdminMatrix({
  employees,
  groups,
  submissions,
  weekStart,
  onOpenScheduler,
}: Props) {
  const activeEmployees = employees.filter((employee) => employee.active);
  const submissionByEmployeeId = new Map(
    submissions.map((submission) => [submission.employee_id, submission]),
  );

  return (
    <section className="panel matrix-panel admin-availability-matrix">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Đối chiếu theo ngày</span>
          <h2>Lịch nhân viên đăng ký</h2>
          <p>{formatWeekDisplay(weekStart)}</p>
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
        <ScheduleSheet
          className="availability-schedule-sheet"
          groups={groups}
          employees={activeEmployees}
          entries={[]}
          shifts={[]}
          weekStart={weekStart}
          renderCell={(employee, day) => {
            const submission = submissionByEmployeeId.get(employee.id);
            const availability = submission?.availability.days[String(day) as DayKey];
            const preset = availability
              ? formatAvailabilityPreset(availability)
              : "";
            const color = availability?.status === "available"
              ? semanticShiftColor(formatAvailabilityCell(availability))
              : null;
            const kind = !availability
              ? "missing"
              : availability.status === "off"
                ? "off"
                : "working";
            const detail = availability
              ? formatAvailabilityDetail(availability)
              : "—";
            const detailParts =
              availability?.status === "available" && detail.includes(" / ")
                ? detail.split(" / ")
                : [detail];

            return (
              <td key={day}>
                <span
                  className={`matrix-cell ${kind}`}
                  style={color ? shiftStyle(color) : undefined}
                >
                  {detailParts.length > 1 ? (
                    <span className="matrix-cell-shift-lines">
                      {detailParts.map((part, index) => (
                        <span key={`${part}-${index}`}>
                          {part}
                          {index < detailParts.length - 1 ? " /" : ""}
                        </span>
                      ))}
                    </span>
                  ) : (
                    detail
                  )}
                  {preset && <small>{preset}</small>}
                </span>
              </td>
            );
          }}
        />
      </div>
      {activeEmployees.length === 0 && (
        <div className="empty-panel">Chưa có nhân viên đang hoạt động.</div>
      )}
    </section>
  );
}
