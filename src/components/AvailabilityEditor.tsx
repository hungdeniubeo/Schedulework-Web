import {
  DAY_LABELS,
  PERIOD_LABELS,
  normalizeOffDay,
} from "../lib/availability";
import { addDateOnlyDays, formatDateShort } from "../lib/week";
import {
  DAY_KEYS,
  PERIODS,
  type Availability,
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
  function updateDay(key: DayKey, nextDay: DayAvailability) {
    onChange({
      ...value,
      days: { ...value.days, [key]: normalizeOffDay(nextDay) },
    });
  }

  return (
    <div className={`availability-grid ${compact ? "compact" : ""}`}>
      {DAY_KEYS.map((key, index) => {
        const day = value.days[key];
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
                onClick={() =>
                  updateDay(key, {
                    status: "available",
                    periods: day.status === "off" ? [...PERIODS] : day.periods,
                    start: day.status === "off" ? null : day.start,
                    end: day.status === "off" ? null : day.end,
                  })
                }
              >
                Đi làm được
              </button>
              <button
                type="button"
                className={day.status === "off" ? "selected off" : ""}
                disabled={readOnly}
                onClick={() =>
                  updateDay(key, {
                    status: "off",
                    periods: [],
                    start: null,
                    end: null,
                  })
                }
              >
                Nghỉ
              </button>
            </div>
            {day.status === "available" && (
              <>
                <div
                  className="periods"
                  role="group"
                  aria-label={`Ca ${DAY_LABELS[key]}`}
                >
                  {PERIODS.map((period) => {
                    const selected = day.periods.includes(period);
                    return (
                      <button
                        type="button"
                        className={selected ? "selected" : ""}
                        aria-pressed={selected}
                        disabled={readOnly}
                        key={period}
                        onClick={() =>
                          updateDay(key, {
                            ...day,
                            periods: selected
                              ? day.periods.filter((item) => item !== period)
                              : [...day.periods, period],
                          })
                        }
                      >
                        {PERIOD_LABELS[period]}
                      </button>
                    );
                  })}
                </div>
                <div className="custom-time">
                  <span>
                    Giờ cụ thể <small>(tuỳ chọn)</small>
                  </span>
                  <div>
                    <input
                      aria-label={`Giờ bắt đầu ${DAY_LABELS[key]}`}
                      type="time"
                      value={day.start ?? ""}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateDay(key, {
                          ...day,
                          start: event.target.value || null,
                        })
                      }
                    />
                    <span>đến</span>
                    <input
                      aria-label={`Giờ kết thúc ${DAY_LABELS[key]}`}
                      type="time"
                      value={day.end ?? ""}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateDay(key, {
                          ...day,
                          end: event.target.value || null,
                        })
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
