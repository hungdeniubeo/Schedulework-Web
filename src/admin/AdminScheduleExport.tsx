import type {
  CloudEmployee,
  Group,
  ScheduleEntry,
  ShiftType,
} from "../scheduling/types";
import { ScheduleDailySummary } from "./ScheduleDailySummary";
import { SchedulerTable } from "./SchedulerTable";

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
  return (
    <section id={id} className="admin-schedule-export-sheet">
      <SchedulerTable
        className="legacy-scheduler-export-table"
        groups={groups}
        employees={employees}
        entries={entries}
        shifts={shifts}
        weekStart={weekStart}
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
