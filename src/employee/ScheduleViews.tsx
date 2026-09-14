import { useEffect, useState } from "react";
import { AppState } from "../components/AppState";
import { DAY_KEYS } from "../types/domain";
import {
  DAY_LABELS,
  formatAvailabilityCell,
  formatAvailabilityPreset,
  getOffReason,
} from "../lib/availability";
import { addDateOnlyDays, formatDateShort, formatWeekRange } from "../lib/week";
import { ScheduleSheet } from "../scheduling/ScheduleSheet";
import { employeesForSchedule } from "../scheduling/scheduleSheetModel";
import {
  semanticShiftColor,
  shiftStyle,
} from "../scheduling/shiftStyle";
import type {
  MyScheduleData,
  PublishedScheduleData,
  SubmittedAvailabilityData,
} from "./scheduleApi";
import { loadMyScheduleData, loadPublishedSchedule } from "./scheduleApi";

function usePublishedSchedule(employeeId: string) {
  const [data, setData] = useState<PublishedScheduleData | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadPublishedSchedule(employeeId)
      .then(setData)
      .catch((reason) => {
        console.error(reason);
        setError(
          reason instanceof Error ? reason.message : "Không tải được lịch.",
        );
      });
  }, [employeeId]);
  return { data, error };
}

function useMySchedule(employeeId: string) {
  const [data, setData] = useState<MyScheduleData | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    loadMyScheduleData(employeeId)
      .then((next) => active && setData(next))
      .catch((reason) => {
        console.error(reason);
        if (active)
          setError(reason instanceof Error ? reason.message : "Không tải được lịch.");
      });
    return () => {
      active = false;
    };
  }, [employeeId]);
  return { data, error };
}

function submittedTimeLabel(data: SubmittedAvailabilityData): string {
  const updated = data.submission.updated_at !== data.submission.submitted_at;
  const value = updated
    ? data.submission.updated_at
    : data.submission.submitted_at;
  const formatted = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
  return `${updated ? "Đã cập nhật" : "Đã gửi"} ${formatted}`;
}

function ScheduleState({
  data,
  error,
  team = false,
}: {
  data: PublishedScheduleData | null | undefined;
  error: string | null;
  team?: boolean;
}) {
  if (error) return <AppState title="Không tải được lịch" message={error} />;
  if (data === undefined)
    return (
      <AppState
        title="Một chút thôi…"
        message={team ? "Đang tải lịch tổng." : "Đang tải lịch chính thức."}
      />
    );
  if (data === null)
    return (
      <AppState
        title="Chưa có lịch được công bố"
        message="Quản lý chưa công bố lịch làm việc mới."
      />
    );
  return null;
}

export function SubmittedAvailability({
  data,
  compact = false,
}: {
  data: SubmittedAvailabilityData;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "submitted-schedule-section compact" : "submitted-schedule-section"}>
      {compact && (
        <header className="submitted-heading">
          <div>
            <span className="eyebrow">Đăng ký đã gửi</span>
            <strong>{formatWeekRange(data.weekStart)}</strong>
          </div>
        </header>
      )}
      <div className="my-schedule-list submitted-availability-list">
        {DAY_KEYS.map((key, index) => {
          const day = data.submission.availability.days[key];
          const preset = formatAvailabilityPreset(day);
          const offReason = getOffReason(day);
          const shiftValue = formatAvailabilityCell(day);
          return (
            <article key={key}>
              <div>
                <strong>{DAY_LABELS[key]}</strong>
                <span>{formatDateShort(addDateOnlyDays(data.weekStart, index))}</span>
              </div>
              <div className="submitted-day-value">
                <strong
                  className={
                    day.status === "off"
                      ? "day-off"
                      : "submitted-availability-shift"
                  }
                  style={
                    day.status === "available"
                      ? shiftStyle(semanticShiftColor(shiftValue))
                      : undefined
                  }
                >
                  {shiftValue}
                </strong>
                {preset && <span>{preset}</span>}
                {offReason && (
                  <span className="submitted-off-reason">
                    Lý do: {offReason}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {data.submission.note?.trim() && (
        <aside className="legacy-global-note">
          <strong>Ghi chú cũ</strong>
          <span>{data.submission.note.trim()}</span>
        </aside>
      )}
    </section>
  );
}

export function MySchedulePage({
  employeeId,
  onRegister,
}: {
  employeeId: string;
  onRegister: () => void;
}) {
  const { data, error } = useMySchedule(employeeId);
  if (error) return <AppState title="Không tải được lịch" message={error} />;
  if (data === undefined)
    return <AppState title="Một chút thôi…" message="Đang tải lịch của bạn." />;
  return <MyScheduleContent data={data} onRegister={onRegister} />;
}

export function MyScheduleContent({
  data,
  onRegister,
}: {
  data: MyScheduleData;
  onRegister: () => void;
}) {
  if (data === null)
    return (
      <AppState
        title="Chưa có lịch đã đăng ký"
        message="Bạn chưa gửi đăng ký lịch làm việc."
        action={{ label: "Đăng ký lịch", onClick: onRegister }}
      />
    );
  return (
    <main className="employee-schedule-page">
      <header>
        <span className="eyebrow">Lịch đã đăng ký</span>
        <h1>Lịch của tôi</h1>
        <p>{formatWeekRange(data.weekStart)}</p>
        <div className="submitted-waiting-status">
          {submittedTimeLabel(data)} · Chờ quản lý xếp lịch
        </div>
      </header>
      <SubmittedAvailability data={data} />
    </main>
  );
}

export function TeamSchedulePage({ employeeId }: { employeeId: string }) {
  const { data, error } = usePublishedSchedule(employeeId);
  const state = <ScheduleState data={data} error={error} team />;
  if (!data) return state;

  return (
    <main className="employee-schedule-page team-page">
      <header>
        <span className="eyebrow">Lịch chính thức</span>
        <h1>Lịch tổng</h1>
        <p>{formatWeekRange(data.week.weekStart)}</p>
      </header>
      <div className="team-schedule-scroll schedule-table-scroll">
        <ScheduleSheet
          className="published-schedule-sheet"
          groups={data.groups}
          employees={employeesForSchedule(data.employees, data.entries)}
          entries={data.entries}
          shifts={data.shifts}
          weekStart={data.week.weekStart}
          countOverrides={data.week.countOverrides}
          showStaffing
          highlightEmployeeId={data.currentEmployeeId}
        />
      </div>
    </main>
  );
}
