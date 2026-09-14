import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  isMondayDate,
  defaultRegistrationWindow,
  formatWeekRange,
} from "../lib/week";
import {
  addScheduleEntry,
  addScheduleWeek,
  clearScheduleWeek,
  listGroups,
  listScheduleEntries,
  listScheduleAvailability,
  listScheduleWeeks,
  listSchedulerEmployees,
  listShiftTypes,
  patchScheduleEntry,
  patchScheduleWeek,
  removeScheduleEntry,
} from "../scheduling/api";
import { exportScheduleJpg } from "../scheduling/exportJpg";
import { findScheduleIssues, getEntryIssue } from "../scheduling/overlap";
import {
  periodCounts,
  staffingStatusForShiftCount,
  type StaffingPeriod,
} from "../scheduling/staffing";
import type {
  ScheduleEntry,
  ScheduleWeek,
  ShiftType,
} from "../scheduling/types";
import { ScheduleGrid } from "./ScheduleGrid";
import { ScheduleSheet } from "../scheduling/ScheduleSheet";
import { employeesForSchedule } from "../scheduling/scheduleSheetModel";
import type { Availability } from "../types/domain";

type EntryEditorProps = {
  entry: ScheduleEntry;
  shifts: ShiftType[];
  entries: ScheduleEntry[];
  saving: boolean;
  onClose: () => void;
  onSave: (entry: ScheduleEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function EntryEditor({
  entry,
  shifts,
  entries,
  saving,
  onClose,
  onSave,
  onDelete,
}: EntryEditorProps) {
  const [draft, setDraft] = useState(entry);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const issue = getEntryIssue(draft, entries, shifts);
    if (issue)
      return setError(
        issue.kind === "overlap"
          ? "Ca này bị trùng giờ với một ca khác."
          : issue.message,
      );
    try {
      await onSave(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được ca.");
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="entry-dialog">
        <header>
          <h2>Chỉnh sửa ca</h2>
          <button className="icon-button" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="dialog-content">
          <label className="field">
            Loại ca
            <select
              value={draft.shiftTypeId}
              onChange={(e) =>
                setDraft({ ...draft, shiftTypeId: e.target.value })
              }
            >
              {shifts.map((shift) => (
                <option value={shift.id} key={shift.id}>
                  {shift.label}
                </option>
              ))}
            </select>
          </label>
          <div className="time-pair">
            <label>
              Giờ bắt đầu
              <input
                type="time"
                value={draft.customStart ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, customStart: e.target.value || null })
                }
              />
            </label>
            <label>
              Giờ kết thúc
              <input
                type="time"
                value={draft.customEnd ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, customEnd: e.target.value || null })
                }
              />
            </label>
          </div>
          <label className="field">
            Nhãn tùy chỉnh / ca gãy
            <input
              placeholder="10:00-14:00/18:00-23:00"
              value={draft.customLabel ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, customLabel: e.target.value || null })
              }
            />
          </label>
          {error && <div className="inline-error">{error}</div>}
        </div>
        <footer>
          <button
            className="button ghost danger"
            disabled={saving}
            onClick={() => void onDelete(entry.id)}
          >
            Xóa ca
          </button>
          <div>
            <button className="button secondary" onClick={onClose}>
              Hủy
            </button>
            <button
              className="button primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function AdminScheduler() {
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof listGroups>>>(
    [],
  );
  const [employees, setEmployees] = useState<
    Awaited<ReturnType<typeof listSchedulerEmployees>>
  >([]);
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [weeks, setWeeks] = useState<ScheduleWeek[]>([]);
  const [weekId, setWeekId] = useState("");
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [availabilityByEmployee, setAvailabilityByEmployee] = useState<
    Record<string, Availability>
  >({});
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [newWeekStart, setNewWeekStart] = useState(
    defaultRegistrationWindow().weekStart,
  );

  const loadBase = useCallback(async () => {
    const [nextGroups, nextEmployees, nextShifts, nextWeeks] =
      await Promise.all([
        listGroups(),
        listSchedulerEmployees(),
        listShiftTypes(),
        listScheduleWeeks(),
      ]);
    setGroups(nextGroups);
    setEmployees(nextEmployees);
    setShifts(nextShifts);
    setWeeks(nextWeeks);
    setWeekId((current) =>
      current && nextWeeks.some((week) => week.id === current)
        ? current
        : (nextWeeks[0]?.id ?? ""),
    );
  }, []);
  useEffect(() => {
    loadBase().catch((reason) => setError(reason.message));
  }, [loadBase]);
  const week = weeks.find((item) => item.id === weekId) ?? null;
  const loadEntries = useCallback(
    async () => setEntries(weekId ? await listScheduleEntries(weekId) : []),
    [weekId],
  );
  const loadAvailability = useCallback(async () => {
    if (!week) return setAvailabilityByEmployee({});
    const submissions = await listScheduleAvailability(week.weekStart);
    setAvailabilityByEmployee(
      Object.fromEntries(
        submissions.map((submission) => [
          submission.employee_id,
          submission.availability,
        ]),
      ),
    );
  }, [week]);
  useEffect(() => {
    Promise.all([loadEntries(), loadAvailability()]).catch((reason) =>
      setError(reason.message),
    );
  }, [loadAvailability, loadEntries]);

  const editable = week?.status === "draft";
  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.active &&
          (groupFilter === "all" || employee.groupId === groupFilter) &&
          employee.name
            .toLocaleLowerCase("vi")
            .includes(search.trim().toLocaleLowerCase("vi")),
      ),
    [employees, groupFilter, search],
  );
  const scheduleEmployees = useMemo(
    () => employeesForSchedule(employees, entries),
    [employees, entries],
  );
  const counts = periodCounts(entries, shifts);

  function issueMessage(candidate: ScheduleEntry): string | null {
    const issue = getEntryIssue(candidate, entries, shifts);
    return issue
      ? issue.kind === "overlap"
        ? "Không thể xếp ca: ca này bị trùng giờ."
        : issue.message
      : null;
  }

  async function assign(
    employeeId: string,
    dayOfWeek: number,
    requestedShiftId?: string,
  ) {
    const shiftId = requestedShiftId ?? selectedShiftId;
    if (!week || !editable || !shiftId || busy) return;
    const candidate: ScheduleEntry = {
      id: crypto.randomUUID(),
      scheduleWeekId: week.id,
      employeeId,
      dayOfWeek,
      shiftTypeId: shiftId,
      customStart: null,
      customEnd: null,
      customLabel: null,
      sortOrderInCell: entries.filter(
        (item) =>
          item.employeeId === employeeId && item.dayOfWeek === dayOfWeek,
      ).length,
    };
    const issue = issueMessage(candidate);
    if (issue) return setError(issue);
    setBusy(true);
    setError(null);
    try {
      const { id: _id, ...payload } = candidate;
      void _id;
      await addScheduleEntry(payload);
      await loadEntries();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thêm được ca.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function move(
    entry: ScheduleEntry,
    employeeId: string,
    dayOfWeek: number,
  ) {
    if (
      !editable ||
      busy ||
      (entry.employeeId === employeeId && entry.dayOfWeek === dayOfWeek)
    )
      return;
    const candidate = { ...entry, employeeId, dayOfWeek };
    const issue = issueMessage(candidate);
    if (issue) return setError(issue);
    setBusy(true);
    try {
      await patchScheduleEntry(candidate);
      await loadEntries();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không di chuyển được ca.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry(entry: ScheduleEntry) {
    setBusy(true);
    try {
      await patchScheduleEntry(entry);
      await loadEntries();
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    setBusy(true);
    try {
      await removeScheduleEntry(id);
      await loadEntries();
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  async function createWeek(event: FormEvent) {
    event.preventDefault();
    if (!isMondayDate(newWeekStart))
      return setError("Ngày bắt đầu tuần phải là Thứ 2.");
    setBusy(true);
    try {
      await addScheduleWeek(newWeekStart);
      await loadBase();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không tạo được tuần.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "draft" | "published" | "archived") {
    if (!week) return;
    if (status === "published") {
      if (findScheduleIssues(entries, shifts).length > 0) {
        setError(
          "Không thể công bố vì lịch còn ca bị trùng hoặc thiếu thông tin hợp lệ.",
        );
        return;
      }
    }
    setBusy(true);
    try {
      await patchScheduleWeek(week.id, {
        status,
        ...(status === "published"
          ? { publishedAt: new Date().toISOString() }
          : {}),
      });
      await loadBase();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không cập nhật được lịch.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setOverride(day: number, period: StaffingPeriod, raw: string) {
    if (!week || !editable) return;
    const next = { ...week.countOverrides };
    const key = `${day}:${period}`;
    if (raw.trim() === "") delete next[key];
    else next[key] = Math.max(0, Number(raw) || 0);
    try {
      await patchScheduleWeek(week.id, { countOverrides: next });
      await loadBase();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không lưu được tổng ca.",
      );
    }
  }

  return (
    <div className="scheduler-page">
      <section className="panel scheduler-toolbar">
        <div>
          <span className="eyebrow">Xếp lịch chính thức</span>
          <h2>
            {week
              ? `Tuần ${formatWeekRange(week.weekStart)}`
              : "Chưa có tuần xếp lịch"}
          </h2>
        </div>
        <div className="schedule-actions">
          {week && (
            <>
              <span
                className={`status-badge ${week.status === "published" ? "open" : week.status === "draft" ? "locked" : "archived"}`}
              >
                {week.status === "published"
                  ? "Đã công bố"
                  : week.status === "draft"
                    ? "Bản nháp"
                    : "Đã lưu trữ"}
              </span>
              {week.status === "published" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void setStatus("draft")}
                >
                  Bắt đầu chỉnh sửa
                </button>
              )}
              {week.status === "draft" && (
                <button
                  className="button primary"
                  disabled={busy || entries.length === 0}
                  onClick={() => void setStatus("published")}
                >
                  Công bố lịch
                </button>
              )}
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void exportScheduleJpg(
                    "cloud-schedule-export",
                    week.weekStart,
                  ).catch((reason) => setError(reason.message))
                }
              >
                Xuất JPG
              </button>
              {week.status !== "archived" && (
                <button
                  className="button ghost"
                  disabled={busy}
                  onClick={() => void setStatus("archived")}
                >
                  Archive
                </button>
              )}
            </>
          )}
        </div>
      </section>
      <section className="panel scheduler-filters">
        <select value={weekId} onChange={(e) => setWeekId(e.target.value)}>
          <option value="">Chọn tuần</option>
          {weeks.map((item) => (
            <option key={item.id} value={item.id}>
              {formatWeekRange(item.weekStart)} · {item.status}
            </option>
          ))}
        </select>
        <input
          placeholder="Tìm nhân viên"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="all">Tất cả nhóm</option>
          {groups.map((group) => (
            <option value={group.id} key={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void Promise.all([loadBase(), loadEntries(), loadAvailability()]).catch(
              (reason) => setError(reason.message),
            )
          }
        >
          Làm mới
        </button>
        <form
          className="new-schedule-week"
          onSubmit={(event) => void createWeek(event)}
        >
          <input
            type="date"
            required
            value={newWeekStart}
            onChange={(e) => setNewWeekStart(e.target.value)}
          />
          <button className="button secondary" disabled={busy}>
            Tạo tuần
          </button>
        </form>
        {editable && (
          <button
            className="button ghost danger"
            disabled={busy || entries.length === 0}
            onClick={() => {
              if (window.confirm("Xóa toàn bộ ca của tuần này?"))
                void clearScheduleWeek(weekId)
                  .then(loadEntries)
                  .catch((reason) => setError(reason.message));
            }}
          >
            Xóa lịch tuần
          </button>
        )}
      </section>
      {error && (
        <div className="inline-error scheduler-error" role="alert">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      {week ? (
        <>
          <ScheduleGrid
            groups={groups}
            employees={filteredEmployees}
            entries={entries}
            shifts={shifts}
            weekStart={week.weekStart}
            editable={editable}
            selectedShiftId={selectedShiftId}
            onSelectShift={setSelectedShiftId}
            onAssign={(employeeId, day, shiftId) =>
              void assign(employeeId, day, shiftId)
            }
            onMove={(entry, employeeId, day) =>
              void move(entry, employeeId, day)
            }
            onEdit={(entry) => editable && setEditing(entry)}
            availabilityByEmployee={availabilityByEmployee}
          />
          <div className="schedule-export-stage" aria-hidden="true">
            <ScheduleSheet
              id="cloud-schedule-export"
              groups={groups}
              employees={scheduleEmployees}
              entries={entries}
              shifts={shifts}
              weekStart={week.weekStart}
              countOverrides={week.countOverrides}
              showStaffing
            />
          </div>
          <section className="staffing-summary">
            {counts.map((automatic, index) => {
              const total = entries.filter(
                (entry) => entry.dayOfWeek === index + 1,
              ).length;
              const status = staffingStatusForShiftCount(total);
              return (
                <article key={index}>
                  <strong>{index === 6 ? "CN" : `T${index + 2}`}</strong>
                  {(["S", "T", "Đ"] as StaffingPeriod[]).map((period) => (
                    <label key={period}>
                      {period}
                      <input
                        type="number"
                        min="0"
                        disabled={!editable}
                        defaultValue={
                          week.countOverrides[`${index + 1}:${period}`] ??
                          automatic[period]
                        }
                        onBlur={(e) =>
                          void setOverride(index + 1, period, e.target.value)
                        }
                      />
                    </label>
                  ))}
                  <span className={`staffing-indicator ${status}`}>
                    {total} ca
                  </span>
                </article>
              );
            })}
          </section>
        </>
      ) : (
        <div className="panel empty-panel">Tạo tuần xếp lịch để bắt đầu.</div>
      )}
      {editing && (
        <EntryEditor
          entry={editing}
          shifts={shifts}
          entries={entries}
          saving={busy}
          onClose={() => setEditing(null)}
          onSave={saveEntry}
          onDelete={deleteEntry}
        />
      )}
    </div>
  );
}
