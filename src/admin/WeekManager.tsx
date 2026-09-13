import { useEffect, useState, type FormEvent } from "react";
import {
  defaultRegistrationWindow,
  formatDeadline,
  formatWeekRange,
  isoToVietnamDateTimeInput,
  isMondayDate,
  isRegistrationLocked,
  vietnamDateTimeToIso,
} from "../lib/week";
import type { RegistrationWeek, RegistrationWeekStatus } from "../types/domain";

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
      return setError("Ngày bắt đầu tuần phải là Thứ 2.");
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
          <p>Tạo tuần, chỉnh deadline và trạng thái nhận đăng ký.</p>
        </div>
      </div>
      <label className="field">
        Tuần đang xem
        <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
          {weeks.map((week) => (
            <option key={week.id} value={week.id}>
              {formatWeekRange(week.week_start)} · {week.status}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <div className="week-controls">
          <div className="week-status-line">
            <span
              className={`status-badge ${selected.status === "archived" ? "archived" : effectivelyLocked ? "locked" : "open"}`}
            >
              {selected.status === "archived"
                ? "Đã lưu trữ"
                : effectivelyLocked
                  ? "Đã khóa"
                  : "Đang mở"}
            </span>
            <span>Hạn: {formatDeadline(selected.lock_at)}</span>
          </div>
          <div className="deadline-edit">
            <input
              type="datetime-local"
              value={deadlineDraft}
              onChange={(e) => setDeadlineDraft(e.target.value)}
            />
            <button
              className="button secondary"
              disabled={busy || !deadlineDraft}
              type="button"
              onClick={() =>
                void update({ lock_at: vietnamDateTimeToIso(deadlineDraft) })
              }
            >
              Đổi deadline
            </button>
          </div>
          <div className="row-actions">
            <button
              className="button secondary"
              type="button"
              disabled={
                busy || effectivelyLocked || selected.status === "archived"
              }
              onClick={() => void update({ status: "locked" })}
            >
              Lock now
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy || !effectivelyLocked}
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
              Re-open
            </button>
            <button
              className="button ghost danger"
              type="button"
              disabled={busy || selected.status === "archived"}
              onClick={() => void update({ status: "archived" })}
            >
              Archive
            </button>
          </div>
        </div>
      )}
      <details className="create-week">
        <summary>Tạo tuần đăng ký</summary>
        <form onSubmit={(event) => void create(event)}>
          <label>
            Thứ 2 bắt đầu
            <input
              type="date"
              required
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </label>
          <label>
            Hạn đăng ký
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
