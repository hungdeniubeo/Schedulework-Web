import {
  DAY_LABELS,
  PRESET_OPTIONS,
  createPresetDay,
  formatAvailabilityCell,
  formatHour,
  getIntervals,
  getPreset,
  hourOptionsForInterval,
  normalizeAvailability,
  normalizeOffDay,
  updateAvailabilityInterval,
} from "../lib/availability";
import { addDateOnlyDays, formatDateShort } from "../lib/week";
import {
  DAY_KEYS,
  type Availability,
  type AvailabilityPreset,
  type DayAvailability,
  type DayKey,
} from "../types/domain";
import {
  MobileOptionPicker,
  type MobileOptionPickerOption,
} from "./MobileOptionPicker";
import { semanticShiftColor, shiftStyle } from "../scheduling/shiftStyle";
import { ArrowRightIcon } from "./Icons";

const PRESET_PICKER_OPTIONS: ReadonlyArray<MobileOptionPickerOption> =
  PRESET_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.pickerDescription,
  }));

function hourPickerOptions(hours: string[]): MobileOptionPickerOption[] {
  return hours.map((hour) => ({ value: hour, label: formatHour(hour) }));
}

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
        const reason =
          day.status === "off" &&
          "offReason" in day &&
          typeof day.offReason === "string"
            ? day.offReason
            : "";
        const semanticColor =
          day.status === "available"
            ? semanticShiftColor(formatAvailabilityCell(day))
            : null;
        return (
          <section
            className={`day-card ${day.status === "available" ? "working" : "off"}`}
            style={semanticColor ? shiftStyle(semanticColor) : undefined}
            key={key}
          >
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
                  if (day.status === "off")
                    updateDay(key, createPresetDay(preset));
                }}
              >
                Đi làm
              </button>
              <button
                type="button"
                className={day.status === "off" ? "selected off" : ""}
                disabled={readOnly}
                onClick={() =>
                  updateDay(key, {
                    status: "off",
                    preset: null,
                    intervals: [],
                    offReason: null,
                  })
                }
              >
                Nghỉ
              </button>
            </div>
            {day.status === "available" && (
              <div className="availability-shift-editor">
                <div className="shift-preset-field">
                  <span>Ca</span>
                  <MobileOptionPicker
                    title="Chọn ca"
                    ariaLabel={`Ca ${DAY_LABELS[key]}`}
                    value={preset}
                    disabled={readOnly}
                    options={PRESET_PICKER_OPTIONS}
                    onChange={(nextPreset) =>
                      updateDay(
                        key,
                        createPresetDay(nextPreset as AvailabilityPreset),
                      )
                    }
                  />
                </div>
                <div className="hour-intervals">
                  {intervals.map((interval, intervalIndex) => (
                    <div className="hour-row" key={intervalIndex}>
                      <MobileOptionPicker
                        title="Chọn giờ bắt đầu"
                        ariaLabel={`Giờ bắt đầu ${DAY_LABELS[key]} khoảng ${intervalIndex + 1}`}
                        value={interval.start}
                        disabled={readOnly}
                        layout="grid"
                        options={hourPickerOptions(
                          hourOptionsForInterval(
                            preset,
                            intervalIndex,
                            "start",
                            intervals,
                          ),
                        )}
                        onChange={(nextStart) =>
                          updateDay(
                            key,
                            updateAvailabilityInterval(
                              day,
                              intervalIndex,
                              "start",
                              nextStart,
                            ),
                          )
                        }
                      />
              <span aria-hidden="true"><ArrowRightIcon /></span>
                      <MobileOptionPicker
                        title="Chọn giờ kết thúc"
                        ariaLabel={`Giờ kết thúc ${DAY_LABELS[key]} khoảng ${intervalIndex + 1}`}
                        value={interval.end}
                        disabled={readOnly}
                        layout="grid"
                        options={hourPickerOptions(
                          hourOptionsForInterval(
                            preset,
                            intervalIndex,
                            "end",
                            intervals,
                          ),
                        )}
                        onChange={(nextEnd) =>
                          updateDay(
                            key,
                            updateAvailabilityInterval(
                              day,
                              intervalIndex,
                              "end",
                              nextEnd,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {day.status === "off" && (
              <label className="off-reason-field">
                <span>Lý do nghỉ <small>(tuỳ chọn)</small></span>
                <textarea
                  rows={1}
                  maxLength={120}
                  disabled={readOnly}
                  aria-label={`Lý do nghỉ ${DAY_LABELS[key]}`}
                  value={reason}
                  placeholder="Ví dụ: Em có lịch học"
                  onChange={(event) =>
                    updateDay(key, {
                      status: "off",
                      preset: null,
                      intervals: [],
                      offReason: event.target.value,
                    })
                  }
                />
                {reason.length > 0 && <small>{reason.length}/120</small>}
              </label>
            )}
          </section>
        );
      })}
    </div>
  );
}
