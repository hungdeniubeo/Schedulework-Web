import { describe, expect, it } from "vitest";
import type { ScheduleEntry } from "../scheduling/types";
import { previewEntryForCell, resolveSchedulerDrop } from "./schedulerDnd";

const entry: ScheduleEntry = {
  id: "entry-1",
  scheduleWeekId: "week-1",
  employeeId: "employee-a",
  dayOfWeek: 1,
  shiftTypeId: "shift-1",
  customStart: null,
  customEnd: null,
  customLabel: null,
  sortOrderInCell: 0,
};

describe("resolveSchedulerDrop", () => {
  it("routes palette drops to shift assignment", () => {
    expect(
      resolveSchedulerDrop(
        { kind: "palette", shiftId: "shift-1" },
        { kind: "cell", employeeId: "employee-a", day: 2 },
      ),
    ).toEqual({
      kind: "assign",
      employeeId: "employee-a",
      day: 2,
      shiftId: "shift-1",
    });
  });

  it("routes existing entries to schedule-entry movement", () => {
    expect(
      resolveSchedulerDrop(
        { kind: "entry", entry },
        { kind: "cell", employeeId: "employee-b", day: 3 },
      ),
    ).toEqual({ kind: "moveEntry", entry, employeeId: "employee-b", day: 3 });
  });

  it("routes employee-on-employee drops to row reorder only", () => {
    expect(
      resolveSchedulerDrop(
        {
          kind: "employee",
          employeeId: "employee-a",
          employeeName: "A",
          groupId: "group-meat",
        },
        {
          kind: "employee",
          employeeId: "employee-b",
          groupId: "group-soup",
        },
      ),
    ).toEqual({
      kind: "moveEmployee",
      employeeId: "employee-a",
      targetGroupId: "group-soup",
      beforeEmployeeId: "employee-b",
    });
  });

  it("drops an employee on a group header at the start of that group", () => {
    expect(
      resolveSchedulerDrop(
        {
          kind: "employee",
          employeeId: "employee-a",
          employeeName: "A",
          groupId: "group-meat",
        },
        { kind: "group", groupId: "group-soup" },
      ),
    ).toEqual({
      kind: "moveEmployee",
      employeeId: "employee-a",
      targetGroupId: "group-soup",
      beforeEmployeeId: undefined,
    });
  });

  it("never turns an employee drag into a schedule assignment", () => {
    expect(
      resolveSchedulerDrop(
        {
          kind: "employee",
          employeeId: "employee-a",
          employeeName: "A",
          groupId: "group-meat",
        },
        { kind: "cell", employeeId: "employee-b", day: 2 },
      ),
    ).toBeNull();
  });

  it("routes entry drops on trash to deletion", () => {
    expect(
      resolveSchedulerDrop({ kind: "entry", entry }, { kind: "trash" }),
    ).toEqual({ kind: "deleteEntry", entry });
  });
});

describe("previewEntryForCell", () => {
  it("builds a preview entry for a palette shift", () => {
    expect(
      previewEntryForCell(
        { kind: "palette", shiftId: "shift-2" },
        "employee-b",
        4,
      ),
    ).toEqual({
      id: "preview",
      scheduleWeekId: "",
      employeeId: "employee-b",
      dayOfWeek: 4,
      shiftTypeId: "shift-2",
      customStart: null,
      customEnd: null,
      customLabel: null,
      sortOrderInCell: 0,
    });
  });

  it("moves an existing entry only in the preview copy", () => {
    const preview = previewEntryForCell(
      { kind: "entry", entry },
      "employee-b",
      5,
    );

    expect(preview).toEqual({ ...entry, employeeId: "employee-b", dayOfWeek: 5 });
    expect(entry.employeeId).toBe("employee-a");
    expect(entry.dayOfWeek).toBe(1);
  });

  it("does not create a schedule preview for employee row drags", () => {
    expect(
      previewEntryForCell(
        {
          kind: "employee",
          employeeId: "employee-a",
          employeeName: "A",
          groupId: "group-meat",
        },
        "employee-b",
        2,
      ),
    ).toBeNull();
  });
});
