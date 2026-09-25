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
import { useEffect, useState, type ReactNode } from "react";
import "./AdminSchedule.css";
import { CloseIcon, TrashIcon } from "../components/Icons";
import {
  formatAvailabilityCell,
  getOffReason,
} from "../lib/availability";
import { findExactShiftForAvailability } from "../scheduling/availabilityShiftMatch";
import { entryLabel, getEntryIssue } from "../scheduling/overlap";
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
import type { Availability } from "../types/domain";
import { ScheduleDailySummary } from "./ScheduleDailySummary";
import { SchedulerTable } from "./SchedulerTable";
import {
  previewEntryForCell,
  resolveSchedulerDrop,
  type SchedulerDragData,
  type SchedulerDropData,
} from "./schedulerDnd";

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
    data: { kind: "palette", shiftId: shift.id } satisfies SchedulerDragData,
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
          .map((part, index) => (
            <span key={`${part}-${index}`}>{part}</span>
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
    data: { kind: "entry", entry } satisfies SchedulerDragData,
    disabled: !editable,
  });
  return (
    <div
      ref={drag.setNodeRef}
      className={`schedule-entry-wrap ${drag.isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(drag.transform) }}
    >
      <button
        type="button"
        className="schedule-entry-chip"
        style={shiftStyle(
          resolvedShiftColor(
            label,
            shift?.color ?? "#A6A6A6",
            Boolean(entry.customLabel || entry.customStart || entry.customEnd),
          ),
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (editable) onEdit();
        }}
        {...drag.listeners}
        {...drag.attributes}
      >
        {formatShiftLabel(label)
          .split(" / ")
          .map((part, index) => (
            <span key={`${part}-${index}`}>{part}</span>
          ))}
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
            onDelete();
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
  activeDrag,
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
  activeDrag: SchedulerDragData | null;
  onAssign: (employeeId: string, day: number) => void;
  onEdit: (entry: ScheduleEntry) => void;
  onDelete?: (entry: ScheduleEntry) => void;
  availability?: Availability["days"][string];
}) {
  const drop = useDroppable({
    id: `cell:${employee.id}:${day}`,
    data: {
      kind: "cell",
      employeeId: employee.id,
      day,
    } satisfies SchedulerDropData,
    disabled: !editable,
  });
  const assignable = Boolean(selectedShiftId && editable);
  const availabilityLabel = availability
    ? formatAvailabilityCell(availability)
    : "";
  const offReason = availability ? getOffReason(availability) : "";
  const matchedShift = availability
    ? findExactShiftForAvailability(availability, shifts)
    : null;
  const registrationLabel = matchedShift
    ? formatShiftLabel(matchedShift.label)
    : availabilityLabel;
  const registrationKind = !availability
    ? null
    : availability.status === "off"
      ? "off"
      : matchedShift
        ? "matched"
        : "neutral";
  const previewEntry = drop.isOver
    ? previewEntryForCell(activeDrag ?? undefined, employee.id, day)
    : null;
  const blocked = previewEntry
    ? getEntryIssue(previewEntry, entries, shifts)
    : null;
  const dropStateClass = drop.isOver
    ? blocked
      ? "drop-blocked"
      : "drag-over"
    : "";
  const blockedLabel = blocked
    ? blocked.kind === "overlap"
      ? "Trùng giờ"
      : "Giờ chưa hợp lệ"
    : "";

  return (
    <td
      ref={drop.setNodeRef}
      className={`${dropStateClass} ${assignable ? "assignable" : ""} ${availability ? "has-availability" : ""} ${entries.length > 0 ? "has-official-shift" : ""}`}
      role={assignable ? "button" : undefined}
      tabIndex={assignable ? 0 : undefined}
      title={blocked ? blockedLabel : undefined}
      aria-label={
        assignable ? `Xếp ca cho ${employee.name}, ngày ${day}` : undefined
      }
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
        {availability && registrationKind && (
          <details
            className={`availability-detail ${registrationKind}`}
            onClick={(event) => event.stopPropagation()}
          >
            <summary
              className={`availability-hint ${registrationKind}`}
              style={
                matchedShift
                  ? shiftStyle(
                      resolvedShiftColor(
                        matchedShift.label,
                        matchedShift.color,
                      ),
                    )
                  : undefined
              }
            >
              <span>ĐK</span> · {registrationLabel}
            </summary>
            <div className="availability-popover">
              <strong>Đăng ký của nhân viên</strong>
              <span>{availabilityLabel}</span>
              {matchedShift && (
                <small>Khớp ca: {formatShiftLabel(matchedShift.label)}</small>
              )}
              {offReason && <small>Lý do: {offReason}</small>}
            </div>
          </details>
        )}
      </div>
      {drop.isOver && blocked && (
        <span className="schedule-drop-message">{blockedLabel}</span>
      )}
    </td>
  );
}

function ScheduleTrash({ enabled, active }: { enabled: boolean; active: boolean }) {
  const drop = useDroppable({
    id: "schedule-trash",
    data: { kind: "trash" } satisfies SchedulerDropData,
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

function EmployeeDragHeader({
  employee,
  groupId,
  areaClass,
  editable,
}: {
  employee: CloudEmployee;
  groupId: string;
  areaClass: string;
  editable: boolean;
}) {
  const drag = useDraggable({
    id: `employee:${employee.id}`,
    data: {
      kind: "employee",
      employeeId: employee.id,
      employeeName: employee.name,
      groupId,
    } satisfies SchedulerDragData,
    disabled: !editable,
  });

  return (
    <div className="schedule-employee-identity">
      <button
        ref={drag.setNodeRef}
        type="button"
        className="schedule-employee-drag-handle"
        disabled={!editable}
        title={editable ? "Kéo để sắp xếp nhân viên" : undefined}
        aria-label={`Kéo ${employee.name} để sắp xếp`}
        {...drag.listeners}
        {...drag.attributes}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <span
        className={`scheduler-employee-dot ${areaClass}`}
        aria-hidden="true"
      />
      <span className="schedule-employee-copy">
        <strong className="schedule-employee-name">{employee.name}</strong>
        {employee.positionName && (
          <small className="schedule-employee-position">
            {employee.positionName}
          </small>
        )}
      </span>
      {employee.isNew && <small className="schedule-new-badge">NEW</small>}
    </div>
  );
}

function EmployeeDropRow({
  employee,
  group,
  areaClass,
  editable,
  children,
}: {
  employee: CloudEmployee;
  group: Group;
  areaClass: string;
  editable: boolean;
  children: ReactNode;
}) {
  const drop = useDroppable({
    id: `employee-target:${employee.id}`,
    data: {
      kind: "employee",
      employeeId: employee.id,
      groupId: group.id,
    } satisfies SchedulerDropData,
    disabled: !editable,
  });
  return (
    <tr
      ref={drop.setNodeRef}
      className={`scheduler-employee-row ${areaClass} ${drop.isOver ? "employee-drop-target" : ""}`}
    >
      {children}
    </tr>
  );
}

function GroupDropRow({
  group,
  areaClass,
  editable,
  children,
}: {
  group: Group;
  areaClass: string;
  editable: boolean;
  children: ReactNode;
}) {
  const drop = useDroppable({
    id: `employee-group-target:${group.id}`,
    data: { kind: "group", groupId: group.id } satisfies SchedulerDropData,
    disabled: !editable,
  });
  return (
    <tr
      ref={drop.setNodeRef}
      className={`scheduler-group-row ${areaClass} ${drop.isOver ? "employee-group-drop-target" : ""}`}
    >
      {children}
    </tr>
  );
}

const scheduleCollisionDetection: CollisionDetection = (args) => {
  const employeeDrag = args.active.data.current?.kind === "employee";
  return pointerWithin(args).filter((collision) => {
    const id = String(collision.id);
    return employeeDrag
      ? id.startsWith("employee-target:") ||
          id.startsWith("employee-group-target:")
      : id.startsWith("cell:") || id === "schedule-trash";
  });
};

function DragPreview({
  active,
  shifts,
}: {
  active: SchedulerDragData | null;
  shifts: ShiftType[];
}) {
  if (!active) return null;
  if (active.kind === "employee") {
    return (
      <div className="employee-drag-preview">
        <span aria-hidden="true">⠿</span>
        <strong>{active.employeeName}</strong>
      </div>
    );
  }
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
  onMoveEmployee?: (
    employeeId: string,
    targetGroupId: string,
    beforeEmployeeId?: string,
  ) => void;
  onEdit: (entry: ScheduleEntry) => void;
  onDelete?: (entry: ScheduleEntry) => void;
  availabilityByEmployee?: Record<string, Availability>;
  sidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
};

export function ScheduleGrid(props: Props) {
  const [activeDrag, setActiveDrag] = useState<SchedulerDragData | null>(null);
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(true);
  const sidebarOpen = props.sidebarOpen ?? internalSidebarOpen;
  const setSidebarOpen = (open: boolean) => {
    if (props.onSidebarOpenChange) props.onSidebarOpenChange(open);
    else setInternalSidebarOpen(open);
  };
  const selectedShift = props.shifts.find(
    (shift) => shift.id === props.selectedShiftId,
  );
  const scheduledEmployeeCount = new Set(
    props.entries.map((entry) => entry.employeeId),
  ).size;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  useEffect(() => {
    const clearSelection = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onSelectShift(null);
    };
    window.addEventListener("keydown", clearSelection);
    return () => window.removeEventListener("keydown", clearSelection);
  }, [props.onSelectShift]);

  function dragStart(event: DragStartEvent) {
    const source = event.active.data.current as SchedulerDragData | undefined;
    setActiveDrag(source ?? null);
  }

  function dragCancel(_event: DragCancelEvent) {
    setActiveDrag(null);
  }

  function dragEnd(event: DragEndEvent) {
    const source = event.active.data.current as SchedulerDragData | undefined;
    const target = event.over?.data.current as SchedulerDropData | undefined;
    setActiveDrag(null);
    const action = resolveSchedulerDrop(source, target);
    if (!action) return;

    if (action.kind === "assign") {
      props.onAssign(action.employeeId, action.day, action.shiftId);
      return;
    }
    if (action.kind === "moveEntry") {
      props.onMove(action.entry, action.employeeId, action.day);
      return;
    }
    if (action.kind === "deleteEntry") {
      props.onDelete?.(action.entry);
      return;
    }
    props.onMoveEmployee?.(
      action.employeeId,
      action.targetGroupId,
      action.beforeEmployeeId,
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={scheduleCollisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
      onDragStart={dragStart}
      onDragCancel={dragCancel}
      onDragEnd={dragEnd}
    >
      <div
        className={`scheduler-workspace ${sidebarOpen ? "" : "sidebar-hidden"} ${activeDrag ? "is-dragging" : ""}`.trim()}
      >
        <section className="scheduler-table-column">
          <div className="scheduler-grid-tools">
            <button
              type="button"
              className="scheduler-sidebar-toggle"
              aria-label={
                sidebarOpen ? "Ẩn danh sách ca" : "Hiện danh sách ca"
              }
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <span aria-hidden="true">▦</span>
              Ca làm
            </button>
          </div>
          <div className="schedule-table-scroll">
            <SchedulerTable
              id="cloud-schedule-sheet"
              groups={props.groups}
              employees={props.employees}
              entries={props.entries}
              shifts={props.shifts}
              weekStart={props.weekStart}
              renderGroupRow={(group, areaClass, children) => (
                <GroupDropRow
                  group={group}
                  areaClass={areaClass}
                  editable={props.editable && Boolean(props.onMoveEmployee)}
                >
                  {children}
                </GroupDropRow>
              )}
              renderEmployeeRow={(employee, group, areaClass, children) => (
                <EmployeeDropRow
                  employee={employee}
                  group={group}
                  areaClass={areaClass}
                  editable={props.editable && Boolean(props.onMoveEmployee)}
                >
                  {children}
                </EmployeeDropRow>
              )}
              renderEmployeeHeader={(employee, areaClass) => (
                <EmployeeDragHeader
                  employee={employee}
                  groupId={employee.groupId ?? ""}
                  areaClass={areaClass}
                  editable={
                    props.editable &&
                    Boolean(props.onMoveEmployee) &&
                    Boolean(employee.groupId)
                  }
                />
              )}
              renderCell={(employee, day, cellEntries) => (
                <ScheduleCell
                  key={day}
                  employee={employee}
                  day={day}
                  entries={cellEntries}
                  shifts={props.shifts}
                  editable={props.editable}
                  selectedShiftId={props.selectedShiftId}
                  activeDrag={activeDrag}
                  onAssign={(employeeId, nextDay) =>
                    props.onAssign(employeeId, nextDay)
                  }
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                  availability={
                    props.availabilityByEmployee?.[employee.id]?.days[
                      String(day)
                    ]
                  }
                />
              )}
            />
            <ScheduleDailySummary
              weekStart={props.weekStart}
              entries={props.entries}
              shifts={props.shifts}
            />
          </div>
        </section>

        {sidebarOpen && (
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
              {props.shifts.length === 0 && (
                <small>Hãy tạo ca làm trước.</small>
              )}
            </div>
            <ScheduleTrash
              enabled={props.editable && Boolean(props.onDelete)}
              active={activeDrag?.kind === "entry"}
            />
            <section
              className="scheduler-week-overview"
              aria-label="Tổng quan tuần"
            >
              <strong className="scheduler-week-overview-title">
                Tổng quan tuần
              </strong>
              <div className="scheduler-week-overview-stats">
                <div>
                  <strong>{props.entries.length}</strong>
                  <span>ca đã xếp</span>
                </div>
                <div>
                  <strong>
                    {scheduledEmployeeCount}/{props.employees.length}
                  </strong>
                  <span>nhân viên có ca</span>
                </div>
              </div>
            </section>
          </aside>
        )}
      </div>
      <DragOverlay
        dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}
      >
        <DragPreview active={activeDrag} shifts={props.shifts} />
      </DragOverlay>
    </DndContext>
  );
}
