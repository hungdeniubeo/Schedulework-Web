import { useEffect, useState } from "react";
import { AppState } from "../components/AppState";
import { DAY_KEYS } from "../types/domain";
import { addDateOnlyDays, formatDateShort, formatWeekRange } from "../lib/week";
import { ScheduleSheet } from "../scheduling/ScheduleSheet";
import { employeesForSchedule } from "../scheduling/scheduleSheetModel";
import { entryLabel } from "../scheduling/overlap";
import { formatShiftLabel, shiftStyle } from "../scheduling/shiftStyle";
import type { PublishedScheduleData } from "./scheduleApi";
import { loadPublishedSchedule } from "./scheduleApi";

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

export function MySchedulePage({ employeeId }: { employeeId: string }) {
  const { data, error } = usePublishedSchedule(employeeId);
  const state = <ScheduleState data={data} error={error} />;
  if (!data) return state;

  const ownEntries = data.entries.filter(
    (entry) => entry.employeeId === data.currentEmployeeId,
  );
  return (
    <main className="employee-schedule-page">
      <header>
        <span className="eyebrow">Lịch chính thức</span>
        <h1>Lịch của tôi</h1>
        <p>{formatWeekRange(data.week.weekStart)}</p>
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
                  {formatDateShort(addDateOnlyDays(data.week.weekStart, index))}
                </span>
              </div>
              {entries.length ? (
                entries.map((entry) => {
                  const shift = data.shifts.find(
                    (item) => item.id === entry.shiftTypeId,
                  );
                  return (
                    <span
                      className="published-shift"
                      style={shiftStyle(shift?.color ?? "#A6A6A6")}
                      key={entry.id}
                    >
                      {formatShiftLabel(entryLabel(entry, data.shifts))}
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
