import { useCallback, useEffect, useRef, useState } from "react";
import { AvailabilityEditor } from "../components/AvailabilityEditor";
import { AppState } from "../components/AppState";
import {
  createEmptyAvailability,
  normalizeAvailability,
  prepareAvailabilityForSave,
  validateAvailability,
} from "../lib/availability";
import {
  availabilityMatches,
  clearAvailabilityDraft,
  loadAvailabilityDraft,
  saveAvailabilityDraft,
} from "../lib/draftStorage";
import { subscribePageRefresh } from "../lib/pageRefresh";
import {
  formatDeadline,
  formatRegistrationWeekLabel,
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
import {
  canRefreshEmployeePortal,
  reconcileEmployeePortalRefresh,
} from "./employeePortalRefresh";

type Props = {
  onSubmissionSaved: () => void;
  employee: { id: string; name: string; active: boolean };
};

export function EmployeeRegistrationPage({
  onSubmissionSaved,
  employee,
}: Props) {
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
  const [hasDraft, setHasDraft] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const savingRef = useRef(false);
  const refreshingRef = useRef(false);
  const mountedRef = useRef(true);
  const contextRef = useRef<EmployeePortalData | null>(null);
  const availabilityRef = useRef<Availability>(availability);
  const hasDraftRef = useRef(false);

  const updateContext = useCallback((next: EmployeePortalData | null) => {
    contextRef.current = next;
    setContext(next);
  }, []);

  const updateAvailability = useCallback((next: Availability) => {
    availabilityRef.current = next;
    setAvailability(next);
  }, []);

  const updateHasDraft = useCallback((next: boolean) => {
    hasDraftRef.current = next;
    setHasDraft(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const refreshPortal = useCallback(
    async (initial = false) => {
      if (
        !canRefreshEmployeePortal(savingRef.current, refreshingRef.current)
      )
        return;

      const showLoading = initial || contextRef.current === null;
      refreshingRef.current = true;
      if (showLoading) setLoading(true);
      if (contextRef.current === null) setError(null);

      try {
        const nextContext = await loadEmployeePortal(employee);
        if (!mountedRef.current) return;

        const nextDraft = loadAvailabilityDraft(
          nextContext.employee.id,
          nextContext.week.id,
        );
        const result = reconcileEmployeePortalRefresh({
          currentContext: contextRef.current,
          currentAvailability: availabilityRef.current,
          hasDraft: hasDraftRef.current,
          nextContext,
          nextDraft,
          now: new Date(),
        });

        if (result.shouldClearDraft) {
          clearAvailabilityDraft(
            nextContext.employee.id,
            nextContext.week.id,
          );
        }
        updateContext(result.context);
        updateAvailability(result.availability);
        updateHasDraft(result.hasDraft);
        setError(null);
      } catch (reason: unknown) {
        if (!mountedRef.current) return;
        console.error(reason);
        const portalError =
          reason instanceof EmployeePortalError ? reason : null;
        const current = contextRef.current;
        const title =
          portalError?.code === "NO_ACTIVE_WEEK"
            ? "Chưa mở đăng ký"
            : portalError?.code === "EMPLOYEE_INACTIVE"
              ? "Tài khoản chưa hoạt động"
              : "Không tải được lịch đăng ký";
        const message =
          portalError?.message || "Đã có lỗi xảy ra. Vui lòng thử lại.";

        if (portalError?.code === "NO_ACTIVE_WEEK") {
          if (current) {
            clearAvailabilityDraft(current.employee.id, current.week.id);
          }
          updateContext(null);
          updateAvailability(createEmptyAvailability());
          updateHasDraft(false);
        }

        if (
          !current ||
          portalError?.code === "NO_ACTIVE_WEEK" ||
          portalError?.code === "EMPLOYEE_INACTIVE"
        ) {
          setError({ title, message });
        } else {
          setFormError(`Không làm mới được tuần đăng ký. ${message}`);
        }
      } finally {
        refreshingRef.current = false;
        if (mountedRef.current && showLoading) setLoading(false);
      }
    },
    [employee, updateAvailability, updateContext, updateHasDraft],
  );

  useEffect(() => {
    void refreshPortal(true);
  }, [refreshPortal]);

  useEffect(
    () => subscribePageRefresh(() => void refreshPortal(false)),
    [refreshPortal],
  );

  useEffect(() => {
    if (
      !context ||
      !hasDraft ||
      !isRegistrationLocked(context.week.status, context.week.lockAt, now)
    )
      return;
    clearAvailabilityDraft(context.employee.id, context.week.id);
    updateAvailability(
      context.submission
        ? normalizeAvailability(context.submission.availability)
        : createEmptyAvailability(),
    );
    updateHasDraft(false);
  }, [context, hasDraft, now, updateAvailability, updateHasDraft]);

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
      const submission = await saveAvailabilityThenNotify(
        () =>
          saveEmployeeAvailability({
            weekId: context.week.id,
            employeeId: context.employee.id,
            availability: availabilityForSave,
            note: legacyNote,
          }),
        onSubmissionSaved,
      );
      clearAvailabilityDraft(context.employee.id, context.week.id);
      updateContext({ ...context, submission });
      updateAvailability(normalizeAvailability(submission.availability));
      updateHasDraft(false);
      setSuccessMessage(getSaveSuccessMessage(updating));
    } catch (reason) {
      console.error(reason);
      if (
        reason instanceof EmployeePortalError &&
        reason.code === "REGISTRATION_LOCKED"
      ) {
        clearAvailabilityDraft(context.employee.id, context.week.id);
        updateAvailability(
          context.submission
            ? normalizeAvailability(context.submission.availability)
            : createEmptyAvailability(),
        );
        updateHasDraft(false);
        updateContext({
          ...context,
          week: { ...context.week, locked: true },
        });
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
        action={{ label: "Thử lại", onClick: () => void refreshPortal(false) }}
      />
    );
  }

  const locked =
    context.week.locked ||
    isRegistrationLocked(context.week.status, context.week.lockAt, now);

  const submittedAvailability = context.submission
    ? normalizeAvailability(context.submission.availability)
    : createEmptyAvailability();

  return (
    <div className="employee-page">
      <header className="employee-hero">
        <span className="eyebrow">ScheduleWork</span>
        <h1>Chào, {context.employee.name}</h1>
        <p>{formatRegistrationWeekLabel(context.week.weekStart)}</p>
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
            updateAvailability(next);
            setSuccessMessage(null);
            setFormError(null);
            if (availabilityMatches(next, submittedAvailability)) {
              clearAvailabilityDraft(context.employee.id, context.week.id);
              updateHasDraft(false);
            } else {
              saveAvailabilityDraft(
                context.employee.id,
                context.week.id,
                next,
              );
              updateHasDraft(true);
            }
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
            {hasDraft && (
              <span className="draft-status">Chưa lưu thay đổi</span>
            )}
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
          <div className="save-toast" role="status">
            {successMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export async function saveAvailabilityThenNotify<T>(
  save: () => Promise<T>,
  onSubmissionSaved: () => void,
): Promise<T> {
  const saved = await save();
  onSubmissionSaved();
  return saved;
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
