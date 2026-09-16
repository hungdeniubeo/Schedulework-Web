import { useState } from "react";
import { CustomSelect } from "../components/CustomSelect";
import { CloseIcon } from "../components/Icons";
import { ModalBackdrop } from "../components/ModalBackdrop";
import { getEntryIssue } from "../scheduling/overlap";
import type {
  ScheduleEntry,
  ShiftType,
} from "../scheduling/types";

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
    if (issue) {
      setError(
        issue.kind === "overlap"
          ? "Ca này bị trùng giờ với một ca khác."
          : issue.message,
      );
      return;
    }
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
            <CloseIcon />
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
                type="text"
                inputMode="numeric"
                pattern="(?:[01]\d|2[0-3]):[0-5]\d"
                maxLength={5}
                placeholder="HH:mm"
                value={draft.customStart ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, customStart: event.target.value || null })
                }
              />
            </label>
            <label>
              Giờ kết thúc
              <input
                type="text"
                inputMode="numeric"
                pattern="(?:[01]\d|2[0-3]):[0-5]\d"
                maxLength={5}
                placeholder="HH:mm"
                value={draft.customEnd ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, customEnd: event.target.value || null })
                }
              />
            </label>
          </div>
          <label className="field">
            Nhãn tùy chỉnh / ca gãy
            <input
              placeholder="10:00-14:00/18:00-23:00"
              value={draft.customLabel ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, customLabel: event.target.value || null })
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
            <button className="button secondary" type="button" onClick={onClose}>
              Hủy
            </button>
            <button
              className="button primary"
              type="button"
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
