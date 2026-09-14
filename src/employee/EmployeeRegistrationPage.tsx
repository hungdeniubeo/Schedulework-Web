import { useEffect, useRef, useState } from "react";
import { AvailabilityEditor } from "../components/AvailabilityEditor";
import { AppState } from "../components/AppState";
import {
  createEmptyAvailability,
  normalizeAvailability,
  prepareAvailabilityForSave,
  validateAvailability,
} from "../lib/availability";
import {
  formatDeadline,
  formatWeekRange,
  isRegistrationLocked,
  remainingUntil,
} from "../lib/week";
import type { Availability, EmployeePortalData } from "../types/domain";
import {
  EmployeePortalError,
  loadEmployeePortal,
  saveEmployeeAvailability,
} from "./api";

type Props = {
  onLogout: () => Promise<void>;
  employee: { id: string; name: string; active: boolean };
};

export function EmployeeRegistrationPage({ onLogout, employee }: Props) {
  const [context, setContext] = useState<EmployeePortalData | null>(null);
  const [availability, setAvailability] = useState<Availability>(
    createEmptyAvailability,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const savingRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadEmployeePortal(employee)
      .then((data) => {
        if (!active) return;
        setContext(data);
        setAvailability(
          data.submission
            ? normalizeAvailability(data.submission.availability)
            : createEmptyAvailability(),
        );
      })
      .catch((reason: unknown) => {
        if (!active) return;
        console.error(reason);
        const portalError =
          reason instanceof EmployeePortalError ? reason : null;
        setError({
          title:
            portalError?.code === "NO_ACTIVE_WEEK"
              ? "Chưa mở đăng ký"
              : portalError?.code === "EMPLOYEE_INACTIVE"
                ? "Tài khoản chưa hoạt động"
                : "Không tải được lịch đăng ký",
          message:
            portalError?.message || "Đã có lỗi xảy ra. Vui lòng thử lại.",
        });
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [employee]);

  async function submit() {
    if (
      !context ||
      isRegistrationLocked(context.week.status, context.week.lockAt) ||
      savingRef.current
    )
      return;
    const availabilityForSave = prepareAvailabilityForSave(availability);
    const legacyNote = legacyGlobalNoteForSave(context.submission);
    const errors = validateAvailability(availabilityForSave, legacyNote);
    if (errors.length > 0) {
      setFormError(errors[0]);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);
    const updating = context.submission !== null;
    try {
      const submission = await saveEmployeeAvailability({
        weekId: context.week.id,
        employeeId: context.employee.id,
        availability: availabilityForSave,
        note: legacyNote,
      });
      setContext({ ...context, submission });
      setAvailability(normalizeAvailability(submission.availability));
      setSuccessMessage(getSaveSuccessMessage(updating));
    } catch (reason) {
      console.error(reason);
      if (
        reason instanceof EmployeePortalError &&
        reason.code === "REGISTRATION_LOCKED"
      ) {
        setContext({ ...context, week: { ...context.week, locked: true } });
      }
      setFormError(
        reason instanceof Error
          ? reason.message
          : "Không lưu được đăng ký. Vui lòng thử lại.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (loading)
    return (
      <AppState
        title="Một chút thôi…"
        message="Đang tải tuần đăng ký của bạn."
      />
    );
  if (error || !context) {
    return (
      <AppState
        title={error?.title ?? "Không tải được lịch"}
        message={error?.message ?? "Vui lòng thử lại."}
        action={{ label: "Đăng xuất", onClick: () => void onLogout() }}
      />
    );
  }

  const locked =
    context.week.locked ||
    isRegistrationLocked(context.week.status, context.week.lockAt, now);

  return (
    <div className="employee-page">
      <header className="employee-hero">
        <span className="eyebrow">ScheduleWork</span>
        <h1>Chào, {context.employee.name}</h1>
        <p>Đăng ký lịch tuần</p>
        <strong className="week-range">
          {formatWeekRange(context.week.weekStart)}
        </strong>
        <div className="deadline-box">
          <span>Hạn đăng ký</span>
          <strong>{formatDeadline(context.week.lockAt)}</strong>
          {!locked && (
            <small>
              Còn {remainingUntil(context.week.lockAt, now)} để đăng ký
            </small>
          )}
        </div>
      </header>

      {locked && (
        <div className="locked-banner" role="status">
          <strong>Đăng ký đã khóa</strong>
          <span>
            Hạn đăng ký đã kết thúc. Nếu cần thay đổi, vui lòng liên hệ quản lý.
          </span>
        </div>
      )}

      <main className="employee-content">
        <AvailabilityEditor
          value={availability}
          weekStart={context.week.weekStart}
          readOnly={locked}
          onChange={(next) => {
            setAvailability(next);
            setSuccessMessage(null);
            setFormError(null);
          }}
        />
        {context.submission?.note?.trim() && (
          <aside className="legacy-global-note registration-legacy-note">
            <strong>Ghi chú cũ</strong>
            <span>{context.submission.note.trim()}</span>
          </aside>
        )}
      </main>

      {!locked && (
        <footer className="sticky-submit">
          <div aria-live="polite">
            {formError && <span className="form-error">{formError}</span>}
            {context.submission && (
              <span className="submission-status">
                {formatSubmissionStatus(context.submission)}
              </span>
            )}
          </div>
          <button
            className="button primary large"
            type="button"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving
              ? "Đang lưu..."
              : context.submission
                ? "Cập nhật đăng ký"
                : "Gửi đăng ký"}
          </button>
        </footer>
      )}
      <div className="save-toast-region" aria-live="polite" aria-atomic="true">
        {successMessage && (
          <div className="save-toast" role="status">{successMessage}</div>
        )}
      </div>
    </div>
  );
}

export function getSaveSuccessMessage(updating: boolean): string {
  return updating
    ? "Cập nhật đăng ký thành công"
    : "Đăng ký lịch thành công";
}

export function legacyGlobalNoteForSave(
  submission: EmployeePortalData["submission"],
): string {
  return submission?.note?.trim() ?? "";
}

export function formatSubmissionStatus(
  submission: NonNullable<EmployeePortalData["submission"]>,
): string {
  const updated = submission.updatedAt !== submission.submittedAt;
  const timestamp = updated ? submission.updatedAt : submission.submittedAt;
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(timestamp));
  return `${updated ? "Đã cập nhật" : "Đã gửi"} lúc ${time}`;
}
