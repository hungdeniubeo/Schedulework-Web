import { useEffect, useState } from "react";
import { AppState } from "../components/AppState";
import { DAY_KEYS } from "../types/domain";
import {
  DAY_LABELS,
  formatAvailabilityCell,
  formatAvailabilityPreset,
} from "../lib/availability";
import { addDateOnlyDays, formatDateShort, formatWeekRange } from "../lib/week";
import { ScheduleSheet } from "../scheduling/ScheduleSheet";
import { employeesForSchedule } from "../scheduling/scheduleSheetModel";
import { entryLabel } from "../scheduling/overlap";
import { formatShiftLabel, shiftStyle } from "../scheduling/shiftStyle";
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

function SubmittedAvailability({
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
          return (
            <article key={key}>
              <div>
                <strong>{DAY_LABELS[key]}</strong>
                <span>{formatDateShort(addDateOnlyDays(data.weekStart, index))}</span>
              </div>
              <div className="submitted-day-value">
                <strong className={day.status === "off" ? "day-off" : ""}>
                  {formatAvailabilityCell(day)}
                </strong>
                {preset && <span>{preset}</span>}
              </div>
            </article>
          );
        })}
      </div>
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
  if (!data)
    return <AppState title="Một chút thôi…" message="Đang tải lịch của bạn." />;
  if (!data.published && !data.submitted)
    return (
      <AppState
        title="Chưa có lịch"
        message="Bạn chưa gửi đăng ký và quản lý chưa công bố lịch làm việc mới."
        action={{ label: "Đăng ký lịch", onClick: onRegister }}
      />
    );

  if (!data.published && data.submitted) {
    return (
      <main className="employee-schedule-page">
        <header>
          <span className="eyebrow">Lịch đã đăng ký</span>
          <h1>Lịch của tôi</h1>
          <p>{formatWeekRange(data.submitted.weekStart)}</p>
          <div className="submitted-waiting-status">Đã gửi · Chờ quản lý xếp lịch</div>
        </header>
        <SubmittedAvailability data={data.submitted} />
      </main>
    );
  }

  const published = data.published!;

  const ownEntries = published.entries.filter(
    (entry) => entry.employeeId === published.currentEmployeeId,
  );
  return (
    <main className="employee-schedule-page">
      <header>
        <span className="eyebrow">Lịch chính thức</span>
        <h1>Lịch của tôi</h1>
        <p>{formatWeekRange(published.week.weekStart)}</p>
      </header>
      <div className="my-schedule-list">
        {DAY_KEYS.map((key, index) => {
          const entries = ownEntries.filter(
            (entry) => entry.dayOfWeek === Number(key),
          );
          return (
            <article key={key}>
              <div>
                <strong>
                  {key === "7" ? "Chủ nhật" : `Thứ ${Number(key) + 1}`}
                </strong>
                <span>
                  {formatDateShort(addDateOnlyDays(published.week.weekStart, index))}
                </span>
              </div>
              {entries.length ? (
                entries.map((entry) => {
                  const shift = published.shifts.find(
                    (item) => item.id === entry.shiftTypeId,
                  );
                  return (
                    <span
                      className="published-shift"
                      style={shiftStyle(shift?.color ?? "#A6A6A6")}
                      key={entry.id}
                    >
                      {formatShiftLabel(entryLabel(entry, published.shifts))}
                    </span>
                  );
                })
              ) : (
                <span className="day-off">Nghỉ</span>
              )}
            </article>
          );
        })}
      </div>
      {data.submitted && <SubmittedAvailability data={data.submitted} compact />}
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
        />
      </div>
    </main>
  );
}
