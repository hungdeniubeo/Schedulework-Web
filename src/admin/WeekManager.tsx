import { useState } from "react";
import { CustomSelect } from "../components/CustomSelect";
import { PlusIcon } from "../components/Icons";
import {
  formatAdminDeadline,
  formatDateShort,
  formatWeekDisplay,
  isoToVietnamDateTimeInput,
  isRegistrationLocked,
} from "../lib/week";
import type { RegistrationWeek, RegistrationWeekStatus } from "../types/domain";
import {
  CreateWeekDialog,
  DeleteWeekDialog,
  EditWeekDialog,
} from "./WeekDialogs";
import {
  registrationWeekActionState,
  registrationWeekStatusLabel,
  registrationWeekStatusTone,
} from "./registrationWeekUi";

type Props = {
  weeks: RegistrationWeek[];
  selectedId: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onCreate: (
    weekStart: string,
    lockAt: string,
  ) => Promise<RegistrationWeek>;
  onUpdate: (
    id: string,
    changes: { status?: RegistrationWeekStatus; lock_at?: string },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function WeekStatusBadge({ week }: { week: RegistrationWeek }) {
  const effectivelyLocked = isRegistrationLocked(week.status, week.lock_at);
  return (
    <span
      className={`status-badge ${registrationWeekStatusTone(
        week.status,
        effectivelyLocked,
      )}`}
    >
      {registrationWeekStatusLabel(week.status, effectivelyLocked)}
    </span>
  );
}

function formatPickerDeadline(lockAt: string): string {
  const input = isoToVietnamDateTimeInput(lockAt);
  const [date, time] = input.split("T");
  return date && time ? `${formatDateShort(date)} · ${time}` : lockAt;
}

export function WeekManager({
  weeks,
  selectedId,
  busy,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const selected = weeks.find((week) => week.id === selectedId) ?? null;
  const [dialog, setDialog] =
    useState<"create" | "edit" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const effectivelyLocked = selected
    ? isRegistrationLocked(selected.status, selected.lock_at)
    : false;
  const actions = selected
    ? registrationWeekActionState(selected.status, effectivelyLocked)
    : null;

  async function runAction(changes: {
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
      <div className="week-manager-heading">
        <div>
          <h2>Quản lý tuần đăng ký</h2>
          <p>Chọn tuần và quản lý thời gian nhận đăng ký.</p>
        </div>
        <button
          className="button primary week-create-button"
          type="button"
          disabled={busy}
          onClick={() => setDialog("create")}
        >
          <PlusIcon /> Tạo tuần mới
        </button>
      </div>

      {weeks.length > 0 ? (
        <>
          <div className="week-picker-field">
            <span>Tuần đang quản lý</span>
            <CustomSelect
              ariaLabel="Tuần đang quản lý"
              className="week-picker"
              value={selectedId}
              disabled={busy}
              options={weeks.map((week) => ({
                value: week.id,
                label: formatWeekDisplay(week.week_start),
              }))}
              renderValue={(option) => {
                const week = weeks.find((item) => item.id === option.value);
                return week ? (
                  <>
                    <strong>{option.label}</strong>
                    <WeekStatusBadge week={week} />
                  </>
                ) : (
                  option.label
                );
              }}
              renderOption={(option) => {
                const week = weeks.find((item) => item.id === option.value);
                return week ? (
                  <span className="week-picker-option">
                    <span className="week-picker-option-heading">
                      <strong>{option.label}</strong>
                      <WeekStatusBadge week={week} />
                    </span>
                    <small>
                      Hạn đăng ký: {formatPickerDeadline(week.lock_at)}
                    </small>
                  </span>
                ) : (
                  option.label
                );
              }}
              onChange={(id) => {
                setError(null);
                onSelect(id);
              }}
            />
          </div>

          {selected && actions && (
            <article className="week-overview">
              <header className="week-overview-heading">
                <div>
                  <span className="eyebrow">Bạn đang quản lý</span>
                  <h3>{formatWeekDisplay(selected.week_start).toLocaleUpperCase("vi")}</h3>
                  <p>Lịch nhân viên đăng ký cho tuần này</p>
                </div>
                <WeekStatusBadge week={selected} />
              </header>

              <div className="week-overview-deadline">
                <div>
                  <span>Hạn đăng ký</span>
                  <strong>{formatAdminDeadline(selected.lock_at)}</strong>
                </div>
                {actions.canEditDeadline && (
                  <button
                    className="button ghost compact"
                    type="button"
                    disabled={busy}
                    onClick={() => setDialog("edit")}
                  >
                    Chỉnh sửa
                  </button>
                )}
              </div>

              {(actions.canLock || actions.canReopen) && (
                <div className="week-primary-action">
                  {actions.canLock && (
                    <button
                      className="button primary"
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction({ status: "locked" })}
                    >
                      Khóa đăng ký
                    </button>
                  )}
                  {actions.canReopen && (
                    <button
                      className="button primary"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        void runAction({
                          status: "open",
                          ...(new Date(selected.lock_at) <= new Date()
                            ? { lock_at: future.toISOString() }
                            : {}),
                        });
                      }}
                    >
                      Mở lại đăng ký
                    </button>
                  )}
                </div>
              )}

              {(actions.canEditDeadline || actions.canArchive || actions.canDelete) && (
                <footer className="week-secondary-actions">
                  {actions.canEditDeadline && (
                    <button
                      className="button ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => setDialog("edit")}
                    >
                      Chỉnh sửa tuần
                    </button>
                  )}
                  {actions.canArchive && (
                    <button
                      className="button ghost danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction({ status: "archived" })}
                    >
                      Lưu trữ
                    </button>
                  )}
                  {actions.canDelete && (
                    <button
                      className="button ghost danger"
                      type="button"
                      disabled={busy}
                      onClick={() => setDialog("delete")}
                    >
                      Xóa tuần
                    </button>
                  )}
                </footer>
              )}
            </article>
          )}
        </>
      ) : (
        <div className="week-manager-empty">
          <strong>Chưa có tuần đăng ký</strong>
          <p>Tạo tuần đầu tiên để bắt đầu nhận lịch từ nhân viên.</p>
        </div>
      )}

      {error && <div className="inline-error" role="alert">{error}</div>}

      {dialog === "create" && (
        <CreateWeekDialog
          weeks={weeks}
          busy={busy}
          onClose={() => setDialog(null)}
          onCreate={onCreate}
        />
      )}
      {dialog === "edit" && selected && actions?.canEditDeadline && (
        <EditWeekDialog
          key={selected.id}
          week={selected}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={(lockAt) => onUpdate(selected.id, { lock_at: lockAt })}
        />
      )}
      {dialog === "delete" && selected && actions?.canDelete && (
        <DeleteWeekDialog
          week={selected}
          busy={busy}
          onClose={() => setDialog(null)}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}
