import { rangesForEntry } from "./overlap";
import { consolidatedShiftLabel } from "./shiftStyle";
import type { ScheduleEntry, ShiftType } from "./types";

/**
 * Builds the single persisted entry used for one employee/day cell.
 * Callers must reject overlaps with getEntryIssue before consolidating.
 */
export function consolidateCellEntry(
  candidate: ScheduleEntry,
  existingCellEntries: ScheduleEntry[],
  shiftTypes: ShiftType[],
): ScheduleEntry {
  const combined = [...existingCellEntries, candidate];
  const ranges = combined.flatMap((entry) =>
    rangesForEntry(
      entry,
      shiftTypes.find((shift) => shift.id === entry.shiftTypeId),
    ),
  );
  const earliest = combined.reduce((current, entry) => {
    const currentStart = rangesForEntry(
      current,
      shiftTypes.find((shift) => shift.id === current.shiftTypeId),
    )[0]?.start;
    const entryStart = rangesForEntry(
      entry,
      shiftTypes.find((shift) => shift.id === entry.shiftTypeId),
    )[0]?.start;
    return (entryStart ?? Number.POSITIVE_INFINITY) <
      (currentStart ?? Number.POSITIVE_INFINITY)
      ? entry
      : current;
  });

  return {
    ...candidate,
    shiftTypeId: earliest.shiftTypeId,
    customStart: null,
    customEnd: null,
    customLabel: consolidatedShiftLabel(ranges),
    sortOrderInCell: Math.min(
      candidate.sortOrderInCell,
      ...existingCellEntries.map((entry) => entry.sortOrderInCell),
    ),
  };
}
