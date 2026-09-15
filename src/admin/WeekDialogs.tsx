import { useState, type FormEvent } from "react";
import { DateTimePicker } from "../components/DateTimePicker";
import { CloseIcon } from "../components/Icons";
import { ModalBackdrop } from "../components/ModalBackdrop";
import {
  defaultRegistrationLockAtInput,
  defaultRegistrationWindow,
  formatWeekDisplay,
  isoToVietnamDateTimeInput,
  isMondayDate,
  vietnamDateTimeToIso,
} from "../lib/week";
import type { RegistrationWeek } from "../types/domain";
import { validateRegistrationWeek } from "./registrationWeekUi";

type CreateWeekDialogProps = {
  weeks: RegistrationWeek[];
  busy: boolean;
  onClose: () => void;
  onCreate: (
    weekStart: string,
    lockAt: string,
  ) => Promise<RegistrationWeek>;
};

export function CreateWeekDialog({
  weeks,
  busy,
  onClose,
  onCreate,
}: CreateWeekDialogProps) {
  const defaults = defaultRegistrationWindow();
  const [weekStart, setWeekStart] = useState(defaults.weekStart);
  const [lockAt, setLockAt] = useState(defaults.lockAtInput);
  const [error, setError] = useState<string | null>(null);
  const isValidMonday = isMondayDate(weekStart);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateRegistrationWeek(weekStart, weeks);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      await onCreate(weekStart, vietnamDateTimeToIso(lockAt));
      onClose();
    } catch (reason) {
      console.error(reason);
      setError(
        reason instanceof Error ? reason.message : "Không tạo được tuần.",
      );
    }
  }

  return (
    <ModalBackdrop onClose={busy ? () => undefined : onClose}>
      <section
        className="week-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-week-title"
      >
        <header>
          <div>
            <span className="eyebrow">Quản lý tuần đăng ký</span>
            <h2 id="create-week-title">Tạo tuần đăng ký mới</h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            aria-label="Đóng"
            disabled={busy}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <label className="field">
            <span>Ngày bắt đầu</span>
            <DateTimePicker
              autoFocus
              dateOnly
              requiredWeekday={1}
              ariaLabel="Chọn ngày bắt đầu tuần"
              value={weekStart}
              disabled={busy}
              ariaDescribedBy="create-week-start-hint"
              onChange={(value) => {
                setWeekStart(value);
                setLockAt(defaultRegistrationLockAtInput(value));
                setError(null);
              }}
            />
            <small id="create-week-start-hint">Ngày bắt đầu phải là Thứ Hai.</small>
          </label>

          <div className="week-dialog-preview" aria-live="polite">
            <span>Tuần</span>
            <strong>
              {isValidMonday ? formatWeekDisplay(weekStart) : "Chọn một ngày Thứ Hai"}
            </strong>
          </div>

          <label className="field">
            <span>Khóa đăng ký lúc</span>
            <DateTimePicker
              ariaLabel="Chọn thời điểm khóa đăng ký"
              value={lockAt}
              disabled={busy}
              onChange={(value) => {
                setLockAt(value);
                setError(null);
              }}
            />
          </label>

          {error && <div className="inline-error" role="alert">{error}</div>}
          <footer className="week-dialog-actions">
            <button
              className="button ghost"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={busy || !weekStart || !lockAt}
            >
              {busy ? "Đang tạo..." : "Tạo tuần"}
            </button>
          </footer>
        </form>
      </section>
    </ModalBackdrop>
  );
}

type EditWeekDialogProps = {
  week: RegistrationWeek;
  busy: boolean;
  onClose: () => void;
  onSave: (lockAt: string) => Promise<void>;
};

export function EditWeekDialog({
  week,
  busy,
  onClose,
  onSave,
}: EditWeekDialogProps) {
  const [lockAt, setLockAt] = useState(
    isoToVietnamDateTimeInput(week.lock_at),
  );
  const [error, setError] = useState<string | null>(null);
  const [year, month, day] = week.week_start.split("-");
  const weekStartLabel = `${day}/${month}/${year}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await onSave(vietnamDateTimeToIso(lockAt));
      onClose();
    } catch (reason) {
      console.error(reason);
      setError(
        reason instanceof Error ? reason.message : "Không cập nhật được tuần.",
      );
    }
  }

  return (
    <ModalBackdrop onClose={busy ? () => undefined : onClose}>
      <section
        className="week-dialog edit-week-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-week-title"
      >
        <header>
          <div>
            <span className="eyebrow">Chỉnh sửa tuần</span>
            <h2 id="edit-week-title">{formatWeekDisplay(week.week_start)}</h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            aria-label="Đóng"
            disabled={busy}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <div className="week-dialog-readonly">
            <span>Ngày bắt đầu tuần</span>
            <strong>Thứ Hai, {weekStartLabel}</strong>
            <small>
              Tuần đã tạo không thể đổi ngày bắt đầu. Hãy tạo tuần khác nếu cần
              một khoảng ngày mới.
            </small>
          </div>
          <label className="field">
            <span>Hạn đăng ký</span>
            <DateTimePicker
              autoFocus
              ariaLabel="Chọn hạn đăng ký"
              value={lockAt}
              disabled={busy}
              onChange={(value) => {
                setLockAt(value);
                setError(null);
              }}
            />
          </label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <footer className="week-dialog-actions">
            <button
              className="button ghost"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={busy || !lockAt}
            >
              {busy ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </footer>
        </form>
      </section>
    </ModalBackdrop>
  );
}

type DeleteWeekDialogProps = {
  week: RegistrationWeek;
  busy: boolean;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
};

export function DeleteWeekDialog({
  week,
  busy,
  onClose,
  onDelete,
}: DeleteWeekDialogProps) {
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    try {
      await onDelete(week.id);
      onClose();
    } catch (reason) {
      console.error(reason);
      setError(
        reason instanceof Error ? reason.message : "Không xóa được tuần.",
      );
    }
  }

  return (
    <ModalBackdrop onClose={busy ? () => undefined : onClose}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-registration-week-title"
        aria-describedby="delete-registration-week-description"
      >
        <header>
          <h2 id="delete-registration-week-title">Xóa tuần đăng ký?</h2>
        </header>
        <p id="delete-registration-week-description">
          <strong>{formatWeekDisplay(week.week_start)}</strong> và toàn bộ đăng
          ký nhân viên của tuần này sẽ bị xóa. Lịch chính thức đã xếp không bị
          ảnh hưởng. Thao tác này không thể hoàn tác.
        </p>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <footer>
          <button
            className="button secondary"
            type="button"
            autoFocus
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className="button ghost danger"
            type="button"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? "Đang xóa..." : "Xóa tuần"}
          </button>
        </footer>
      </section>
    </ModalBackdrop>
  );
}
