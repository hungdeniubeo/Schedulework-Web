import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { CustomSelect } from "../components/CustomSelect";
import { ModalBackdrop } from "../components/ModalBackdrop";
import {
  isMondayDate,
  defaultRegistrationWindow,
  formatWeekRange,
} from "../lib/week";
import {
  addScheduleEntry,
  addScheduleWeek,
  clearScheduleWeek,
  consolidateScheduleEntry,
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
import { consolidateCellEntry } from "../scheduling/merge";
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
import { availabilityByEmployee as mapAvailabilityByEmployee } from "../lib/availability";

type EntryEditorProps = {
  entry: ScheduleEntry;
  shifts: ShiftType[];
  entries: ScheduleEntry[];
  saving: boolean;
  onClose: () => void;
  onSave: (entry: ScheduleEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function EntryEditor({
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
    <ModalBackdrop onClose={onClose}>
      <section
        className="entry-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-editor-title"
      >
        <header>
          <h2 id="entry-editor-title">Chỉnh sửa ca</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Đóng"
            autoFocus
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="dialog-content">
          <div className="field">
            <span>Loại ca</span>
            <CustomSelect
              ariaLabel="Loại ca"
              value={draft.shiftTypeId}
              options={shifts.map((shift) => ({
                value: shift.id,
                label: shift.label,
              }))}
              onChange={(shiftTypeId) => setDraft({ ...draft, shiftTypeId })}
            />
          </div>
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
            type="button"
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
    </ModalBackdrop>
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
  const [weekDataLoading, setWeekDataLoading] = useState(false);
  const entriesRequest = useRef(0);
  const availabilityRequest = useRef(0);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
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
  const weekStart = week?.weekStart ?? "";
  const loadEntries = useCallback(async () => {
    const request = ++entriesRequest.current;
    const nextEntries = weekId ? await listScheduleEntries(weekId) : [];
    if (request === entriesRequest.current) setEntries(nextEntries);
  }, [weekId]);
  const loadAvailability = useCallback(async () => {
    const request = ++availabilityRequest.current;
    const submissions = weekStart
      ? await listScheduleAvailability(weekStart)
      : [];
    if (request === availabilityRequest.current) {
      setAvailabilityByEmployee(mapAvailabilityByEmployee(submissions));
    }
  }, [weekStart]);
  useEffect(() => {
    let active = true;
    setEntries([]);
    setAvailabilityByEmployee({});
    setWeekDataLoading(Boolean(weekId));
    Promise.all([loadEntries(), loadAvailability()])
      .catch((reason) => active && setError(reason.message))
      .finally(() => active && setWeekDataLoading(false));
    return () => {
      active = false;
      entriesRequest.current += 1;
      availabilityRequest.current += 1;
    };
  }, [loadAvailability, loadEntries]);

  const editable = week?.status === "draft" && !weekDataLoading;
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
      const inCell = entries.filter(
        (entry) =>
          entry.employeeId === employeeId && entry.dayOfWeek === dayOfWeek,
      );
      if (inCell.length > 0) {
        const keeper = inCell[0];
        const merged = {
          ...consolidateCellEntry(candidate, inCell, shifts),
          id: keeper.id,
        };
        await consolidateScheduleEntry(
          merged,
          inCell.slice(1).map((entry) => entry.id),
        );
      } else {
        const { id: _id, ...payload } = candidate;
        void _id;
        await addScheduleEntry(payload);
      }
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
      const inTargetCell = entries.filter(
        (item) =>
          item.id !== entry.id &&
          item.employeeId === employeeId &&
          item.dayOfWeek === dayOfWeek,
      );
      if (inTargetCell.length > 0) {
        const merged = consolidateCellEntry(candidate, inTargetCell, shifts);
        await consolidateScheduleEntry(
          merged,
          inTargetCell.map((item) => item.id),
        );
      } else {
        await patchScheduleEntry(candidate);
      }
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

  async function clearWeekEntries() {
    if (!week || busy || !editable) return;
    setBusy(true);
    setError(null);
    try {
      await clearScheduleWeek(week.id);
      await loadEntries();
      setConfirmingClear(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không xóa được lịch tuần.",
      );
      setConfirmingClear(false);
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
                  disabled={busy || weekDataLoading}
                  onClick={() => void setStatus("draft")}
                >
                  Bắt đầu chỉnh sửa
                </button>
              )}
              {week.status === "draft" && (
                <button
                  className="button primary"
                  disabled={busy || weekDataLoading || entries.length === 0}
                  onClick={() => void setStatus("published")}
                >
                  Công bố lịch
                </button>
              )}
              <button
                className="button secondary"
                disabled={busy || weekDataLoading}
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
                  disabled={busy || weekDataLoading}
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
        <CustomSelect
          ariaLabel="Tuần xếp lịch"
          value={weekId}
          disabled={busy || weekDataLoading}
          options={[
            { value: "", label: "Chọn tuần" },
            ...weeks.map((item) => ({
              value: item.id,
              label: `${formatWeekRange(item.weekStart)} · ${item.status}`,
            })),
          ]}
          onChange={(nextWeekId) => {
            setWeekDataLoading(true);
            setEntries([]);
            setAvailabilityByEmployee({});
            setWeekId(nextWeekId);
          }}
        />
        <input
          aria-label="Tìm nhân viên"
          placeholder="Tìm nhân viên"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <CustomSelect
          ariaLabel="Lọc theo nhóm"
          value={groupFilter}
          options={[
            { value: "all", label: "Tất cả nhóm" },
            ...groups.map((group) => ({
              value: group.id,
              label: group.name,
            })),
          ]}
          onChange={setGroupFilter}
        />
        <button
          type="button"
          className="button secondary"
          disabled={busy || weekDataLoading}
          onClick={() => {
            setWeekDataLoading(true);
            void Promise.all([loadBase(), loadEntries(), loadAvailability()])
              .catch((reason) => setError(reason.message))
              .finally(() => setWeekDataLoading(false));
          }}
        >
          Làm mới
        </button>
        <form
          className="new-schedule-week"
          onSubmit={(event) => void createWeek(event)}
        >
          <input
            aria-label="Thứ 2 bắt đầu tuần xếp lịch"
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
            type="button"
            disabled={busy || entries.length === 0}
            onClick={() => setConfirmingClear(true)}
          >
            Xóa lịch tuần
          </button>
        )}
      </section>
      {error && (
        <div className="inline-error scheduler-error" role="alert">
          {error}
          <button
            type="button"
            aria-label="Đóng thông báo lỗi"
            onClick={() => setError(null)}
          >
            ×
          </button>
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
      {confirmingClear && (
        <ModalBackdrop onClose={() => setConfirmingClear(false)}>
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-week-title"
            aria-describedby="clear-week-description"
          >
            <header>
              <h2 id="clear-week-title">Xóa lịch tuần?</h2>
            </header>
            <p id="clear-week-description">
              Toàn bộ ca đã xếp trong tuần này sẽ bị xóa. Thao tác này không thể
              hoàn tác.
            </p>
            <footer>
              <button
                className="button secondary"
                type="button"
                autoFocus
                onClick={() => setConfirmingClear(false)}
              >
                Hủy
              </button>
              <button
                className="button ghost danger"
                type="button"
                disabled={busy}
                onClick={() => void clearWeekEntries()}
              >
                {busy ? "Đang xóa..." : "Xóa lịch tuần"}
              </button>
            </footer>
          </section>
        </ModalBackdrop>
      )}
    </div>
  );
}
