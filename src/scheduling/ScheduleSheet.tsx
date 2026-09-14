import type { ReactNode } from "react";
import { DAY_KEYS } from "../types/domain";
import { addDateOnlyDays, formatDateShort } from "../lib/week";
import { entryLabel } from "./overlap";
import { buildScheduleGroups } from "./scheduleSheetModel";
import { formatShiftLabel, resolvedShiftColor, shiftStyle } from "./shiftStyle";
import { periodCounts, type StaffingPeriod } from "./staffing";
import type { CloudEmployee, Group, ScheduleEntry, ShiftType } from "./types";

type Props = {
  groups: Group[];
  employees: CloudEmployee[];
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  weekStart: string;
  id?: string;
  className?: string;
  countOverrides?: Record<string, number>;
  showStaffing?: boolean;
  highlightEmployeeId?: string;
  renderCell?: (
    employee: CloudEmployee,
    day: number,
    entries: ScheduleEntry[],
  ) => ReactNode;
};

function ReadOnlyCell({
  entries,
  shifts,
}: {
  entries: ScheduleEntry[];
  shifts: ShiftType[];
}) {
  if (entries.length === 0) return null;
  return entries.map((entry) => {
    const shift = shifts.find((item) => item.id === entry.shiftTypeId);
    const label = entryLabel(entry, shifts);
    return (
      <span
        className="schedule-entry-chip readonly"
        style={shiftStyle(
          resolvedShiftColor(label, shift?.color ?? "#A6A6A6"),
        )}
        key={entry.id}
      >
        {formatShiftLabel(label)}
      </span>
    );
  });
}

export function ScheduleSheet({
  groups,
  employees,
  entries,
  shifts,
  weekStart,
  id,
  className = "",
  countOverrides = {},
  showStaffing = false,
  highlightEmployeeId,
  renderCell,
}: Props) {
  const sections = buildScheduleGroups(groups, employees);
  const counts = showStaffing ? periodCounts(entries, shifts) : [];

  return (
    <div id={id} className={`cloud-schedule-sheet ${className}`.trim()}>
      <div className="cloud-sheet-title">
        <strong>LỊCH LÀM VIỆC</strong>
        <span>
          {formatDateShort(weekStart)} –{" "}
          {formatDateShort(addDateOnlyDays(weekStart, 6))}
        </span>
      </div>
      <table className="cloud-schedule-table">
        <thead>
          <tr>
            <th>Nhân viên</th>
            {DAY_KEYS.map((key, index) => (
              <th key={key}>
                <strong>{key === "7" ? "CN" : `T${Number(key) + 1}`}</strong>
                <small>
                  {formatDateShort(addDateOnlyDays(weekStart, index))}
                </small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map(({ group, employees: groupEmployees }) => (
            <ScheduleSection
              key={group.id}
              groupName={group.name}
              employees={groupEmployees}
              entries={entries}
              shifts={shifts}
              highlightEmployeeId={highlightEmployeeId}
              renderCell={renderCell}
            />
          ))}
        </tbody>
        {showStaffing && (
          <tfoot>
            {(["S", "T", "Đ"] as StaffingPeriod[]).map((period) => (
              <tr className="schedule-staffing-row" key={period}>
                <th>{period}</th>
                {counts.map((count, index) => (
                  <td key={index}>
                    {countOverrides[`${index + 1}:${period}`] ?? count[period]}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
}

function ScheduleSection({
  groupName,
  employees,
  entries,
  shifts,
  highlightEmployeeId,
  renderCell,
}: {
  groupName: string;
  employees: CloudEmployee[];
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  highlightEmployeeId?: string;
  renderCell?: Props["renderCell"];
}) {
  return (
    <>
      <tr className="schedule-group-row">
        <th colSpan={8}>{groupName}</th>
      </tr>
      {employees.map((employee) => (
        <tr
          className={
            employee.id === highlightEmployeeId
              ? "current-employee-row"
              : undefined
          }
          key={employee.id}
        >
          <th>
            <strong>{employee.name}</strong>
            {employee.positionName && <small>{employee.positionName}</small>}
            {employee.id === highlightEmployeeId && (
              <small className="current-employee-badge">Bạn</small>
            )}
          </th>
          {DAY_KEYS.map((key) => {
            const day = Number(key);
            const cellEntries = entries
              .filter(
                (entry) =>
                  entry.employeeId === employee.id && entry.dayOfWeek === day,
              )
              .sort(
                (first, second) =>
                  first.sortOrderInCell - second.sortOrderInCell,
              );
            return renderCell ? (
              renderCell(employee, day, cellEntries)
            ) : (
              <td key={key}>
                <ReadOnlyCell entries={cellEntries} shifts={shifts} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
