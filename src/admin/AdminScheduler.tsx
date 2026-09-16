import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CustomSelect } from "../components/CustomSelect";
import {
  AlertTriangleIcon,
  CheckIcon,
  CloseIcon,
  RefreshIcon,
} from "../components/Icons";
import { ModalBackdrop } from "../components/ModalBackdrop";
import { formatWeekDisplay } from "../lib/week";
import {
  addScheduleEntry,
  clearScheduleWeek,
  consolidateScheduleEntry,
  listGroups,
  listScheduleAvailability,
  listScheduleEntries,
  listScheduleWeeks,
  listSchedulerEmployees,
  listShiftTypes,
  patchScheduleEntry,
  patchScheduleWeek,
  removeScheduleEntry,
} from "../scheduling/api";
import { availabilityNoticeForEntry } from "../scheduling/availabilityNotice";
import { moveEmployeeLocally } from "../scheduling/employeeOrder";
import { reorderSchedulerEmployee } from "../scheduling/employeeReorderApi";
import { exportScheduleJpg } from "../scheduling/exportJpg";
import { consolidateCellEntry } from "../scheduling/merge";
import { findScheduleIssues, getEntryIssue } from "../scheduling/overlap";
import { ScheduleSheet } from "../scheduling/ScheduleSheet";
import { employeesForSchedule } from "../scheduling/scheduleSheetModel";
import { type StaffingPeriod } from "../scheduling/staffing";
import type {
  ScheduleEntry,
  ScheduleWeek,
  ScheduleWeekStatus,
  ShiftType,
} from "../scheduling/types";
import type { Availability } from "../types/domain";
import { availabilityByEmployee as mapAvailabilityByEmployee } from "../lib/availability";
import { ScheduleGrid } from "./ScheduleGrid";
import { EntryEditor } from "./ScheduleEntryEditor";

export { EntryEditor } from "./ScheduleEntryEditor";

export function scheduleWeekStatusLabel(status: ScheduleWeekStatus): string {
  if (status === "published") return "Đã công bố";
  if (status === "archived") return "Đã lưu trữ";
  return "Bản nháp";
}

export async function prepareScheduleWeekForEditing(
  week: ScheduleWeek,
  updateStatus: (id: string, status: ScheduleWeekStatus) => Promise<void>,
): Promise<ScheduleWeek> {
  if (week.status === "draft") return week;
  await updateStatus(week.id, "draft");
  return { ...week, status: "draft" };
}

type AdminSchedulerProps = {
  preferredWeekStart?: string;
  registrationWeekStarts?: string[];
  onWeekStartChange?: (weekStart: string) => void;
  onOpenAvailability?: () => void;
};

export function selectScheduleWeekId(
  weeks: ScheduleWeek[],
  currentId: string,
  preferredWeekStart = "",
): string {
  if (preferredWeekStart) {
    return weeks.find((week) => week.weekStart === preferredWeekStart)?.id ?? "";
  }
  return weeks.some((week) => week.id === currentId)
    ? currentId
    : (weeks[0]?.id ?? "");
}

export function AdminScheduler({
  preferredWeekStart = "",
  registrationWeekStarts = [],
  onWeekStartChange,
  onOpenAvailability,
}: AdminSchedulerProps = {}) {
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof listGroups>>>([]);
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
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const loadBase = useCallback(async () => {
    const [nextGroups, nextEmployees, nextShifts, nextWeeks] = await Promise.all([
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
      selectScheduleWeekId(nextWeeks, current, preferredWeekStart),
    );
  }, [preferredWeekStart]);

  useEffect(() => {
    loadBase().catch((reason) =>
      setError(
        reason instanceof Error ? reason.message : "Không tải được lịch xếp.",
      ),
    );
  }, [loadBase]);

  const week = weeks.find((item) => item.id === weekId) ?? null;
  const weekStart = week?.weekStart ?? "";

  useEffect(() => {
    if (weekStart) onWeekStartChange?.(weekStart);
  }, [onWeekStartChange, weekStart]);

  const loadEntries = useCallback(async () => {
    const request = ++entriesRequest.current;
    const nextEntries = weekId ? await listScheduleEntries(weekId) : [];
    if (request === entriesRequest.current) setEntries(nextEntries);
  }, [weekId]);

  const loadAvailability = useCallback(async () => {
    const request = ++availabilityRequest.current;
    const submissions = weekStart ? await listScheduleAvailability(weekStart) : [];
    if (request === availabilityRequest.current) {
      setAvailabilityByEmployee(mapAvailabilityByEmployee(submissions));
    }
  }, [weekStart]);

  useEffect(() => {
    let active = true;
    setEntries([]);
    setAvailabilityByEmployee({});
    setNotice(null);
    setWeekDataLoading(Boolean(weekId));
    Promise.all([loadEntries(), loadAvailability()])
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được dữ liệu lịch tuần.",
          );
        }
      })
      .finally(() => active && setWeekDataLoading(false));
    return () => {
      active = false;
      entriesRequest.current += 1;
      availabilityRequest.current += 1;
    };
  }, [loadAvailability, loadEntries, weekId]);

  const editable = Boolean(week && !weekDataLoading);
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
  const activeEmployeeIds = useMemo(
    () =>
      new Set(
        employees
          .filter((employee) => employee.active)
          .map((employee) => employee.id),
      ),
    [employees],
  );
  const availabilityCount = Object.keys(availabilityByEmployee).filter(
    (employeeId) => activeEmployeeIds.has(employeeId),
  ).length;
  const hasRegistrationWeek = week
    ? registrationWeekStarts.includes(week.weekStart)
    : false;

  async function ensureDraftWeek(): Promise<void> {
    if (!week) throw new Error("Chưa chọn tuần xếp lịch.");
    const nextWeek = await prepareScheduleWeekForEditing(week, (id, status) =>
      patchScheduleWeek(id, { status }),
    );
    if (nextWeek === week) return;
    setWeeks((current) =>
      current.map((item) => (item.id === nextWeek.id ? nextWeek : item)),
    );
  }

  function issueMessage(candidate: ScheduleEntry): string | null {
    const issue = getEntryIssue(candidate, entries, shifts);
    return issue
      ? issue.kind === "overlap"
        ? "Không thể xếp ca: ca này bị trùng giờ."
        : issue.message
      : null;
  }

  function updateAvailabilityNotice(entry: ScheduleEntry): void {
    const employee = employees.find((item) => item.id === entry.employeeId);
    if (!employee) {
      setNotice(null);
      return;
    }
    setNotice(
      availabilityNoticeForEntry(
        entry,
        employee,
        availabilityByEmployee[entry.employeeId]?.days[String(entry.dayOfWeek)],
        shifts,
      ),
    );
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
    if (issue) {
      setError(issue);
      return;
    }

    const previousEntries = entries;
    const inCell = entries.filter(
      (entry) =>
        entry.employeeId === employeeId && entry.dayOfWeek === dayOfWeek,
    );
    const optimisticEntry =
      inCell.length > 0
        ? {
            ...consolidateCellEntry(candidate, inCell, shifts),
            id: inCell[0].id,
          }
        : candidate;
    setEntries((current) => [
      ...current.filter(
        (entry) => !inCell.some((existing) => existing.id === entry.id),
      ),
      optimisticEntry,
    ]);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ensureDraftWeek();
      if (inCell.length > 0) {
        await consolidateScheduleEntry(
          optimisticEntry,
          inCell.slice(1).map((entry) => entry.id),
        );
      } else {
        const { id: _id, ...payload } = candidate;
        void _id;
        await addScheduleEntry(payload);
      }
      await loadEntries();
      updateAvailabilityNotice(optimisticEntry);
    } catch (reason) {
      setEntries(previousEntries);
      setError(reason instanceof Error ? reason.message : "Không thêm được ca.");
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
    ) {
      return;
    }
    const candidate = { ...entry, employeeId, dayOfWeek };
    const issue = issueMessage(candidate);
    if (issue) {
      setError(issue);
      return;
    }

    const previousEntries = entries;
    const inTargetCell = entries.filter(
      (item) =>
        item.id !== entry.id &&
        item.employeeId === employeeId &&
        item.dayOfWeek === dayOfWeek,
    );
    const optimisticEntry =
      inTargetCell.length > 0
        ? consolidateCellEntry(candidate, inTargetCell, shifts)
        : candidate;
    setEntries((current) => [
      ...current.filter(
        (item) =>
          item.id !== entry.id &&
          !inTargetCell.some((target) => target.id === item.id),
      ),
      optimisticEntry,
    ]);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ensureDraftWeek();
      if (inTargetCell.length > 0) {
        await consolidateScheduleEntry(
          optimisticEntry,
          inTargetCell.map((item) => item.id),
        );
      } else {
        await patchScheduleEntry(candidate);
      }
      await loadEntries();
      updateAvailabilityNotice(optimisticEntry);
    } catch (reason) {
      setEntries(previousEntries);
      setError(reason instanceof Error ? reason.message : "Không di chuyển được ca.");
    } finally {
      setBusy(false);
    }
  }

  async function moveEmployeeRow(
    employeeId: string,
    targetGroupId: string,
    beforeEmployeeId?: string,
  ) {
    if (!editable || busy) return;
    const previousEmployees = employees;
    const optimisticEmployees = moveEmployeeLocally(
      employees,
      employeeId,
      targetGroupId,
      beforeEmployeeId,
    );
    if (optimisticEmployees === employees) return;
    setEmployees(optimisticEmployees);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await reorderSchedulerEmployee(employeeId, targetGroupId, beforeEmployeeId);
      setEmployees(await listSchedulerEmployees());
    } catch (reason) {
      setEmployees(previousEmployees);
      setError(
        reason instanceof Error
          ? reason.message
          : "Không sắp xếp được nhân viên.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry(entry: ScheduleEntry) {
    if (!week || !editable || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ensureDraftWeek();
      await patchScheduleEntry(entry);
      await loadEntries();
      updateAvailabilityNotice(entry);
      setEditing(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được ca.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!week || !editable || busy) return;
    const previousEntries = entries;
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ensureDraftWeek();
      await removeScheduleEntry(id);
      await loadEntries();
      setEditing(null);
    } catch (reason) {
      setEntries(previousEntries);
      setError(reason instanceof Error ? reason.message : "Không xóa được ca.");
    } finally {
      setBusy(false);
    }
  }

  async function clearWeekEntries() {
    if (!week || busy || !editable) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ensureDraftWeek();
      await clearScheduleWeek(week.id);
      await Promise.all([loadEntries(), loadBase()]);
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

  async function publishSchedule() {
    if (!week) return;
    if (findScheduleIssues(entries, shifts).length > 0) {
      setError(
        "Không thể công bố vì lịch còn ca bị trùng hoặc thiếu thông tin hợp lệ.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patchScheduleWeek(week.id, {
        status: "published",
        publishedAt: new Date().toISOString(),
      });
      await loadBase();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không cập nhật được lịch.");
    } finally {
      setBusy(false);
    }
  }

  async function exportCurrentSchedule() {
    if (!week) return;
    if (findScheduleIssues(entries, shifts).length > 0) {
      setError(
        "Không thể xuất JPG vì lịch còn ca bị trùng hoặc thiếu thông tin hợp lệ.",
      );
      return;
    }
    setError(null);
    try {
      await exportScheduleJpg("cloud-schedule-export", week.weekStart);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không xuất được JPG.");
    }
  }

  async function setOverride(day: number, period: StaffingPeriod, raw: string) {
    if (!week || !editable || busy) return;
    const next = { ...week.countOverrides };
    const key = `${day}:${period}`;
    if (raw.trim() === "") delete next[key];
    else next[key] = Math.max(0, Number(raw) || 0);
    setBusy(true);
    setError(null);
    try {
      await ensureDraftWeek();
      await patchScheduleWeek(week.id, { countOverrides: next });
      setWeeks((current) =>
        current.map((item) =>
          item.id === week.id
            ? { ...item, status: "draft", countOverrides: next }
            : item,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được tổng ca.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scheduler-page route-scoped">
      <section className="panel scheduler-toolbar">
        <div>
          <span className="eyebrow">Xếp lịch chính thức</span>
          <h2>
            {week
              ? formatWeekDisplay(week.weekStart)
              : preferredWeekStart
                ? formatWeekDisplay(preferredWeekStart)
                : "Chưa có tuần xếp lịch"}
          </h2>
        </div>
        <div className="schedule-actions">
          {week && (
            <>
              <span
                className={`status-badge ${
                  week.status === "published"
                    ? "open"
                    : week.status === "draft"
                      ? "draft"
                      : "archived"
                }`}
              >
                {scheduleWeekStatusLabel(week.status)}
              </span>
              {week.status === "draft" && (
                <button
                  className="button primary"
                  disabled={busy || weekDataLoading || entries.length === 0}
                  onClick={() => void publishSchedule()}
                >
                  Công bố lịch
                </button>
              )}
              <button
                className="button secondary"
                disabled={busy || weekDataLoading}
                onClick={() => void exportCurrentSchedule()}
              >
                Xuất JPG
              </button>
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
            </>
          )}
        </div>
      </section>

      <section
        className="panel scheduler-filters route-scoped-filters"
        aria-label="Bộ lọc lịch"
      >
        <div className="scheduler-filter-heading">
          <div>
            <span className="eyebrow">Công cụ</span>
            <h3>Tìm và lọc nhân viên</h3>
          </div>
        </div>
        <div className="scheduler-filter-grid">
          <label className="scheduler-filter-field">
            <span>Tìm nhân viên</span>
            <input
              aria-label="Tìm nhân viên"
              placeholder="Nhập tên nhân viên..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="scheduler-filter-field">
            <span>Nhóm nhân viên</span>
            <CustomSelect
              ariaLabel="Lọc theo nhóm"
              value={groupFilter}
              options={[
                { value: "all", label: "Tất cả nhóm" },
                ...groups.map((group) => ({ value: group.id, label: group.name })),
              ]}
              onChange={setGroupFilter}
            />
          </label>
          <button
            type="button"
            className="button secondary scheduler-refresh"
            aria-label="Làm mới dữ liệu lịch"
            title="Làm mới dữ liệu lịch"
            disabled={busy || weekDataLoading}
            onClick={() => {
              setWeekDataLoading(true);
              void Promise.all([loadBase(), loadEntries(), loadAvailability()])
                .catch((reason) =>
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Không làm mới được dữ liệu lịch.",
                  ),
                )
                .finally(() => setWeekDataLoading(false));
            }}
          >
            <RefreshIcon />
            <span>Làm mới</span>
          </button>
        </div>
      </section>

      {week ? (
        <section
          className={`schedule-sync-bar ${
            hasRegistrationWeek ? "synced" : "missing"
          }`}
        >
          <span className="schedule-sync-icon" aria-hidden="true">
            {hasRegistrationWeek ? <CheckIcon /> : <AlertTriangleIcon />}
          </span>
          <div>
            <strong>
              {hasRegistrationWeek
                ? "Đang đối chiếu đúng tuần đăng ký"
                : "Tuần này chưa có đợt đăng ký tương ứng"}
            </strong>
            <p>
              {hasRegistrationWeek
                ? `${availabilityCount}/${activeEmployeeIds.size} nhân viên đã gửi đăng ký lịch · ${formatWeekDisplay(week.weekStart)}`
                : `${formatWeekDisplay(week.weekStart)} · Các ô ĐK sẽ chưa có dữ liệu.`}
            </p>
          </div>
          {onOpenAvailability && (
            <button
              type="button"
              className="button secondary"
              onClick={onOpenAvailability}
            >
              Xem lịch đăng ký
            </button>
          )}
        </section>
      ) : preferredWeekStart ? (
        <section className="schedule-sync-bar missing">
          <span className="schedule-sync-icon" aria-hidden="true">
            <AlertTriangleIcon />
          </span>
          <div>
            <strong>Đang tải lịch xếp của tuần đã tạo</strong>
            <p>
              {formatWeekDisplay(preferredWeekStart)} · Lịch xếp được tạo tự động
              cùng tuần đăng ký. Hãy làm mới nếu dữ liệu chưa xuất hiện.
            </p>
          </div>
        </section>
      ) : null}

      {error && (
        <div className="inline-error scheduler-error" role="alert">
          {error}
          <button
            type="button"
            aria-label="Đóng thông báo lỗi"
            onClick={() => setError(null)}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {notice && (
        <div className="scheduler-info-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setNotice(null)}
          >
            <CloseIcon />
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
            editable={editable && !busy}
            selectedShiftId={selectedShiftId}
            onSelectShift={setSelectedShiftId}
            onAssign={(employeeId, day, shiftId) =>
              void assign(employeeId, day, shiftId)
            }
            onMove={(entry, employeeId, day) =>
              void move(entry, employeeId, day)
            }
            onMoveEmployee={(employeeId, targetGroupId, beforeEmployeeId) =>
              void moveEmployeeRow(employeeId, targetGroupId, beforeEmployeeId)
            }
            onEdit={(entry) => editable && setEditing(entry)}
            onDelete={(entry) => void deleteEntry(entry.id)}
            availabilityByEmployee={availabilityByEmployee}
            countOverrides={week.countOverrides}
            onSetCountOverride={(day, period, value) =>
              void setOverride(day, period, value)
            }
          />
          <div className="schedule-export-stage" aria-hidden="true">
            <ScheduleSheet
              id="cloud-schedule-export"
              className="schedule-export-sheet"
              groups={groups}
              employees={scheduleEmployees}
              entries={entries}
              shifts={shifts}
              weekStart={week.weekStart}
              countOverrides={week.countOverrides}
              showStaffing
            />
          </div>
        </>
      ) : (
        <div className="panel empty-panel">
          {preferredWeekStart
            ? "Đang đồng bộ lịch xếp của tuần đăng ký..."
            : "Chưa có tuần đăng ký để xếp lịch."}
        </div>
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
