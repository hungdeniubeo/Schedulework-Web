import { Fragment, type CSSProperties, type ReactNode } from "react";
import { DAY_KEYS } from "../types/domain";
import {
  addDateOnlyDays,
  formatDateShort,
  formatWeekOfMonth,
} from "../lib/week";
import {
  entryLabel,
  rangesForEntry,
} from "../scheduling/overlap";
import { buildScheduleGroups } from "../scheduling/scheduleSheetModel";
import {
  formatShiftLabel,
  resolvedShiftColor,
  shiftStyle,
} from "../scheduling/shiftStyle";
import type {
  CloudEmployee,
  Group,
  ScheduleEntry,
  ShiftType,
} from "../scheduling/types";
import "./AdminScheduleLive.css";

const WEEKDAY_LABELS = [
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
  "Chủ nhật",
] as const;

const AREA_TONE_CLASSES = [
  "schedule-area-one",
  "schedule-area-two",
  "schedule-area-three",
] as const;

export type SchedulerTableProps = {
  groups: Group[];
  employees: CloudEmployee[];
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  weekStart: string;
  employeeColumnWidth?: number;
  renderCell?: (
    employee: CloudEmployee,
    day: number,
    entries: ScheduleEntry[],
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
  renderEmployeeHeader?: (
    employee: CloudEmployee,
    areaClass: string,
  ) => ReactNode;
  id?: string;
  className?: string;
};

export function compareScheduleEntriesByTime(
  first: ScheduleEntry,
  second: ScheduleEntry,
  shifts: ShiftType[],
): number {
  const firstRanges = rangesForEntry(
    first,
    shifts.find((shift) => shift.id === first.shiftTypeId),
  );
  const secondRanges = rangesForEntry(
    second,
    shifts.find((shift) => shift.id === second.shiftTypeId),
  );
  const firstStart = firstRanges[0]?.start ?? Number.POSITIVE_INFINITY;
  const secondStart = secondRanges[0]?.start ?? Number.POSITIVE_INFINITY;
  if (firstStart !== secondStart) return firstStart - secondStart;
  const firstEnd = firstRanges[0]?.end ?? Number.POSITIVE_INFINITY;
  const secondEnd = secondRanges[0]?.end ?? Number.POSITIVE_INFINITY;
  return firstEnd - secondEnd || first.sortOrderInCell - second.sortOrderInCell;
}

export function employeeColumnWidthPx(employees: CloudEmployee[]): number {
  const longest = employees.reduce(
    (max, employee) => Math.max(max, employee.name.length),
    0,
  );
  return Math.min(320, Math.max(210, 140 + longest * 7));
}

function monthAndYear(weekStart: string): { month: number; year: number } {
  const [year, month] = weekStart.split("-").map(Number);
  return {
    month: Number.isFinite(month) ? month : 0,
    year: Number.isFinite(year) ? year : 0,
  };
}

function weekNumberLabel(weekStart: string): string {
  const label = formatWeekOfMonth(weekStart);
  const match = label.match(/^Tuần\s+(\d+)/u);
  return match ? `Tuần ${match[1]}` : "Tuần";
}

function ReadOnlyShift({
  entry,
  shifts,
}: {
  entry: ScheduleEntry;
  shifts: ShiftType[];
}) {
  const label = entryLabel(entry, shifts);
  const shift = shifts.find((item) => item.id === entry.shiftTypeId);
  return (
    <span
      className="schedule-entry-chip readonly legacy-shift-chip"
      style={shiftStyle(
        resolvedShiftColor(
          label,
          shift?.color ?? "#A6A6A6",
          Boolean(entry.customLabel || entry.customStart || entry.customEnd),
        ),
      )}
    >
      {formatShiftLabel(label)
        .split(" / ")
        .map((part, index) => (
          <span key={`${part}-${index}`}>{part}</span>
        ))}
    </span>
  );
}

export function SchedulerTable({
  groups,
  employees,
  entries,
  shifts,
  weekStart,
  employeeColumnWidth,
  renderCell,
  renderGroupRow,
  renderEmployeeRow,
  renderEmployeeHeader,
  id,
  className = "",
}: SchedulerTableProps) {
  const sections = buildScheduleGroups(groups, employees);
  const dates = DAY_KEYS.map((_, index) => addDateOnlyDays(weekStart, index));
  const { month, year } = monthAndYear(weekStart);
  const areaClassByGroupId = new Map<string, string>(
    [...groups]
      .sort((first, second) => first.sortOrder - second.sortOrder)
      .map((group, index): [string, string] => [
        group.id,
        AREA_TONE_CLASSES[index] ?? "schedule-area-neutral",
      ]),
  );
  const liveSurface = id === "cloud-schedule-sheet";
  const resolvedEmployeeColumnWidth = liveSurface
    ? 220
    : (employeeColumnWidth ?? employeeColumnWidthPx(employees));
  const wrapperStyle = {
    "--scheduler-employee-width": `${resolvedEmployeeColumnWidth}px`,
  } as CSSProperties;
  const liveSurfaceClass = liveSurface ? "legacy-scheduler-live-surface" : "";

  return (
    <section
      id={id}
      className={`legacy-scheduler-sheet ${liveSurfaceClass} ${className}`.trim()}
      style={wrapperStyle}
    >
      <header className="legacy-scheduler-heading">
        <h2>
          {weekNumberLabel(weekStart)} <span>·</span> Tháng {month}, {year}
        </h2>
        <span className="legacy-scheduler-range">
          <span aria-hidden="true">▣</span>
          {formatDateShort(weekStart)} — {formatDateShort(addDateOnlyDays(weekStart, 6))}
        </span>
      </header>

      <table className="legacy-scheduler-table">
        <colgroup>
          <col className="legacy-employee-column" />
          {DAY_KEYS.map((key) => (
            <col key={key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="scheduler-employee-head" scope="col">
              <span aria-hidden="true">♙</span> Nhân viên
            </th>
            {dates.map((date, index) => (
              <th
                key={date}
                scope="col"
                className={index >= 5 ? "scheduler-day-head weekend" : "scheduler-day-head"}
              >
                <span>{WEEKDAY_LABELS[index]}</span>
                <strong>{formatDateShort(date)}</strong>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map(({ group, employees: groupEmployees }) => {
            const areaClass =
              areaClassByGroupId.get(group.id) ?? "schedule-area-neutral";
            const groupChildren = (
              <td colSpan={8}>
                <div className="scheduler-group-label">
                  <strong>{group.name.toLocaleUpperCase("vi")}</strong>
                </div>
              </td>
            );

            return (
              <Fragment key={group.id}>
                {renderGroupRow ? (
                  renderGroupRow(group, areaClass, groupChildren)
                ) : (
                  <tr className={`scheduler-group-row ${areaClass}`}>
                    {groupChildren}
                  </tr>
                )}
                {groupEmployees.map((employee) => {
                  const employeeHeader = renderEmployeeHeader ? (
                    renderEmployeeHeader(employee, areaClass)
                  ) : (
                    <div className="schedule-employee-identity">
                      <span className={`scheduler-employee-dot ${areaClass}`} />
                      <span className="schedule-employee-copy">
                        <strong className="schedule-employee-name">{employee.name}</strong>
                        {employee.positionName && (
                          <small className="schedule-employee-position">
                            {employee.positionName}
                          </small>
                        )}
                      </span>
                      {employee.isNew && <span className="scheduler-new-badge">NEW</span>}
                    </div>
                  );
                  const rowChildren = (
                    <>
                      <th
                        scope="row"
                        className={`scheduler-name-cell ${employee.isNew ? "is-new" : ""}`}
                      >
                        {employeeHeader}
                      </th>
                      {DAY_KEYS.map((key) => {
                        const day = Number(key);
                        const cellEntries = entries
                          .filter(
                            (entry) =>
                              entry.employeeId === employee.id &&
                              entry.dayOfWeek === day,
                          )
                          .sort((first, second) =>
                            compareScheduleEntriesByTime(first, second, shifts),
                          );
                        return renderCell ? (
                          renderCell(employee, day, cellEntries)
                        ) : (
                          <td key={key}>
                            <div className="official-shifts">
                              {cellEntries.map((entry) => (
                                <ReadOnlyShift
                                  key={entry.id}
                                  entry={entry}
                                  shifts={shifts}
                                />
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </>
                  );

                  return (
                    <Fragment key={employee.id}>
                      {renderEmployeeRow ? (
                        renderEmployeeRow(
                          employee,
                          group,
                          areaClass,
                          rowChildren,
                        )
                      ) : (
                        <tr className={`scheduler-employee-row ${areaClass}`}>
                          {rowChildren}
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
