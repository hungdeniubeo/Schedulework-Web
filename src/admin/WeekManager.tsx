import { useEffect, useState, type FormEvent } from "react";
import { CustomSelect } from "../components/CustomSelect";
import {
  defaultRegistrationWindow,
  formatAdminDeadline,
  formatWeekRange,
  isoToVietnamDateTimeInput,
  isMondayDate,
  isRegistrationLocked,
  vietnamDateTimeToIso,
} from "../lib/week";
import type { RegistrationWeek, RegistrationWeekStatus } from "../types/domain";

export function registrationWeekStatusLabel(
  status: RegistrationWeekStatus,
  effectivelyLocked = status !== "open",
): string {
  if (status === "archived") return "Đã lưu trữ";
  return effectivelyLocked ? "Đã khóa" : "Đang mở";
}

export function registrationWeekActionState(
  status: RegistrationWeekStatus,
  effectivelyLocked: boolean,
) {
  return {
    canEditDeadline: status !== "archived",
    canLock: status === "open" && !effectivelyLocked,
    canReopen: status !== "archived" && effectivelyLocked,
    canArchive: status !== "archived",
  };
}

type Props = {
  weeks: RegistrationWeek[];
  selectedId: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onCreate: (weekStart: string, lockAt: string) => Promise<void>;
  onUpdate: (
    id: string,
    changes: { status?: RegistrationWeekStatus; lock_at?: string },
  ) => Promise<void>;
};

export function WeekManager({
  weeks,
  selectedId,
  busy,
  onSelect,
  onCreate,
  onUpdate,
}: Props) {
  const selected = weeks.find((week) => week.id === selectedId) ?? null;
  const defaults = defaultRegistrationWindow();
  const [weekStart, setWeekStart] = useState(defaults.weekStart);
  const [lockAt, setLockAt] = useState(defaults.lockAtInput);
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const effectivelyLocked = selected
    ? isRegistrationLocked(selected.status, selected.lock_at)
    : false;
  const actions = selected
    ? registrationWeekActionState(selected.status, effectivelyLocked)
    : null;

  useEffect(
    () =>
      setDeadlineDraft(
        selected ? isoToVietnamDateTimeInput(selected.lock_at) : "",
      ),
    [selected],
  );

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isMondayDate(weekStart))
      return setError("Ngày bắt đầu tuần phải là Thứ Hai.");
    try {
      await onCreate(weekStart, vietnamDateTimeToIso(lockAt));
      const next = defaultRegistrationWindow();
      setWeekStart(next.weekStart);
      setLockAt(next.lockAtInput);
    } catch (reason) {
      console.error(reason);
      setError(
        reason instanceof Error ? reason.message : "Không tạo được tuần.",
      );
    }
  }

  async function update(changes: {
    status?: RegistrationWeekStatus;
    lock_at?: string;
  }) {
    if (!selected) return;
    setError(null);
    try {
      await onUpdate(selected.id, changes);
    } catch (reason) {
      console.error(reason);
      setError(
        reason instanceof Error ? reason.message : "Không cập nhật được tuần.",
      );
    }
  }

  return (
    <section className="panel week-manager">
      <div className="panel-heading">
        <div>
          <h2>Tuần đăng ký</h2>
          <p>Tạo tuần, cập nhật hạn và trạng thái nhận đăng ký.</p>
        </div>
      </div>
      <div className="field">
        <span>Tuần đang xem</span>
        <CustomSelect
          ariaLabel="Tuần đang xem"
          value={selectedId}
          disabled={busy || weeks.length === 0}
          options={weeks.map((week) => ({
            value: week.id,
            label: `Tuần ${formatWeekRange(week.week_start)} · ${registrationWeekStatusLabel(
              week.status,
              isRegistrationLocked(week.status, week.lock_at),
            )}`,
          }))}
          onChange={onSelect}
        />
      </div>
      {selected && (
        <div className="week-controls">
          <div className="selected-week-summary">
            <div>
              <strong>Tuần {formatWeekRange(selected.week_start)}</strong>
              <small>
                Lịch nhân viên đăng ký cho tuần {formatWeekRange(selected.week_start)}
              </small>
            </div>
            <div className="week-status-line">
              <span>Trạng thái</span>
              <strong
                className={`status-badge ${selected.status === "archived" ? "archived" : effectivelyLocked ? "locked" : "open"}`}
              >
                {registrationWeekStatusLabel(
                  selected.status,
                  effectivelyLocked,
                )}
              </strong>
            </div>
          </div>
          <div className="week-deadline-summary">
            <span>Hạn đăng ký</span>
            <strong>{formatAdminDeadline(selected.lock_at)}</strong>
          </div>
          <label className="deadline-field">
            <span>Ngày giờ khóa đăng ký</span>
            <div className="deadline-edit">
              <input
                type="datetime-local"
                value={deadlineDraft}
                disabled={busy || !actions?.canEditDeadline}
                onChange={(e) => setDeadlineDraft(e.target.value)}
              />
              <button
                className="button secondary"
                disabled={
                  busy || !deadlineDraft || !actions?.canEditDeadline
                }
                type="button"
                onClick={() =>
                  void update({ lock_at: vietnamDateTimeToIso(deadlineDraft) })
                }
              >
                Cập nhật hạn đăng ký
              </button>
            </div>
          </label>
          <div className="row-actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy || !actions?.canLock}
              onClick={() => void update({ status: "locked" })}
            >
              Khóa đăng ký
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy || !actions?.canReopen}
              onClick={() => {
                const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
                void update({
                  status: "open",
                  ...(new Date(selected.lock_at) <= new Date()
                    ? { lock_at: future.toISOString() }
                    : {}),
                });
              }}
            >
              Mở lại đăng ký
            </button>
            <button
              className="button ghost danger"
              type="button"
              disabled={busy || !actions?.canArchive}
              onClick={() => void update({ status: "archived" })}
            >
              Lưu trữ
            </button>
          </div>
        </div>
      )}
      <details className="create-week">
        <summary>Tạo tuần mới</summary>
        <form onSubmit={(event) => void create(event)}>
          <label>
            Ngày Thứ Hai bắt đầu
            <input
              type="date"
              required
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </label>
          <label>
            Ngày giờ khóa đăng ký
            <input
              type="datetime-local"
              required
              value={lockAt}
              onChange={(e) => setLockAt(e.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy}>
            Tạo tuần
          </button>
        </form>
      </details>
      {weeks.length === 0 && (
        <p className="empty-panel">Chưa có tuần đăng ký.</p>
      )}
      {error && <div className="inline-error">{error}</div>}
    </section>
  );
}
