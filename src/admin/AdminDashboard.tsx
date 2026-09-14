import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppState } from "../components/AppState";
import {
  createEmployeeAccount,
  resetEmployeePassword,
  type TemporaryCredentials,
} from "../lib/serverApi";
import { isRegistrationLocked } from "../lib/week";
import type {
  AdminEmployee,
  Availability,
  AvailabilitySubmission,
  RegistrationWeekStatus,
} from "../types/domain";
import {
  createWeek,
  listEmployees,
  listSubmissions,
  listWeeks,
  saveAdminSubmission,
  updateWeek,
} from "./api";

const AdminMatrix = lazy(() =>
  import("./AdminMatrix").then(({ AdminMatrix }) => ({ default: AdminMatrix })),
);
const EmployeeManager = lazy(() =>
  import("./EmployeeManager").then(({ EmployeeManager }) => ({
    default: EmployeeManager,
  })),
);
const SubmissionDialog = lazy(() =>
  import("./SubmissionDialog").then(({ SubmissionDialog }) => ({
    default: SubmissionDialog,
  })),
);
const WeekManager = lazy(() =>
  import("./WeekManager").then(({ WeekManager }) => ({ default: WeekManager })),
);
const AdminScheduler = lazy(() =>
  import("./AdminScheduler").then(({ AdminScheduler }) => ({
    default: AdminScheduler,
  })),
);
const GroupManager = lazy(() =>
  import("./GroupManager").then(({ GroupManager }) => ({ default: GroupManager })),
);
const ShiftManager = lazy(() =>
  import("./ShiftManager").then(({ ShiftManager }) => ({ default: ShiftManager })),
);

const sectionFallback = (
  <AppState title="Một chút thôi…" message="Đang tải nội dung." />
);

type Props = {
  session: Session;
  section:
    | "dashboard"
    | "availability"
    | "schedule"
    | "employees"
    | "groups"
    | "shifts";
  navigate: (path: string) => void;
  onLogout: () => Promise<void>;
};
type SelectedSubmission = {
  employee: AdminEmployee;
  submission: AvailabilitySubmission | null;
};

export function AdminDashboard({
  session,
  section,
  navigate,
  onLogout,
}: Props) {
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [weeks, setWeeks] = useState<Awaited<ReturnType<typeof listWeeks>>>([]);
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekBusy, setWeekBusy] = useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    useState<SelectedSubmission | null>(null);
  const [savingSubmission, setSavingSubmission] = useState(false);

  const refreshBase = useCallback(async () => {
    const [nextEmployees, nextWeeks] = await Promise.all([
      listEmployees(),
      listWeeks(),
    ]);
    setEmployees(nextEmployees);
    setWeeks(nextWeeks);
    setSelectedWeekId((current) =>
      current && nextWeeks.some((week) => week.id === current)
        ? current
        : ((
            nextWeeks.find((week) => week.status !== "archived") ?? nextWeeks[0]
          )?.id ?? ""),
    );
  }, []);

  useEffect(() => {
    if (section !== "dashboard" && section !== "availability") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    refreshBase()
      .catch((reason) => {
        console.error(reason);
        setError(
          reason instanceof Error
            ? reason.message
            : "Không tải được dashboard.",
        );
      })
      .finally(() => setLoading(false));
  }, [refreshBase, section]);

  const refreshSubmissions = useCallback(async () => {
    if (!selectedWeekId) return setSubmissions([]);
    try {
      setSubmissions(await listSubmissions(selectedWeekId));
    } catch (reason) {
      console.error(reason);
      setError(
        reason instanceof Error ? reason.message : "Không tải được đăng ký.",
      );
    }
  }, [selectedWeekId]);

  useEffect(() => {
    if (section === "availability") void refreshSubmissions();
  }, [refreshSubmissions, section]);

  const selectedWeek = weeks.find((week) => week.id === selectedWeekId) ?? null;
  const selectedWeekLocked = selectedWeek
    ? isRegistrationLocked(selectedWeek.status, selectedWeek.lock_at)
    : false;
  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.active),
    [employees],
  );
  const submittedActive = useMemo(() => {
    const active = new Set(activeEmployees.map((employee) => employee.id));
    return new Set(
      submissions
        .filter((item) => active.has(item.employee_id))
        .map((item) => item.employee_id),
    ).size;
  }, [activeEmployees, submissions]);

  async function addEmployee(
    name: string,
    email: string,
  ): Promise<TemporaryCredentials> {
    const credentials = await createEmployeeAccount({
      name,
      email,
      accessToken: session.access_token,
    });
    return credentials;
  }

  async function resetPassword(
    employeeId: string,
  ): Promise<TemporaryCredentials> {
    return resetEmployeePassword(employeeId, session.access_token);
  }

  async function addWeek(weekStart: string, lockAt: string) {
    setWeekBusy(true);
    try {
      await createWeek(weekStart, lockAt);
      await refreshBase();
    } finally {
      setWeekBusy(false);
    }
  }

  async function patchWeek(
    id: string,
    changes: { status?: RegistrationWeekStatus; lock_at?: string },
  ) {
    setWeekBusy(true);
    try {
      await updateWeek(id, changes);
      await refreshBase();
    } finally {
      setWeekBusy(false);
    }
  }

  async function saveDetail(availability: Availability, note: string) {
    if (!selectedSubmission || !selectedWeek) return;
    setSavingSubmission(true);
    try {
      await saveAdminSubmission({
        id: selectedSubmission.submission?.id,
        weekId: selectedWeek.id,
        employeeId: selectedSubmission.employee.id,
        availability,
        note,
      });
      await refreshSubmissions();
      setSelectedSubmission(null);
    } finally {
      setSavingSubmission(false);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="brand-lockup">
          <span>SW</span>
          <div>
            <strong>ScheduleWork</strong>
            <small>Đăng ký lịch nhân viên</small>
          </div>
        </div>
        <button
          className="button ghost"
          type="button"
          onClick={() => void onLogout()}
        >
          Đăng xuất
        </button>
      </header>
      <nav className="admin-tabs">
        {[
          ["dashboard", "/admin", "Dashboard"],
          ["availability", "/admin/availability", "Đăng ký nhân viên"],
          ["schedule", "/admin/schedule", "Xếp lịch"],
          ["employees", "/admin/employees", "Nhân viên"],
          ["groups", "/admin/groups", "Nhóm"],
          ["shifts", "/admin/shifts", "Ca làm"],
        ].map(([key, path, label]) => (
          <button
            key={key}
            className={section === key ? "active" : ""}
            onClick={() => navigate(path)}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className="admin-main">
        {loading ? (
          <div className="empty-panel">Đang tải dashboard...</div>
        ) : error ? (
          <div className="inline-error">
            {error}
            <button
              className="button ghost"
              onClick={() => window.location.reload()}
            >
              Thử lại
            </button>
          </div>
        ) : section === "employees" ? (
          <Suspense fallback={sectionFallback}>
            <EmployeeManager
              onAdd={addEmployee}
              onResetPassword={resetPassword}
            />
          </Suspense>
        ) : section === "groups" ? (
          <Suspense fallback={sectionFallback}>
            <GroupManager />
          </Suspense>
        ) : section === "shifts" ? (
          <Suspense fallback={sectionFallback}>
            <ShiftManager />
          </Suspense>
        ) : section === "schedule" ? (
          <Suspense fallback={sectionFallback}>
            <AdminScheduler />
          </Suspense>
        ) : section === "dashboard" ? (
          <div className="admin-home-grid">
            <button
              className="panel"
              onClick={() => navigate("/admin/availability")}
            >
              <span className="eyebrow">Đăng ký</span>
              <strong>
                {submittedActive} / {activeEmployees.length}
              </strong>
              <p>nhân viên đã đăng ký tuần đang chọn</p>
            </button>
            <button
              className="panel"
              onClick={() => navigate("/admin/schedule")}
            >
              <span className="eyebrow">Lịch chính thức</span>
              <strong>Xếp lịch</strong>
              <p>Tạo bản nháp, kiểm tra và công bố lịch.</p>
            </button>
            <button
              className="panel"
              onClick={() => navigate("/admin/employees")}
            >
              <span className="eyebrow">Đội ngũ</span>
              <strong>{activeEmployees.length}</strong>
              <p>nhân viên đang hoạt động</p>
            </button>
          </div>
        ) : (
          <>
            <Suspense fallback={sectionFallback}>
              <div className="dashboard-grid">
                <WeekManager
                  weeks={weeks}
                  selectedId={selectedWeekId}
                  busy={weekBusy}
                  onSelect={setSelectedWeekId}
                  onCreate={addWeek}
                  onUpdate={patchWeek}
                />
                <section className="panel summary-panel">
                  <span className="eyebrow">Tiến độ đăng ký</span>
                  <strong>
                    {submittedActive} / {activeEmployees.length}
                  </strong>
                  <p>nhân viên đã đăng ký</p>
                  {selectedWeek && (
                    <span
                      className={`status-badge ${selectedWeek.status === "archived" ? "archived" : selectedWeekLocked ? "locked" : "open"}`}
                    >
                      {selectedWeek.status === "archived"
                        ? "Đã lưu trữ"
                        : selectedWeekLocked
                          ? "Đã khóa"
                          : "Đang mở"}
                    </span>
                  )}
                </section>
              </div>
              {selectedWeek ? (
                <AdminMatrix
                  employees={employees}
                  submissions={submissions}
                  onSelect={(employee, submission) =>
                    setSelectedSubmission({ employee, submission })
                  }
                />
              ) : (
                <div className="panel empty-panel">
                  Hãy tạo một tuần đăng ký để bắt đầu.
                </div>
              )}
            </Suspense>
          </>
        )}
      </main>
      {selectedSubmission && selectedWeek && (
        <Suspense fallback={sectionFallback}>
          <SubmissionDialog
            employee={selectedSubmission.employee}
            submission={selectedSubmission.submission}
            weekStart={selectedWeek.week_start}
            saving={savingSubmission}
            onClose={() => setSelectedSubmission(null)}
            onSave={saveDetail}
          />
        </Suspense>
      )}
    </div>
  );
}
