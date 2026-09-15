import { useEffect, useState } from "react";
import "./TeamSchedule.css";
import { AppState } from "../components/AppState";
import { DAY_KEYS } from "../types/domain";
import {
  DAY_LABELS,
  formatAvailabilityCell,
  formatAvailabilityPreset,
  getOffReason,
} from "../lib/availability";
import {
  addDateOnlyDays,
  formatDateShort,
  formatWeekDisplay,
} from "../lib/week";
import { ScheduleSheet } from "../scheduling/ScheduleSheet";
import { ArrowLeftRightIcon, DownloadIcon } from "../components/Icons";
import { employeesForSchedule } from "../scheduling/scheduleSheetModel";
import {
  semanticShiftColor,
  shiftStyle,
} from "../scheduling/shiftStyle";
import { exportScheduleJpg } from "../scheduling/exportJpg";
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

export function myScheduleRequestKey(
  employeeId: string,
  submissionRevision: number,
): string {
  return `${employeeId}:${submissionRevision}`;
}

function useMySchedule(employeeId: string, submissionRevision: number) {
  const [data, setData] = useState<MyScheduleData | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const requestKey = myScheduleRequestKey(employeeId, submissionRevision);
  useEffect(() => {
    let active = true;
    setError(null);
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
  }, [employeeId, requestKey]);
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
            <strong>{formatWeekDisplay(data.weekStart)}</strong>
          </div>
        </header>
      )}
      <div className="my-schedule-list submitted-availability-list">
        {DAY_KEYS.map((key, index) => {
          const day = data.submission.availability.days[key];
          const preset = formatAvailabilityPreset(day);
          const offReason = getOffReason(day);
          const shiftValue = formatAvailabilityCell(day);
          const date = addDateOnlyDays(data.weekStart, index);
          return (
            <article key={key}>
              <div className="submitted-day-date">
                <strong>{DAY_LABELS[key]}</strong>
                <time dateTime={date}>{formatDateShort(date)}</time>
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
                {preset && <span className="submitted-day-period">{preset}</span>}
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
  submissionRevision,
  onRegister,
}: {
  employeeId: string;
  submissionRevision: number;
  onRegister: () => void;
}) {
  const { data, error } = useMySchedule(employeeId, submissionRevision);
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
        <p>{formatWeekDisplay(data.weekStart)}</p>
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

  return <TeamScheduleContent data={data} />;
}

export function TeamScheduleContent({
  data,
}: {
  data: PublishedScheduleData;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const scheduleEmployees = employeesForSchedule(data.employees, data.entries);

  async function downloadSchedule() {
    setExporting(true);
    setExportError(null);
    try {
      await exportScheduleJpg(
        "employee-published-schedule-export",
        data.week.weekStart,
      );
    } catch (reason) {
      setExportError(
        reason instanceof Error ? reason.message : "Không tải được ảnh lịch.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <main className="employee-schedule-page team-page">
        <header className="team-page-header">
          <div>
            <span className="eyebrow">Lịch chính thức</span>
            <h1>Lịch tổng</h1>
            <p>{formatWeekDisplay(data.week.weekStart)}</p>
          </div>
          <div className="team-download-action">
            <button
              type="button"
              className="button secondary team-download-button"
              disabled={exporting}
              onClick={() => void downloadSchedule()}
            >
              <DownloadIcon />
              {exporting ? "Đang tạo ảnh…" : "Tải ảnh lịch"}
            </button>
            {exportError && <span role="alert">{exportError}</span>}
          </div>
        </header>
        <div className="team-scroll-guide" aria-hidden="true">
          <span><ArrowLeftRightIcon /></span>
          Vuốt ngang để xem đủ 7 ngày
        </div>
        <div className="team-schedule-scroll schedule-table-scroll">
          <ScheduleSheet
            className="published-schedule-sheet"
            groups={data.groups}
            employees={scheduleEmployees}
            entries={data.entries}
            shifts={data.shifts}
            weekStart={data.week.weekStart}
            countOverrides={data.week.countOverrides}
            showStaffing
            highlightEmployeeId={data.currentEmployeeId}
          />
        </div>
      </main>
      <div className="schedule-export-stage" aria-hidden="true">
        <ScheduleSheet
          id="employee-published-schedule-export"
          groups={data.groups}
          employees={scheduleEmployees}
          entries={data.entries}
          shifts={data.shifts}
          weekStart={data.week.weekStart}
          countOverrides={data.week.countOverrides}
          showStaffing
        />
      </div>
    </>
  );
}
