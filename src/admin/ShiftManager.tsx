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
  semanticShiftColor,
  shiftStyle,
} from "../scheduling/shiftStyle";
import type { ShiftType } from "../scheduling/types";

type Form = {
  id?: string;
  start: string;
  end: string;
  start2: string;
  end2: string;
};
const emptyForm = (): Form => ({
  start: "10:00",
  end: "14:00",
  start2: "",
  end2: "",
});

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
  };
}

export function ShiftManager() {
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [split, setSplit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const load = async () => {
    const [nextShifts, nextEntries] = await Promise.all([
      listShiftTypes(),
      listAllScheduleEntries(),
    ]);
    setShifts(nextShifts);
    setEntries(nextEntries);
  };
  useEffect(() => {
    load().catch((reason) => setError(reason.message));
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
    const label = `${form.start}-${form.end}${split ? `/${form.start2}-${form.end2}` : ""}`;
    setBusy(true);
    try {
      const input = {
        label,
        color: semanticShiftColor(label),
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
    <div className="management-grid">
      <section className="panel manage-page">
        <div className="panel-heading">
          <div>
            <h2>Ca làm</h2>
            <p>Ca đơn và ca gãy dùng chung cú pháp với desktop.</p>
          </div>
        </div>
        <div className="shift-manage-list">
          {shifts.map((shift) => (
            <div
              className="shift-manage-row"
              key={shift.id}
              style={shiftStyle(shift.color)}
            >
              <span className="shift-preview">
                {formatShiftLabel(shift.label)}
              </span>
              <div className="row-actions">
                <button
                  className="button ghost"
                  onClick={() => {
                    setForm(fromShift(shift));
                    setSplit(shift.label.includes("/"));
                  }}
                >
                  Sửa
                </button>
                <button
                  className="button ghost danger"
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
        </div>
      </section>
      <section className="panel">
        <h2>{form.id ? "Chỉnh sửa ca" : "Thêm ca"}</h2>
        <form className="shift-editor" onSubmit={(event) => void save(event)}>
          <div className="time-pair">
            <label>
              Bắt đầu
              <input
                type="time"
                required
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </label>
            <label>
              Kết thúc
              <input
                type="time"
                required
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </label>
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={split}
              onChange={(e) => setSplit(e.target.checked)}
            />{" "}
            Thêm khoảng giờ thứ hai (ca gãy)
          </label>
          {split && (
            <div className="time-pair">
              <label>
                Bắt đầu 2
                <input
                  type="time"
                  required
                  value={form.start2}
                  onChange={(e) => setForm({ ...form, start2: e.target.value })}
                />
              </label>
              <label>
                Kết thúc 2
                <input
                  type="time"
                  required
                  value={form.end2}
                  onChange={(e) => setForm({ ...form, end2: e.target.value })}
                />
              </label>
            </div>
          )}
          <div
            className="shift-preview"
            style={shiftStyle(
              semanticShiftColor(
                `${form.start}-${form.end}${split ? `/${form.start2}-${form.end2}` : ""}`,
              ),
            )}
          >
            {formatShiftLabel(
              `${form.start}-${form.end}${split ? `/${form.start2 || "--:--"}-${form.end2 || "--:--"}` : ""}`,
            )}
          </div>
          {error && <div className="inline-error">{error}</div>}
          <button className="button primary" disabled={busy}>
            {busy ? "Đang lưu..." : "Lưu ca"}
          </button>
        </form>
      </section>
    </div>
  );
}
