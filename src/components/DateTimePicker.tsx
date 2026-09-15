import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { localDateInputValue } from "../lib/week";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClockIcon,
} from "./Icons";

type Props = {
  value: string;
  ariaLabel: string;
  ariaDescribedBy?: string;
  dateOnly?: boolean;
  requiredWeekday?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
};

type DateTimeParts = {
  date: string;
  hour: string;
  minute: string;
};

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function splitDateTime(value: string): DateTimeParts {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const dateMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(value);
  return match
    ? { date: match[1], hour: match[2], minute: match[3] }
    : dateMatch
      ? { date: dateMatch[1], hour: "22", minute: "00" }
    : { date: "", hour: "22", minute: "00" };
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

function toDateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthStart(value: string): string {
  const date = parseDate(value);
  if (!date) return `${localDateInputValue().slice(0, 7)}-01`;
  date.setUTCDate(1);
  return toDateValue(date);
}

function shiftMonth(value: string, amount: number): string {
  const date = parseDate(value) ?? new Date();
  date.setUTCMonth(date.getUTCMonth() + amount, 1);
  return toDateValue(date);
}

function calendarDates(value: string): string[] {
  const first = parseDate(monthStart(value))!;
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + index);
    return toDateValue(date);
  });
}

function formatDateLabel(value: string): string {
  const date = parseDate(value);
  if (!date) return "Chưa chọn ngày";
  const label = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toLocaleUpperCase("vi-VN") + label.slice(1);
}

function formatDateAriaLabel(value: string): string {
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function wrap(value: number, limit: number): number {
  return (value + limit) % limit;
}

export function DateTimePicker({
  value,
  ariaLabel,
  ariaDescribedBy,
  dateOnly = false,
  requiredWeekday,
  disabled = false,
  autoFocus = false,
  onChange,
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const parts = splitDateTime(value);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(parts.date));
  const today = localDateInputValue();
  const dates = calendarDates(visibleMonth);
  const visibleMonthNumber = visibleMonth.slice(0, 7);
  const visibleDate = parseDate(visibleMonth)!;
  const quickDate = (() => {
    if (requiredWeekday === undefined) return today;
    const date = parseDate(today)!;
    const distance = (requiredWeekday - date.getUTCDay() + 7) % 7;
    date.setUTCDate(date.getUTCDate() + distance);
    return toDateValue(date);
  })();

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function update(next: Partial<DateTimeParts>) {
    const date = next.date ?? (parts.date || today);
    const hour = next.hour ?? parts.hour;
    const minute = next.minute ?? parts.minute;
    onChange(dateOnly ? date : `${date}T${hour}:${minute}`);
  }

  function chooseDate(date: string) {
    if (
      requiredWeekday !== undefined
      && parseDate(date)?.getUTCDay() !== requiredWeekday
    ) return;
    update({ date });
    if (date.slice(0, 7) !== visibleMonthNumber) {
      setVisibleMonth(monthStart(date));
    }
  }

  function adjustTime(part: "hour" | "minute", amount: number) {
    if (part === "hour") {
      update({ hour: String(wrap(Number(parts.hour) + amount, 24)).padStart(2, "0") });
      return;
    }
    const totalMinutes = wrap(
      Number(parts.hour) * 60 + Number(parts.minute) + amount,
      24 * 60,
    );
    update({
      hour: String(Math.floor(totalMinutes / 60)).padStart(2, "0"),
      minute: String(totalMinutes % 60).padStart(2, "0"),
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="date-time-picker" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="date-time-picker-control"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        disabled={disabled}
        autoFocus={autoFocus}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="date-time-picker-icon" aria-hidden="true">
          <CalendarIcon />
        </span>
        <span className="date-time-picker-value">
          <small>{dateOnly ? "Ngày" : "Ngày và giờ"}</small>
          <strong>
            {formatDateLabel(parts.date)}
            {!dateOnly && ` · ${parts.hour}:${parts.minute}`}
          </strong>
        </span>
        <span className="date-time-picker-chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <section
          className={`date-time-picker-panel ${dateOnly ? "date-only" : ""}`.trim()}
          id={`${id}-panel`}
          role="dialog"
          aria-label={ariaLabel}
        >
          <div className="date-time-picker-calendar">
            <header className="date-time-picker-month">
              <div>
                <small>Chọn ngày</small>
                <strong>Tháng {visibleDate.getUTCMonth() + 1}, {visibleDate.getUTCFullYear()}</strong>
              </div>
              <div className="date-time-picker-month-actions">
                <button
                  type="button"
                  aria-label="Tháng trước"
                  onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  aria-label="Tháng sau"
                  onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </header>

            <div className="date-time-picker-weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>
            <div className="date-time-picker-days" role="grid" aria-label={`Tháng ${visibleDate.getUTCMonth() + 1}`}>
              {dates.map((dateValue) => {
                const date = parseDate(dateValue)!;
                const selected = dateValue === parts.date;
                const outside = dateValue.slice(0, 7) !== visibleMonthNumber;
                const unavailable = requiredWeekday !== undefined
                  && date.getUTCDay() !== requiredWeekday;
                return (
                  <button
                    type="button"
                    role="gridcell"
                    key={dateValue}
                    className={`${selected ? "selected" : ""} ${outside ? "outside" : ""} ${dateValue === today ? "today" : ""}`.trim()}
                    aria-label={formatDateAriaLabel(dateValue)}
                    aria-selected={selected}
                    disabled={unavailable}
                    onClick={() => chooseDate(dateValue)}
                  >
                    {date.getUTCDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {!dateOnly && <aside className="date-time-picker-time">
            <div className="date-time-picker-time-heading">
              <span className="date-time-picker-clock" aria-hidden="true">
                <ClockIcon />
              </span>
              <div>
                <small>Chọn giờ</small>
                <strong>Giờ Việt Nam</strong>
              </div>
            </div>

            <div className="date-time-picker-steppers" aria-label="Thời gian">
              <div className="date-time-picker-stepper">
                <button type="button" aria-label="Tăng giờ" onClick={() => adjustTime("hour", 1)}><ChevronUpIcon /></button>
                <strong>{parts.hour}</strong>
                <button type="button" aria-label="Giảm giờ" onClick={() => adjustTime("hour", -1)}><ChevronDownIcon /></button>
                <small>Giờ</small>
              </div>
              <span aria-hidden="true">:</span>
              <div className="date-time-picker-stepper">
                <button type="button" aria-label="Tăng phút" onClick={() => adjustTime("minute", 5)}><ChevronUpIcon /></button>
                <strong>{parts.minute}</strong>
                <button type="button" aria-label="Giảm phút" onClick={() => adjustTime("minute", -5)}><ChevronDownIcon /></button>
                <small>Phút</small>
              </div>
            </div>

            <p>Múi giờ UTC+7</p>
          </aside>}

          <footer className="date-time-picker-actions">
            <button
              type="button"
              className="date-time-picker-today"
              onClick={() => {
                chooseDate(quickDate);
                setVisibleMonth(monthStart(quickDate));
              }}
            >
              {requiredWeekday === 1 ? "Thứ Hai tới" : "Hôm nay"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
            >
              Xong
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
