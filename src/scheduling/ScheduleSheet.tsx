import { Fragment, type ReactNode } from "react";
import { DAY_KEYS } from "../types/domain";
import {
  addDateOnlyDays,
  formatDateShort,
  formatWeekOfMonth,
  localDateInputValue,
} from "../lib/week";
import { entryLabel } from "./overlap";
import { buildScheduleGroups } from "./scheduleSheetModel";
import { formatShiftLabel, resolvedShiftColor, shiftStyle } from "./shiftStyle";
import { periodCounts, type StaffingPeriod } from "./staffing";
import type { CloudEmployee, Group, ScheduleEntry, ShiftType } from "./types";

const STAFFING_PERIOD_LABELS: Record<StaffingPeriod, string> = {
  S: "Sáng",
  T: "Trưa",
  Đ: "Tối",
};

const AREA_TONE_CLASSES = [
  "schedule-area-one",
  "schedule-area-two",
  "schedule-area-three",
] as const;

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
  todayDate?: string;
  renderCell?: (
    employee: CloudEmployee,
    day: number,
    entries: ScheduleEntry[],
  ) => ReactNode;
  renderStaffingCell?: (
    day: number,
    period: StaffingPeriod,
    value: number,
  ) => ReactNode;
  renderGroupRow?: (
    group: Group,
    areaClass: string,
    children: ReactNode,
  ) => ReactNode;
  renderEmployeeRow?: (
    employee: CloudEmployee,
    group: Group,
    areaClass: string,
    children: ReactNode,
  ) => ReactNode;
  renderEmployeeHeader?: (employee: CloudEmployee) => ReactNode;
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
          resolvedShiftColor(
            label,
            shift?.color ?? "#A6A6A6",
            Boolean(entry.customLabel || entry.customStart || entry.customEnd),
          ),
        )}
        key={entry.id}
      >
        {formatShiftLabel(label).replace(" / ", " /\n")}
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
  todayDate = localDateInputValue(),
  renderCell,
  renderStaffingCell,
  renderGroupRow,
  renderEmployeeRow,
  renderEmployeeHeader,
}: Props) {
  const sections = buildScheduleGroups(groups, employees);
  const counts = showStaffing || renderStaffingCell
    ? periodCounts(entries, shifts)
    : [];
  const areaClassByGroupId = new Map<string, string>(
    [...groups]
      .sort((first, second) => first.sortOrder - second.sortOrder)
      .map(
        (group, index): [string, string] => [
          group.id,
          AREA_TONE_CLASSES[index] ?? "schedule-area-neutral",
        ],
      ),
  );

  return (
    <div id={id} className={`cloud-schedule-sheet ${className}`.trim()}>
      <div className="cloud-sheet-title">
        <strong>LỊCH LÀM VIỆC</strong>
        <span>
          {formatWeekOfMonth(weekStart)} · {formatDateShort(weekStart)} –{" "}
          {formatDateShort(addDateOnlyDays(weekStart, 6))}
        </span>
      </div>
      <table className="cloud-schedule-table">
        <thead>
          <tr>
            <th>Nhân viên</th>
            {DAY_KEYS.map((key, index) => {
              const date = addDateOnlyDays(weekStart, index);
              const dayClassName = [
                "schedule-day-head",
                index >= 5 ? "weekend" : "",
                date === todayDate ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <th key={key} className={dayClassName}>
                  <strong>{key === "7" ? "CN" : `T${Number(key) + 1}`}</strong>
                  <small>{formatDateShort(date)}</small>
                  {date === todayDate && (
                    <span className="schedule-today-dot" aria-hidden="true" />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sections.map(({ group, employees: groupEmployees }) => (
            <ScheduleSection
              key={group.id}
              group={group}
              areaClass={
                areaClassByGroupId.get(group.id) ?? "schedule-area-neutral"
              }
              employees={groupEmployees}
              entries={entries}
              shifts={shifts}
              highlightEmployeeId={highlightEmployeeId}
              renderCell={renderCell}
              renderGroupRow={renderGroupRow}
              renderEmployeeRow={renderEmployeeRow}
              renderEmployeeHeader={renderEmployeeHeader}
            />
          ))}
        </tbody>
        {(showStaffing || renderStaffingCell) && (
          <tfoot>
            {(["S", "T", "Đ"] as StaffingPeriod[]).map((period) => (
              <tr className="schedule-staffing-row" key={period}>
                <th>{STAFFING_PERIOD_LABELS[period]}</th>
                {counts.map((count, index) => (
                  <td key={index}>
                    {renderStaffingCell
                      ? renderStaffingCell(
                          index + 1,
                          period,
                          countOverrides[`${index + 1}:${period}`] ??
                            count[period],
                        )
                      : countOverrides[`${index + 1}:${period}`] ?? count[period]}
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
  group,
  areaClass,
  employees,
  entries,
  shifts,
  highlightEmployeeId,
  renderCell,
  renderGroupRow,
  renderEmployeeRow,
  renderEmployeeHeader,
}: {
  group: Group;
  areaClass: string;
  employees: CloudEmployee[];
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  highlightEmployeeId?: string;
  renderCell?: Props["renderCell"];
  renderGroupRow?: Props["renderGroupRow"];
  renderEmployeeRow?: Props["renderEmployeeRow"];
  renderEmployeeHeader?: Props["renderEmployeeHeader"];
}) {
  const groupChildren = (
    <th colSpan={8}>
      <span className="schedule-group-label">{group.name}</span>
    </th>
  );

  return (
    <>
      <Fragment key={`group-${group.id}`}>
        {renderGroupRow ? (
          renderGroupRow(group, areaClass, groupChildren)
        ) : (
          <tr className={`schedule-group-row ${areaClass}`}>{groupChildren}</tr>
        )}
      </Fragment>
      {employees.map((employee) => {
        const employeeHeader = renderEmployeeHeader ? (
          renderEmployeeHeader(employee)
        ) : (
          <>
            <strong>{employee.name}</strong>
            {employee.positionName && <small>{employee.positionName}</small>}
            {employee.id === highlightEmployeeId && (
              <small className="current-employee-badge">Bạn</small>
            )}
          </>
        );
        const rowChildren = (
          <>
            <th>{employeeHeader}</th>
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
          </>
        );
        const rowClassName = [
          "schedule-area-row",
          areaClass,
          employee.id === highlightEmployeeId ? "current-employee-row" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <Fragment key={employee.id}>
            {renderEmployeeRow ? (
              renderEmployeeRow(employee, group, areaClass, rowChildren)
            ) : (
              <tr className={rowClassName}>{rowChildren}</tr>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
