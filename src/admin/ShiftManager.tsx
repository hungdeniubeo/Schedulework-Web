import { useEffect, useState, type FormEvent } from "react";
import {
  addShiftType,
  listAllScheduleEntries,
  listShiftTypes,
  patchShiftType,
  removeShiftType,
} from "../scheduling/api";
import { getEntryIssue } from "../scheduling/overlap";
import type { ScheduleEntry } from "../scheduling/types";
import {
  formatShiftLabel,
  resolvedShiftColor,
  semanticShiftColor,
  shiftStyle,
} from "../scheduling/shiftStyle";
import type { ShiftType } from "../scheduling/types";
import { ClockIcon, PlusIcon } from "../components/Icons";

type Form = {
  id?: string;
  start: string;
  end: string;
  start2: string;
  end2: string;
  color: string;
};
const emptyForm = (): Form => ({
  start: "10:00",
  end: "14:00",
  start2: "",
  end2: "",
  color: semanticShiftColor("10:00-14:00"),
});

function formLabel(form: Form, split: boolean): string {
  return `${form.start}-${form.end}${split ? `/${form.start2}-${form.end2}` : ""}`;
}

function fromShift(shift: ShiftType): Form {
  const [first, second = "-"] = shift.label.split("/");
  const [start, end] = first.split("-");
  const [start2, end2] = second.split("-");
  const normalize = (value = "") =>
    value.replace("h", ":").replace(/:$/, ":00");
  return {
    id: shift.id,
    start: normalize(start),
    end: normalize(end),
    start2: normalize(start2),
    end2: normalize(end2),
    color: shift.color,
  };
}

export function ShiftManager() {
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [split, setSplit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const updateTime = (changes: Partial<Form>, nextSplit = split) => {
    setForm((current) => {
      const next = { ...current, ...changes };
      return { ...next, color: semanticShiftColor(formLabel(next, nextSplit)) };
    });
  };
  const load = async () => {
    const [nextShifts, nextEntries] = await Promise.all([
      listShiftTypes(),
      listAllScheduleEntries(),
    ]);
    setShifts(nextShifts);
    setEntries(nextEntries);
  };
  useEffect(() => {
    load()
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (
      form.end <= form.start ||
      (split &&
        (!form.start2 ||
          !form.end2 ||
          form.end2 <= form.start2 ||
          form.start2 < form.end))
    ) {
      return setError(
        "Giờ kết thúc phải sau giờ bắt đầu; hai khoảng giờ không được trùng nhau.",
      );
    }
    const label = formLabel(form, split);
    setBusy(true);
    try {
      const input = {
        label,
        color: form.color,
        isPreset: false,
      };
      if (form.id) {
        const nextShifts = shifts.map((shift) =>
          shift.id === form.id ? { ...input, id: form.id! } : shift,
        );
        const conflict = entries.some(
          (entry) =>
            entry.shiftTypeId === form.id &&
            getEntryIssue(
              entry,
              entries.filter(
                (item) => item.scheduleWeekId === entry.scheduleWeekId,
              ),
              nextShifts,
            ) !== null,
        );
        if (conflict)
          throw new Error(
            "Không thể đổi giờ: thay đổi này làm lịch đã xếp bị trùng hoặc không hợp lệ.",
          );
        await patchShiftType(form.id, input);
      } else await addShiftType(input);
      setForm(emptyForm());
      setSplit(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được ca.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shift-manager-page">
      <section className="panel management-hero shift-manager-hero">
        <div>
          <span className="eyebrow">Khung giờ dùng chung</span>
          <h2>Ca làm</h2>
          <p>Tạo ca một lần để admin chọn nhanh và giữ màu sắc nhất quán khi xếp lịch.</p>
        </div>
        <div className="management-hero-stat">
          <strong>{shifts.length}</strong>
          <span>ca đang sử dụng</span>
        </div>
      </section>

      <div className="management-grid shift-management-grid">
      <section className="panel manage-page shift-list-card">
        <div className="panel-heading">
          <div>
            <h3>Danh sách ca</h3>
            <p>Màu và khung giờ này xuất hiện trên toàn bộ lịch.</p>
          </div>
          <span className="management-count">{shifts.length} ca</span>
        </div>
        <div className="shift-manage-list">
          {shifts.map((shift) => (
            <div
              className="shift-manage-row"
              key={shift.id}
              style={shiftStyle(resolvedShiftColor(shift.label, shift.color))}
            >
              <span className="shift-preview">
                {formatShiftLabel(shift.label)}
              </span>
              <div className="row-actions">
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => {
                    setForm(fromShift(shift));
                    setSplit(shift.label.includes("/"));
                  }}
                >
                  Sửa
                </button>
                <button
                  className="button ghost danger"
                  type="button"
                  onClick={() =>
                    void removeShiftType(shift.id)
                      .then(load)
                      .catch((reason) => setError(reason.message))
                  }
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {loading && <div className="list-state loading">Đang tải danh sách ca…</div>}
          {shifts.length === 0 && (
            <div className="list-state" hidden={loading}>
              Chưa có ca làm. Thêm ca để bắt đầu xếp lịch.
            </div>
          )}
        </div>
      </section>
      <section className="panel shift-editor-card">
        <div className="employee-tool-heading">
          <div className="employee-tool-icon"><ClockIcon /></div>
          <div>
            <h3>{form.id ? "Chỉnh sửa ca" : "Thêm ca mới"}</h3>
            <p>{form.id ? "Cập nhật khung giờ đang chọn." : "Thiết lập khung giờ để bắt đầu xếp lịch."}</p>
          </div>
        </div>
        <form className="shift-editor" onSubmit={(event) => void save(event)}>
          <div className="time-pair">
            <label>
              Bắt đầu
              <input
                type="text"
                inputMode="numeric"
                pattern="(?:[01]\d|2[0-3]):[0-5]\d"
                maxLength={5}
                placeholder="HH:mm"
                required
                value={form.start}
                onChange={(e) => updateTime({ start: e.target.value })}
              />
            </label>
            <label>
              Kết thúc
              <input
                type="text"
                inputMode="numeric"
                pattern="(?:[01]\d|2[0-3]):[0-5]\d"
                maxLength={5}
                placeholder="HH:mm"
                required
                value={form.end}
                onChange={(e) => updateTime({ end: e.target.value })}
              />
            </label>
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={split}
              onChange={(e) => {
                const nextSplit = e.target.checked;
                setSplit(nextSplit);
                updateTime({}, nextSplit);
              }}
            />{" "}
            Thêm khoảng giờ thứ hai (ca gãy)
          </label>
          {split && (
            <div className="time-pair">
              <label>
                Bắt đầu 2
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="(?:[01]\d|2[0-3]):[0-5]\d"
                  maxLength={5}
                  placeholder="HH:mm"
                  required
                  value={form.start2}
                  onChange={(e) => updateTime({ start2: e.target.value })}
                />
              </label>
              <label>
                Kết thúc 2
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="(?:[01]\d|2[0-3]):[0-5]\d"
                  maxLength={5}
                  placeholder="HH:mm"
                  required
                  value={form.end2}
                  onChange={(e) => updateTime({ end2: e.target.value })}
                />
              </label>
            </div>
          )}
          <label className="shift-color-field">
            Màu ca
            <span>
              <input
                type="color"
                value={form.color}
                aria-label="Màu ca làm"
                onChange={(event) =>
                  setForm({ ...form, color: event.target.value.toUpperCase() })
                }
              />
              <code>{form.color.toUpperCase()}</code>
            </span>
          </label>
          <div
            className="shift-preview"
            style={shiftStyle(form.color)}
          >
            {formatShiftLabel(
              `${form.start}-${form.end}${split ? `/${form.start2 || "--:--"}-${form.end2 || "--:--"}` : ""}`,
            )}
          </div>
          {error && <div className="inline-error">{error}</div>}
          <button className="button primary" disabled={busy}>
            {!form.id && <PlusIcon />}
            {busy ? "Đang lưu..." : "Lưu ca"}
          </button>
        </form>
      </section>
      </div>
    </div>
  );
}
