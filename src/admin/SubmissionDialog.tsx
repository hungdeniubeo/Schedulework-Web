import { useEffect, useState } from "react";
import { AvailabilityEditor } from "../components/AvailabilityEditor";
import { ModalBackdrop } from "../components/ModalBackdrop";
import {
  createEmptyAvailability,
  validateAvailability,
} from "../lib/availability";
import type {
  AdminEmployee,
  Availability,
  AvailabilitySubmission,
} from "../types/domain";

type Props = {
  employee: AdminEmployee;
  submission: AvailabilitySubmission | null;
  weekStart: string;
  saving: boolean;
  onClose: () => void;
  onSave: (availability: Availability, note: string) => Promise<void>;
};

export function SubmissionDialog({
  employee,
  submission,
  weekStart,
  saving,
  onClose,
  onSave,
}: Props) {
  const [availability, setAvailability] = useState(
    submission?.availability ?? createEmptyAvailability(),
  );
  const [note, setNote] = useState(submission?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvailability(submission?.availability ?? createEmptyAvailability());
    setNote(submission?.note ?? "");
    setError(null);
  }, [employee.id, submission]);

  async function save() {
    const errors = validateAvailability(availability, note);
    if (errors.length) return setError(errors[0]);
    setError(null);
    try {
      await onSave(availability, note.trim());
    } catch (reason) {
      console.error(reason);
      setError(
        reason instanceof Error ? reason.message : "Không lưu được thay đổi.",
      );
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <section
        className="submission-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-title"
      >
        <header>
          <div>
            <span className="eyebrow">Chi tiết đăng ký</span>
            <h2 id="submission-title">{employee.name}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </header>
        <div className="dialog-content">
          <AvailabilityEditor
            compact
            value={availability}
            weekStart={weekStart}
            onChange={setAvailability}
          />
          <label className="field">
            Ghi chú
            <textarea
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <p className="admin-note">
            Admin có thể chỉnh đăng ký này kể cả sau deadline.
          </p>
        </div>
        <footer>
          {error && <span className="form-error">{error}</span>}
          <div>
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              className="button primary"
              type="button"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </footer>
      </section>
    </ModalBackdrop>
  );
}
