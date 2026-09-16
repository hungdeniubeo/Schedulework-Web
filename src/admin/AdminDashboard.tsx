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
import {
  createEmployeeAccount,
  resetEmployeePassword,
  type TemporaryCredentials,
} from "../lib/serverApi";
import type {
  AvailabilitySubmission,
  RegistrationWeekStatus,
} from "../types/domain";
import {
  listGroups,
  listSchedulerEmployees,
} from "../scheduling/api";
import type { CloudEmployee, Group } from "../scheduling/types";
import {
  createWeek,
  deleteWeek,
  listSubmissions,
  listWeeks,
  updateWeek,
} from "./api";
import {
  adminWeekPath,
  resolveAdminRegistrationWeek,
  weekStartFromSearch,
} from "./adminWeekSelection";
import { AdminNavigation, type AdminSection } from "./AdminNavigation";

const AdminAvailabilityPage = lazy(() =>
  import("./AdminAvailabilityPage").then(({ AdminAvailabilityPage }) => ({
    default: AdminAvailabilityPage,
  })),
);
const RegistrationWeeksPage = lazy(() =>
  import("./RegistrationWeeksPage").then(({ RegistrationWeeksPage }) => ({
    default: RegistrationWeeksPage,
  })),
);
const AdminSchedulePage = lazy(() =>
  import("./AdminSchedulePage").then(({ AdminSchedulePage }) => ({
    default: AdminSchedulePage,
  })),
);
const EmployeeManager = lazy(() =>
  import("./EmployeeManager").then(({ EmployeeManager }) => ({
    default: EmployeeManager,
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
  section: AdminSection;
  search: string;
  navigate: (path: string) => void;
  onLogout: () => Promise<void>;
};

export function AdminDashboard({
  session,
  section,
  search,
  navigate,
  onLogout,
}: Props) {
  const [employees, setEmployees] = useState<CloudEmployee[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [weeks, setWeeks] = useState<Awaited<ReturnType<typeof listWeeks>>>([]);
  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekBusy, setWeekBusy] = useState(false);
  const submissionsRequest = useRef(0);

  const requestedWeekStart = weekStartFromSearch(search);
  const { week: selectedWeek, invalidRequestedWeek } =
    resolveAdminRegistrationWeek(weeks, requestedWeekStart);
  const selectedWeekId = selectedWeek?.id ?? "";

  const refreshBase = useCallback(async () => {
    const [nextEmployees, nextGroups, nextWeeks] = await Promise.all([
      listSchedulerEmployees(),
      listGroups(),
      listWeeks(),
    ]);
    setEmployees(nextEmployees);
    setGroups(nextGroups);
    setWeeks(nextWeeks);
    return { nextWeeks };
  }, []);

  useEffect(() => {
    if (
      section !== "dashboard" &&
      section !== "availability" &&
      section !== "registration-weeks" &&
      section !== "schedule"
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
      if (request === submissionsRequest.current) setSubmissions(nextSubmissions);
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
    return createEmployeeAccount({
      name,
      email,
      accessToken: session.access_token,
    });
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
      navigate(adminWeekPath("/admin/registration-weeks", created.week_start));
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
      const archivingSelected =
        changes.status === "archived" && selectedWeekId === id;
      await updateWeek(id, changes);
      const { nextWeeks } = await refreshBase();
      if (archivingSelected) {
        const next = resolveAdminRegistrationWeek(nextWeeks, null).week;
        navigate(
          next
            ? adminWeekPath("/admin/registration-weeks", next.week_start)
            : "/admin/registration-weeks",
        );
      }
    } finally {
      setWeekBusy(false);
    }
  }

  async function removeWeek(id: string) {
    setWeekBusy(true);
    try {
      const deletingSelectedWeek = selectedWeekId === id;
      await deleteWeek(id);
      const { nextWeeks } = await refreshBase();
      if (deletingSelectedWeek) {
        setSubmissions([]);
        const next = resolveAdminRegistrationWeek(nextWeeks, null).week;
        navigate(
          next
            ? adminWeekPath("/admin/registration-weeks", next.week_start)
            : "/admin/registration-weeks",
        );
      }
    } finally {
      setWeekBusy(false);
    }
  }

  const availabilityPath = selectedWeek
    ? adminWeekPath("/admin/availability", selectedWeek.week_start)
    : "/admin/availability";
  const schedulePath = selectedWeek
    ? adminWeekPath("/admin/schedule", selectedWeek.week_start)
    : "/admin/schedule";

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
      <AdminNavigation
        section={section}
        selectedWeekStart={selectedWeek?.week_start ?? null}
        navigate={navigate}
      />
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
        ) : section === "registration-weeks" ? (
          <Suspense fallback={sectionFallback}>
            <RegistrationWeeksPage
              weeks={weeks}
              selectedId={selectedWeekId}
              busy={weekBusy}
              onSelect={(id) => {
                const next = weeks.find((week) => week.id === id);
                if (next)
                  navigate(
                    adminWeekPath(
                      "/admin/registration-weeks",
                      next.week_start,
                    ),
                  );
              }}
              onCreate={addWeek}
              onUpdate={patchWeek}
              onDelete={removeWeek}
            />
          </Suspense>
        ) : section === "schedule" ? (
          <Suspense fallback={sectionFallback}>
            <AdminSchedulePage
              selectedWeek={selectedWeek}
              invalidRequestedWeek={invalidRequestedWeek}
              registrationWeekStarts={weeks.map((week) => week.week_start)}
              navigate={navigate}
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
                  onClick={() => navigate(availabilityPath)}
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
                onClick={() => navigate(availabilityPath)}
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
                onClick={() => navigate(schedulePath)}
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
          <Suspense fallback={sectionFallback}>
            <AdminAvailabilityPage
              selectedWeek={selectedWeek}
              invalidRequestedWeek={invalidRequestedWeek}
              employees={employees}
              groups={groups}
              submissions={submissions}
              navigate={navigate}
            />
          </Suspense>
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
