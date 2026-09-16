import type { CSSProperties } from "react";
import type {
  CloudEmployee,
  Group,
  ScheduleEntry,
  ShiftType,
} from "../scheduling/types";
import { ScheduleDailySummary } from "./ScheduleDailySummary";
import { SchedulerTable } from "./SchedulerTable";

const EXPORT_EMPLOYEE_COLUMN_WIDTH = 360;

type Props = {
  id: string;
  groups: Group[];
  employees: CloudEmployee[];
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  weekStart: string;
  countOverrides?: Record<string, number>;
};

export function AdminScheduleExport({
  id,
  groups,
  employees,
  entries,
  shifts,
  weekStart,
  countOverrides = {},
}: Props) {
  const exportStyle = {
    "--scheduler-employee-width": `${EXPORT_EMPLOYEE_COLUMN_WIDTH}px`,
  } as CSSProperties;

  return (
    <section
      id={id}
      className="admin-schedule-export-sheet"
      style={exportStyle}
    >
      <SchedulerTable
        className="legacy-scheduler-export-table"
        groups={groups}
        employees={employees}
        entries={entries}
        shifts={shifts}
        weekStart={weekStart}
        employeeColumnWidth={EXPORT_EMPLOYEE_COLUMN_WIDTH}
      />
      <ScheduleDailySummary
        weekStart={weekStart}
        entries={entries}
        shifts={shifts}
        countOverrides={countOverrides}
      />
    </section>
  );
}
