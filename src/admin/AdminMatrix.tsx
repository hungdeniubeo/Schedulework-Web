import { formatAvailabilityCell } from "../lib/availability";
import { DAY_KEYS } from "../types/domain";
import { buildMatrixRows } from "./matrix";
import type { AdminEmployee, AvailabilitySubmission } from "../types/domain";

type Props = {
  employees: AdminEmployee[];
  submissions: AvailabilitySubmission[];
  onSelect: (
    employee: AdminEmployee,
    submission: AvailabilitySubmission | null,
  ) => void;
};

export function AdminMatrix({ employees, submissions, onSelect }: Props) {
  const rows = buildMatrixRows(employees, submissions);
  return (
    <section className="panel matrix-panel">
      <div className="panel-heading">
        <div>
          <h2>Lịch nhân viên đăng ký</h2>
          <p>Chọn một nhân viên để xem hoặc chỉnh sửa chi tiết.</p>
        </div>
      </div>
      <div className="matrix-scroll">
        <table className="availability-matrix">
          <thead>
            <tr>
              <th>Nhân viên</th>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
                <th key={label}>{label}</th>
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
                  <strong>{row.employee.name}</strong>
                  {!row.submitted && <small>Chưa đăng ký</small>}
                </th>
                {DAY_KEYS.map((key) => {
                  const day = row.submission?.availability.days[key];
                  const kind = !day
                    ? "missing"
                    : day.status === "off"
                      ? "off"
                      : day.periods.length === 3 && !day.start
                        ? "available"
                        : "partial";
                  return (
                    <td key={key}>
                      <span className={`matrix-cell ${kind}`}>
                        {day ? formatAvailabilityCell(day) : "—"}
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
