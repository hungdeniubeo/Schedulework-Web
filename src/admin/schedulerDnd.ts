import type { ScheduleEntry } from "../scheduling/types";

export type SchedulerDragData =
  | { kind: "palette"; shiftId: string }
  | { kind: "entry"; entry: ScheduleEntry }
  | {
      kind: "employee";
      employeeId: string;
      employeeName: string;
      groupId: string;
    };

export type SchedulerDropData =
  | { kind: "cell"; employeeId: string; day: number }
  | { kind: "employee"; employeeId: string; groupId: string }
  | { kind: "group"; groupId: string }
  | { kind: "trash" };

export type SchedulerDropAction =
  | { kind: "assign"; employeeId: string; day: number; shiftId: string }
  | {
      kind: "moveEntry";
      entry: ScheduleEntry;
      employeeId: string;
      day: number;
    }
  | { kind: "deleteEntry"; entry: ScheduleEntry }
  | {
      kind: "moveEmployee";
      employeeId: string;
      targetGroupId: string;
      beforeEmployeeId?: string;
    };

export function previewEntryForCell(
  source: SchedulerDragData | undefined,
  employeeId: string,
  day: number,
): ScheduleEntry | null {
  if (!source || source.kind === "employee") return null;
  if (source.kind === "entry") {
    return { ...source.entry, employeeId, dayOfWeek: day };
  }
  return {
    id: "preview",
    scheduleWeekId: "",
    employeeId,
    dayOfWeek: day,
    shiftTypeId: source.shiftId,
    customStart: null,
    customEnd: null,
    customLabel: null,
    sortOrderInCell: 0,
  };
}

export function resolveSchedulerDrop(
  source: SchedulerDragData | undefined,
  target: SchedulerDropData | undefined,
): SchedulerDropAction | null {
  if (!source || !target) return null;

  if (source.kind === "employee") {
    if (target.kind === "employee") {
      if (source.employeeId === target.employeeId) return null;
      return {
        kind: "moveEmployee",
        employeeId: source.employeeId,
        targetGroupId: target.groupId,
        beforeEmployeeId: target.employeeId,
      };
    }
    if (target.kind === "group") {
      return {
        kind: "moveEmployee",
        employeeId: source.employeeId,
        targetGroupId: target.groupId,
        beforeEmployeeId: undefined,
      };
    }
    return null;
  }

  if (source.kind === "entry" && target.kind === "trash") {
    return { kind: "deleteEntry", entry: source.entry };
  }

  if (target.kind !== "cell") return null;

  if (source.kind === "palette") {
    return {
      kind: "assign",
      employeeId: target.employeeId,
      day: target.day,
      shiftId: source.shiftId,
    };
  }

  return {
    kind: "moveEntry",
    entry: source.entry,
    employeeId: target.employeeId,
    day: target.day,
  };
}
