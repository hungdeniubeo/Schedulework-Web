import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { AppState } from "../components/AppState";
import { BrandLogo } from "../components/BrandLogo";
import { CowMascot } from "../components/CowMascot";
import { selectEmployeeRegistrationWeek } from "../employee/registrationWeekSelection";
import {
  createEmployeeAccount,
  resetEmployeePassword,
  type TemporaryCredentials,
} from "../lib/serverApi";
import {
  formatAdminDeadline,
  formatWeekDisplay,
  isRegistrationLocked,
} from "../lib/week";
import type {
  AvailabilitySubmission,
  RegistrationWeekStatus,
} from "../types/domain";
import { listGroups, listSchedulerEmployees } from "../scheduling/api";
import type { CloudEmployee, Group } from "../scheduling/types";
import {
  createWeek,
  deleteWeek,
  listSubmissions,
  listWeeks,
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
const SUBMISSION_REFRESH_MS = 15_000;

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
export function AdminDashboard({
  session,
  section,
  navigate,
  onLogout,
}: Props) {
  const [employees, setEmployees] = useState<CloudEmployee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [weeks, setWeeks] = useState<Awaited<ReturnType<typeof listWeeks>>>([]);
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekBusy, setWeekBusy] = useState(false);
  const submissionsRequest = useRef(0);

  const refreshBase = useCallback(async () => {
    const [nextEmployees, nextGroups, nextWeeks] = await Promise.all([
      listSchedulerEmployees(),
      listGroups(),
      listWeeks(),
    ]);
    setEmployees(nextEmployees);
    setGroups(nextGroups);
    setWeeks(nextWeeks);
    setSelectedWeekId((current) =>
      current && nextWeeks.some((week) => week.id === current)
        ? current
        : (selectEmployeeRegistrationWeek(nextWeeks)?.id ?? ""),
    );
  }, []);

  useEffect(() => {
    if (
      section !== "dashboard"
      && section !== "availability"
      && section !== "schedule"
    ) {
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
    const request = ++submissionsRequest.current;
    if (!selectedWeekId) {
      setSubmissions([]);
      return;
    }
    try {
      const nextSubmissions = await listSubmissions(selectedWeekId);
      if (request === submissionsRequest.current)
        setSubmissions(nextSubmissions);
    } catch (reason) {
      console.error(reason);
      if (request === submissionsRequest.current)
        setError(
          reason instanceof Error ? reason.message : "Không tải được đăng ký.",
        );
    }
  }, [selectedWeekId]);

  useEffect(() => {
    if (section === "availability" || section === "dashboard")
      void refreshSubmissions();
  }, [refreshSubmissions, section]);

  useEffect(() => {
    if (section !== "availability" && section !== "dashboard") return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshSubmissions();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshTimer = window.setInterval(
      refreshWhenVisible,
      SUBMISSION_REFRESH_MS,
    );
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshTimer);
    };
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
      const created = await createWeek(weekStart, lockAt);
      await refreshBase();
      setSelectedWeekId(created.id);
      return created;
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

  async function removeWeek(id: string) {
    setWeekBusy(true);
    try {
      await deleteWeek(id);
      if (selectedWeekId === id) {
        setSelectedWeekId("");
        setSubmissions([]);
      }
      await refreshBase();
    } finally {
      setWeekBusy(false);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="brand-lockup">
          <BrandLogo home={{ path: "/admin", navigate }} />
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
          ["dashboard", "/admin", "Trang chủ"],
          ["availability", "/admin/availability", "Đăng ký nhân viên"],
          ["schedule", "/admin/schedule", "Xếp lịch"],
          ["employees", "/admin/employees", "Nhân viên"],
          ["groups", "/admin/groups", "Nhóm"],
          ["shifts", "/admin/shifts", "Ca làm"],
        ].map(([key, path, label]) => (
          <button
            key={key}
            type="button"
            className={section === key ? "active" : ""}
            aria-current={section === key ? "page" : undefined}
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
            <AdminScheduler
              preferredWeekStart={selectedWeek?.week_start}
              registrationWeekStarts={weeks.map((week) => week.week_start)}
              onWeekStartChange={(weekStart) => {
                const matching = weeks.find((week) => week.week_start === weekStart);
                setSelectedWeekId(matching?.id ?? "");
              }}
              onOpenAvailability={() => navigate("/admin/availability")}
            />
          </Suspense>
        ) : section === "dashboard" ? (
          <div className="admin-home-page">
            <section className="admin-home-welcome">
              <div className="admin-home-welcome-copy">
                <span className="eyebrow">ScheduleWork · Gyu-Kaku</span>
                <h1>Sẵn sàng cho một tuần làm việc thật nhịp nhàng.</h1>
                <p>
                  Theo dõi đăng ký của đội ngũ, xếp ca và công bố lịch từ một
                  nơi duy nhất.
                </p>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => navigate("/admin/availability")}
                >
                  Xem đăng ký tuần này
                </button>
              </div>
              <CowMascot />
            </section>
            <div className="admin-home-grid">
            <button
              type="button"
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
              type="button"
              className="panel"
              onClick={() => navigate("/admin/schedule")}
            >
              <span className="eyebrow">Lịch chính thức</span>
              <strong>Xếp lịch</strong>
              <p>Tạo bản nháp, kiểm tra và công bố lịch.</p>
            </button>
            <button
              type="button"
              className="panel"
              onClick={() => navigate("/admin/employees")}
            >
              <span className="eyebrow">Đội ngũ</span>
              <strong>{activeEmployees.length}</strong>
              <p>nhân viên đang hoạt động</p>
            </button>
          </div>
          </div>
        ) : (
          <div className="availability-admin-page">
            <section className="panel availability-admin-hero">
              <div>
                <span className="eyebrow">Đăng ký lịch làm việc</span>
                <h1>
                  {selectedWeek
                    ? formatWeekDisplay(selectedWeek.week_start)
                    : "Lịch đăng ký nhân viên"}
                </h1>
                <p>
                  Theo dõi đăng ký, xử lý trường hợp còn thiếu và chuyển sang
                  xếp lịch đúng tuần.
                </p>
              </div>
              <div className="availability-progress-card">
                <span>Tiến độ tuần</span>
                <strong>
                  {submittedActive}<small>/{activeEmployees.length}</small>
                </strong>
                <p>nhân viên đã gửi</p>
              </div>
            </section>
            <Suspense fallback={sectionFallback}>
              <div className="dashboard-grid">
                <WeekManager
                  weeks={weeks}
                  selectedId={selectedWeekId}
                  busy={weekBusy}
                  onSelect={setSelectedWeekId}
                  onCreate={addWeek}
                  onUpdate={patchWeek}
                  onDelete={removeWeek}
                />
                <section className="panel availability-week-summary">
                  <span className="eyebrow">Tổng quan tuần</span>
                  {selectedWeek && (
                    <>
                      <div className="availability-summary-row">
                        <span>Trạng thái</span>
                        <span
                          className={`status-badge ${selectedWeek.status === "archived" ? "archived" : selectedWeekLocked ? "locked" : "open"}`}
                        >
                          {selectedWeek.status === "archived"
                            ? "Đã lưu trữ"
                            : selectedWeekLocked
                              ? "Đã khóa"
                              : "Đang mở"}
                        </span>
                      </div>
                      <div className="availability-summary-row">
                        <span>Hạn đăng ký</span>
                        <strong>{formatAdminDeadline(selectedWeek.lock_at)}</strong>
                      </div>
                      <div className="availability-summary-row">
                        <span>Chưa đăng ký</span>
                        <strong>
                          {Math.max(0, activeEmployees.length - submittedActive)} nhân viên
                        </strong>
                      </div>
                    </>
                  )}
                </section>
              </div>
              {selectedWeek ? (
                <AdminMatrix
                  employees={employees}
                  groups={groups}
                  submissions={submissions}
                  weekStart={selectedWeek.week_start}
                  onOpenScheduler={() => navigate("/admin/schedule")}
                />
              ) : (
                <div className="panel empty-panel">
                  Hãy tạo một tuần đăng ký để bắt đầu.
                </div>
              )}
            </Suspense>
          </div>
        )}
      </main>
      <footer
        className="love-gyukaku-banner"
        aria-label="I love Gyu-kaku ❤️❤️❤️"
      >
        <div className="love-gyukaku-track" aria-hidden="true">
          {[0, 1].map((group) => (
            <div className="love-gyukaku-group" key={group}>
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <span className="love-gyukaku-message" key={item}>
                  I love Gyu-kaku{" "}
                  <span className="love-gyukaku-hearts">❤️❤️❤️</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
