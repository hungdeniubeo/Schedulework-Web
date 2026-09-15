import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  formatAvailabilityCell,
  getOffReason,
} from "../lib/availability";
import { ScheduleSheet } from "../scheduling/ScheduleSheet";
import { entryLabel } from "../scheduling/overlap";
import {
  formatShiftLabel,
  resolvedShiftColor,
  semanticShiftColor,
  shiftStyle,
} from "../scheduling/shiftStyle";
import type {
  CloudEmployee,
  Group,
  ScheduleEntry,
  ShiftType,
} from "../scheduling/types";
import type { Availability } from "../types/domain";

function PaletteShift({
  shift,
  disabled,
  selected,
  onSelect,
}: {
  shift: ShiftType;
  disabled: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const drag = useDraggable({
    id: `palette:${shift.id}`,
    data: { kind: "palette", shiftId: shift.id },
    disabled,
  });
  const color = resolvedShiftColor(shift.label, shift.color);
  return (
    <button
      ref={drag.setNodeRef}
      type="button"
      style={{
        ...shiftStyle(color),
        transform: CSS.Translate.toString(drag.transform),
      }}
      className={`scheduler-shift ${selected ? "selected" : ""}`}
      disabled={disabled}
      onClick={onSelect}
      {...drag.listeners}
      {...drag.attributes}
    >
<span className="scheduler-shift-dot" aria-hidden="true" />

<span className="scheduler-shift-label">
  {formatShiftLabel(shift.label)
    .split(" / ")
    .map((part, index, parts) => (
      <span key={`${part}-${index}`}>
        {part}
        {index < parts.length - 1 && " /"}
        {index < parts.length - 1 && <br />}
      </span>
    ))}
</span>
    </button>
  );
}

function EntryChip({
  entry,
  shifts,
  editable,
  onEdit,
}: {
  entry: ScheduleEntry;
  shifts: ShiftType[];
  editable: boolean;
  onEdit: () => void;
}) {
  const shift = shifts.find((item) => item.id === entry.shiftTypeId);
  const label = entryLabel(entry, shifts);
  const drag = useDraggable({
    id: `entry:${entry.id}`,
    data: { kind: "entry", entry },
    disabled: !editable,
  });
  return (
    <button
      ref={drag.setNodeRef}
      type="button"
      className="schedule-entry-chip"
      style={{
        ...shiftStyle(
          resolvedShiftColor(
            label,
            shift?.color ?? "#A6A6A6",
            Boolean(entry.customLabel || entry.customStart || entry.customEnd),
          ),
        ),
        transform: CSS.Translate.toString(drag.transform),
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (editable) onEdit();
      }}
      {...drag.listeners}
      {...drag.attributes}
    >
      {formatShiftLabel(label)}
    </button>
  );
}

function ScheduleCell({
  employee,
  day,
  entries,
  shifts,
  editable,
  selectedShiftId,
  onAssign,
  onEdit,
  availability,
}: {
  employee: CloudEmployee;
  day: number;
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  editable: boolean;
  selectedShiftId: string | null;
  onAssign: (employeeId: string, day: number) => void;
  onEdit: (entry: ScheduleEntry) => void;
  availability?: Availability["days"][string];
}) {
  const drop = useDroppable({
    id: `cell:${employee.id}:${day}`,
    data: { employeeId: employee.id, day },
    disabled: !editable,
  });
  const assignable = Boolean(selectedShiftId && editable);
  const availabilityLabel = availability
    ? formatAvailabilityCell(availability)
    : "";
  const offReason = availability ? getOffReason(availability) : "";
  return (
    <td
      ref={drop.setNodeRef}
      className={`${drop.isOver ? "drag-over" : ""} ${assignable ? "assignable" : ""}`}
      role={assignable ? "button" : undefined}
      tabIndex={assignable ? 0 : undefined}
      aria-label={assignable ? `Xếp ca cho ${employee.name}, ngày ${day}` : undefined}
      onClick={() => {
        if (assignable) onAssign(employee.id, day);
      }}
      onKeyDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          !assignable ||
          (event.key !== "Enter" && event.key !== " ")
        )
          return;
        event.preventDefault();
        onAssign(employee.id, day);
      }}
    >
      {availability && (
        <small
          className={`availability-hint ${availability.status}`}
          style={
            availability.status === "available"
              ? shiftStyle(semanticShiftColor(availabilityLabel))
              : undefined
          }
        >
          <span>ĐK</span> · {availabilityLabel}
          {offReason && <em title={offReason}>{offReason}</em>}
        </small>
      )}
      <div className="official-shifts">
      {entries.map((entry) => (
        <EntryChip
          key={entry.id}
          entry={entry}
          shifts={shifts}
          editable={editable}
          onEdit={() => onEdit(entry)}
        />
      ))}
      </div>
    </td>
  );
}

type Props = {
  groups: Group[];
  employees: CloudEmployee[];
  entries: ScheduleEntry[];
  shifts: ShiftType[];
  weekStart: string;
  editable: boolean;
  selectedShiftId: string | null;
  onSelectShift: (id: string | null) => void;
  onAssign: (employeeId: string, day: number, shiftId?: string) => void;
  onMove: (entry: ScheduleEntry, employeeId: string, day: number) => void;
  onEdit: (entry: ScheduleEntry) => void;
  availabilityByEmployee?: Record<string, Availability>;
};

export function ScheduleGrid(props: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function dragEnd(event: DragEndEvent) {
    const target = event.over?.data.current as
      | { employeeId?: string; day?: number }
      | undefined;
    const source = event.active.data.current as
      | { kind?: string; shiftId?: string; entry?: ScheduleEntry }
      | undefined;
    if (!target?.employeeId || !target.day || !source) return;
    if (source.kind === "palette" && source.shiftId)
      props.onAssign(target.employeeId, target.day, source.shiftId);
    if (source.kind === "entry" && source.entry)
      props.onMove(source.entry, target.employeeId, target.day);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={dragEnd}>
      <div className="scheduler-layout">
        <aside className="scheduler-palette">
          <h3>Ca làm</h3>
          <p>Chọn hoặc kéo ca vào lịch.</p>
          {props.shifts.map((shift) => (
            <PaletteShift
              key={shift.id}
              shift={shift}
              disabled={!props.editable}
              selected={props.selectedShiftId === shift.id}
              onSelect={() =>
                props.onSelectShift(
                  props.selectedShiftId === shift.id ? null : shift.id,
                )
              }
            />
          ))}
          {props.shifts.length === 0 && <small>Hãy tạo ca làm trước.</small>}
        </aside>
        <div className="schedule-table-scroll">
          <ScheduleSheet
            id="cloud-schedule-sheet"
            groups={props.groups}
            employees={props.employees}
            entries={props.entries}
            shifts={props.shifts}
            weekStart={props.weekStart}
            renderCell={(employee, day, entries) => (
              <ScheduleCell
                key={day}
                employee={employee}
                day={day}
                entries={entries}
                shifts={props.shifts}
                editable={props.editable}
                selectedShiftId={props.selectedShiftId}
                onAssign={(employeeId, nextDay) =>
                  props.onAssign(employeeId, nextDay)
                }
                onEdit={props.onEdit}
                availability={
                  props.availabilityByEmployee?.[employee.id]?.days[String(day)]
                }
              />
            )}
          />
        </div>
      </div>
      <DragOverlay dropAnimation={null} />
    </DndContext>
  );
}
