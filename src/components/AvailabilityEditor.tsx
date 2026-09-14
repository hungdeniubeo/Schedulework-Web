import {
  DAY_LABELS,
  HOUR_OPTIONS,
  PRESET_OPTIONS,
  createPresetDay,
  formatHour,
  getIntervals,
  getPreset,
  normalizeAvailability,
  normalizeOffDay,
} from "../lib/availability";
import { addDateOnlyDays, formatDateShort } from "../lib/week";
import {
  DAY_KEYS,
  type Availability,
  type AvailabilityPreset,
  type DayAvailability,
  type DayKey,
} from "../types/domain";

type Props = {
  value: Availability;
  weekStart: string;
  readOnly?: boolean;
  compact?: boolean;
  onChange: (next: Availability) => void;
};

export function AvailabilityEditor({
  value,
  weekStart,
  readOnly = false,
  compact = false,
  onChange,
}: Props) {
  const normalized = normalizeAvailability(value);

  function updateDay(key: DayKey, nextDay: DayAvailability) {
    onChange({
      ...normalized,
      days: { ...normalized.days, [key]: normalizeOffDay(nextDay) },
    });
  }

  return (
    <div className={`availability-grid ${compact ? "compact" : ""}`}>
      {DAY_KEYS.map((key, index) => {
        const day = normalized.days[key];
        const preset = getPreset(day) ?? "morning";
        const intervals = getIntervals(day);
        return (
          <section className="day-card" key={key}>
            <div className="day-card-title">
              <strong>{DAY_LABELS[key]}</strong>
              <span>{formatDateShort(addDateOnlyDays(weekStart, index))}</span>
            </div>
            <div
              className="segmented status-choice"
              role="group"
              aria-label={`Trạng thái ${DAY_LABELS[key]}`}
            >
              <button
                type="button"
                className={day.status === "available" ? "selected" : ""}
                disabled={readOnly}
                onClick={() => {
                  if (day.status === "off") updateDay(key, createPresetDay(preset));
                }}
              >
                Đi làm
              </button>
              <button
                type="button"
                className={day.status === "off" ? "selected off" : ""}
                disabled={readOnly}
                onClick={() =>
                  updateDay(key, { status: "off", preset: null, intervals: [] })
                }
              >
                Nghỉ
              </button>
            </div>
            {day.status === "available" && (
              <div className="availability-shift-editor">
                <label className="shift-preset-field">
                  <span>Ca</span>
                  <select
                    aria-label={`Ca ${DAY_LABELS[key]}`}
                    value={preset}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateDay(
                        key,
                        createPresetDay(event.target.value as AvailabilityPreset),
                      )
                    }
                  >
                    {PRESET_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="hour-intervals">
                  {intervals.map((interval, intervalIndex) => (
                    <div className="hour-row" key={intervalIndex}>
                      <select
                        aria-label={`Giờ bắt đầu ${DAY_LABELS[key]} khoảng ${intervalIndex + 1}`}
                        value={interval.start}
                        disabled={readOnly}
                        onChange={(event) =>
                          updateDay(key, {
                            status: "available",
                            preset,
                            intervals: intervals.map((item, itemIndex) =>
                              itemIndex === intervalIndex
                                ? { ...item, start: event.target.value }
                                : item,
                            ),
                          })
                        }
                      >
                        {HOUR_OPTIONS.map((hour) => (
                          <option value={hour} key={hour}>{formatHour(hour)}</option>
                        ))}
                      </select>
                      <span aria-hidden="true">→</span>
                      <select
                        aria-label={`Giờ kết thúc ${DAY_LABELS[key]} khoảng ${intervalIndex + 1}`}
                        value={interval.end}
                        disabled={readOnly}
                        onChange={(event) =>
                          updateDay(key, {
                            status: "available",
                            preset,
                            intervals: intervals.map((item, itemIndex) =>
                              itemIndex === intervalIndex
                                ? { ...item, end: event.target.value }
                                : item,
                            ),
                          })
                        }
                      >
                        {HOUR_OPTIONS.map((hour) => (
                          <option value={hour} key={hour}>{formatHour(hour)}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
