import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import "./AdminSchedule.css";
import { CloseIcon, TrashIcon } from "../components/Icons";
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
import type { StaffingPeriod } from "../scheduling/staffing";

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
      className={`scheduler-shift ${selected ? "selected" : ""} ${drag.isDragging ? "dragging" : ""}`}
      disabled={disabled}
      onClick={onSelect}
      {...drag.listeners}
      {...drag.attributes}
      aria-pressed={selected}
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
  employeeName,
  onEdit,
  onDelete,
}: {
  entry: ScheduleEntry;
  shifts: ShiftType[];
  editable: boolean;
  employeeName: string;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const shift = shifts.find((item) => item.id === entry.shiftTypeId);
  const label = entryLabel(entry, shifts);
  const drag = useDraggable({
    id: `entry:${entry.id}`,
    data: { kind: "entry", entry },
    disabled: !editable,
  });
  return (
    <div
      ref={drag.setNodeRef}
      className={`schedule-entry-wrap ${drag.isDragging ? "dragging" : ""}`}
      style={{
        transform: CSS.Translate.toString(drag.transform),
      }}
    >
      <button
        type="button"
        className="schedule-entry-chip"
        style={shiftStyle(
          resolvedShiftColor(
            label,
            shift?.color ?? "#A6A6A6",
            Boolean(
              entry.customLabel || entry.customStart || entry.customEnd,
            ),
          ),
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (editable) onEdit();
        }}
        {...drag.listeners}
        {...drag.attributes}
      >
        {formatShiftLabel(label)}
      </button>
      {editable && onDelete && (
        <button
          type="button"
          className="schedule-entry-delete"
          aria-label={`Xóa ca ${formatShiftLabel(label)} của ${employeeName}`}
          title="Xóa ca chính thức"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.();
          }}
        >
          <CloseIcon />
        </button>
      )}
    </div>
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
  onDelete,
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
  onDelete?: (entry: ScheduleEntry) => void;
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
      className={`${drop.isOver ? "drag-over" : ""} ${assignable ? "assignable" : ""} ${availability ? "has-availability" : ""} ${entries.length > 0 ? "has-official-shift" : ""}`}
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
      <div className="schedule-cell-stack">
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
              employeeName={employee.name}
              onEdit={() => onEdit(entry)}
              onDelete={onDelete ? () => onDelete(entry) : undefined}
            />
          ))}
        </div>
      </div>
    </td>
  );
}

function ScheduleTrash({
  enabled,
  active,
}: {
  enabled: boolean;
  active: boolean;
}) {
  const drop = useDroppable({
    id: "schedule-trash",
    disabled: !enabled,
  });

  if (!enabled) return null;

  return (
    <div
      ref={drop.setNodeRef}
      className={`schedule-trash-zone ${active ? "active" : ""} ${drop.isOver ? "drag-over" : ""}`}
      aria-label="Thả ca chính thức vào đây để xóa"
    >
      <TrashIcon />
      <span>Thả ca đã xếp vào đây để xóa</span>
    </div>
  );
}

type ActiveDrag =
  | { kind: "palette"; shiftId: string }
  | { kind: "entry"; entry: ScheduleEntry };

const scheduleCollisionDetection: CollisionDetection = (args) =>
  pointerWithin(args).filter((collision) => {
    const id = String(collision.id);
    return id.startsWith("cell:") || id === "schedule-trash";
  });

function DragPreview({
  active,
  shifts,
}: {
  active: ActiveDrag | null;
  shifts: ShiftType[];
}) {
  if (!active) return null;
  const entry = active.kind === "entry" ? active.entry : null;
  const shiftId =
    entry?.shiftTypeId ?? (active.kind === "palette" ? active.shiftId : "");
  const shift = shifts.find((item) => item.id === shiftId);
  const label = entry ? entryLabel(entry, shifts) : (shift?.label ?? "");
  const color = resolvedShiftColor(
    label,
    shift?.color ?? "#A6A6A6",
    Boolean(entry?.customLabel || entry?.customStart || entry?.customEnd),
  );

  return (
    <div className="schedule-drag-preview" style={shiftStyle(color)}>
      <span aria-hidden="true" />
      {formatShiftLabel(label)}
    </div>
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
  onDelete?: (entry: ScheduleEntry) => void;
  availabilityByEmployee?: Record<string, Availability>;
  countOverrides?: Record<string, number>;
  onSetCountOverride?: (
    day: number,
    period: StaffingPeriod,
    value: string,
  ) => void;
};

export function ScheduleGrid(props: Props) {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const selectedShift = props.shifts.find(
    (shift) => shift.id === props.selectedShiftId,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function dragStart(event: DragStartEvent) {
    const source = event.active.data.current as ActiveDrag | undefined;
    setActiveDrag(source ?? null);
  }

  function dragCancel(_event: DragCancelEvent) {
    setActiveDrag(null);
  }

  function dragEnd(event: DragEndEvent) {
    const target = event.over?.data.current as
      | { employeeId?: string; day?: number }
      | undefined;
    const source = event.active.data.current as
      | { kind?: string; shiftId?: string; entry?: ScheduleEntry }
      | undefined;
    setActiveDrag(null);
    if (event.over?.id === "schedule-trash") {
      if (source?.kind === "entry" && source.entry)
        props.onDelete?.(source.entry);
      return;
    }
    if (!target?.employeeId || !target.day || !source) return;
    if (source.kind === "palette" && source.shiftId)
      props.onAssign(target.employeeId, target.day, source.shiftId);
    if (source.kind === "entry" && source.entry)
      props.onMove(source.entry, target.employeeId, target.day);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={scheduleCollisionDetection}
      measuring={{
        droppable: { strategy: MeasuringStrategy.BeforeDragging },
      }}
      onDragStart={dragStart}
      onDragCancel={dragCancel}
      onDragEnd={dragEnd}
    >
      <div
        className={`scheduler-layout ${activeDrag ? "is-dragging" : ""}`}
      >
        <aside className="scheduler-palette">
          <header className="scheduler-palette-heading">
            <span className="scheduler-palette-kicker">Công cụ xếp lịch</span>
            <h3>Ca làm</h3>
            <p>
              {props.editable
                ? "Chọn một ca để xếp nhanh hoặc kéo vào bảng."
                : "Tuần này đang khóa chỉnh sửa."}
            </p>
          </header>
          {selectedShift && (
            <div
              className="scheduler-selection-status"
              style={shiftStyle(
                resolvedShiftColor(selectedShift.label, selectedShift.color),
              )}
            >
              <span>Đang chọn để xếp nhanh</span>
              <strong>{formatShiftLabel(selectedShift.label)}</strong>
              <button
                type="button"
                aria-label="Bỏ chọn ca"
                onClick={() => props.onSelectShift(null)}
              >
                <CloseIcon />
              </button>
            </div>
          )}
          <div className="scheduler-shift-list">
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
          </div>
          <ScheduleTrash
            enabled={props.editable && Boolean(props.onDelete)}
            active={activeDrag?.kind === "entry"}
          />
        </aside>
        <div className="schedule-table-scroll">
          <ScheduleSheet
            id="cloud-schedule-sheet"
            groups={props.groups}
            employees={props.employees}
            entries={props.entries}
            shifts={props.shifts}
            weekStart={props.weekStart}
            countOverrides={props.countOverrides}
            renderStaffingCell={props.onSetCountOverride
              ? (day, period, value) => (
                  <input
                    key={`${day}:${period}:${value}`}
                    className="staffing-count-input"
                    type="number"
                    min="0"
                    disabled={!props.editable}
                    defaultValue={value}
                    aria-label={`Tổng ca ${period === "S" ? "Sáng" : period === "T" ? "Trưa" : "Tối"} ngày ${day}`}
                    title="Nhập số để chỉnh tay; xóa trắng để dùng số tự động"
                    onBlur={(event) =>
                      props.onSetCountOverride?.(
                        day,
                        period,
                        event.currentTarget.value,
                      )
                    }
                  />
                )
              : undefined}
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
                onDelete={props.onDelete}
                availability={
                  props.availabilityByEmployee?.[employee.id]?.days[String(day)]
                }
              />
            )}
          />
        </div>
      </div>
      <DragOverlay
        dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}
      >
        <DragPreview active={activeDrag} shifts={props.shifts} />
      </DragOverlay>
    </DndContext>
  );
}
