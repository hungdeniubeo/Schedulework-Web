import { useEffect, useRef, useState } from "react";
import { AvailabilityEditor } from "../components/AvailabilityEditor";
import { AppState } from "../components/AppState";
import {
  createEmptyAvailability,
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
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const savingRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadEmployeePortal(employee)
      .then((data) => {
        if (!active) return;
        setContext(data);
        setAvailability(
          data.submission?.availability ?? createEmptyAvailability(),
        );
        setNote(data.submission?.note ?? "");
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
    const errors = validateAvailability(availability, note);
    if (errors.length > 0) {
      setFormError(errors[0]);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    setSaved(false);
    try {
      const submission = await saveEmployeeAvailability({
        weekId: context.week.id,
        employeeId: context.employee.id,
        availability,
        note: note.trim(),
      });
      setContext({ ...context, submission });
      setSaved(true);
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
            setSaved(false);
            setFormError(null);
          }}
        />
        <section className="note-card">
          <label htmlFor="employee-note">Ghi chú</label>
          <textarea
            id="employee-note"
            rows={4}
            maxLength={500}
            disabled={locked}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setSaved(false);
            }}
            placeholder="Ví dụ: Thứ 4 em học buổi sáng"
          />
          <small>{note.length}/500</small>
        </section>
      </main>

      {!locked && (
        <footer className="sticky-submit">
          <div aria-live="polite">
            {formError && <span className="form-error">{formError}</span>}
            {saved && <span className="success-message">Đã gửi đăng ký</span>}
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
    </div>
  );
}
