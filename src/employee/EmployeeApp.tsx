import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppState } from "../components/AppState";
import { AuthLoginPage } from "../components/AuthLoginPage";
import { employeeDestination } from "../auth/access";
import { configurationError, getSupabase } from "../lib/config";
import { clearEmployeeAvailabilityDrafts } from "../lib/draftStorage";
import { getEmployeeAccess } from "./api";

const EmployeeRegistrationPage = lazy(() =>
  import("./EmployeeRegistrationPage").then(({ EmployeeRegistrationPage }) => ({
    default: EmployeeRegistrationPage,
  })),
);
const MySchedulePage = lazy(() =>
  import("./ScheduleViews").then(({ MySchedulePage }) => ({
    default: MySchedulePage,
  })),
);
const TeamSchedulePage = lazy(() =>
  import("./ScheduleViews").then(({ TeamSchedulePage }) => ({
    default: TeamSchedulePage,
  })),
);

const sectionFallback = (
  <AppState title="Một chút thôi…" message="Đang tải nội dung." />
);

type Props = {
  loginRoute: boolean;
  section: "availability" | "my-schedule" | "team-schedule";
  navigate: (path: string) => void;
};

export function EmployeeHeader({
  section,
  navigate,
  onLogout,
}: {
  section: Props["section"];
  navigate: Props["navigate"];
  onLogout: () => void;
}) {
  const tabs: Array<{ section: Props["section"]; label: string; path: string }> = [
    { section: "availability", label: "Đăng ký lịch", path: "/app/availability" },
    { section: "my-schedule", label: "Lịch của tôi", path: "/app/my-schedule" },
    { section: "team-schedule", label: "Lịch tổng", path: "/app/team-schedule" },
  ];
  return (
    <header className="employee-header">
      <div className="employee-header-top">
        <div className="employee-brand">
          <span aria-hidden="true">SW</span>
          <div>
            <strong>ScheduleWork</strong>
            <small>Cổng nhân viên</small>
          </div>
        </div>
        <div className="employee-account-actions">
          <button type="button" onClick={() => navigate("/change-password")}>
            Đổi mật khẩu
          </button>
          <button type="button" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </div>
      <nav className="employee-tabs" aria-label="Điều hướng nhân viên">
        {tabs.map((tab) => (
          <button
            key={tab.section}
            type="button"
            className={section === tab.section ? "active" : ""}
            aria-current={section === tab.section ? "page" : undefined}
            onClick={() => navigate(tab.path)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

export function EmployeeApp({ loginRoute, section, navigate }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [employee, setEmployee] = useState<{
    id: string;
    name: string;
    active: boolean;
  } | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [submissionRevision, setSubmissionRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(configurationError);

  useEffect(() => {
    if (configurationError) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data, error: authError }) => {
      if (authError) setError("Không kiểm tra được phiên đăng nhập.");
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next);
        setAllowed(null);
        setEmployee(null);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setAllowed(null);
      return;
    }
    setLoading(true);
    getEmployeeAccess(session.user)
      .then((access) => {
        setAllowed(access.allowed);
        setMustChangePassword(access.mustChangePassword);
        setEmployee(access.employee);
      })
      .catch((reason) => {
        console.error(reason);
        setError(
          reason instanceof Error
            ? reason.message
            : "Không kiểm tra được quyền truy cập.",
        );
        setAllowed(false);
      })
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (!session || !allowed) return;
    const destination = employeeDestination({
      role: "employee",
      must_change_password: mustChangePassword,
    });
    if (mustChangePassword || loginRoute) navigate(destination);
  }, [allowed, loginRoute, mustChangePassword, navigate, session]);

  async function logout() {
    if (employee) clearEmployeeAvailabilityDrafts(employee.id);
    await getSupabase().auth.signOut();
    navigate("/login");
  }

  if (error) return <AppState title="Chưa thể mở đăng ký" message={error} />;
  if (loading)
    return (
      <AppState title="Một chút thôi…" message="Đang kiểm tra tài khoản." />
    );
  if (!session)
    return (
      <AuthLoginPage
        title="Đăng nhập nhân viên"
        description="Đăng nhập để đăng ký lịch làm việc của bạn."
      />
    );
  if (allowed === false)
    return (
      <AppState
        title="Không có quyền truy cập"
        message="Tài khoản này không phải tài khoản nhân viên đang hoạt động."
        action={{ label: "Đăng xuất", onClick: () => void logout() }}
      />
    );
  if (!allowed)
    return (
      <AppState title="Một chút thôi…" message="Đang kiểm tra tài khoản." />
    );
  if (mustChangePassword)
    return (
      <AppState
        title="Đổi mật khẩu"
        message="Đang chuyển đến trang đổi mật khẩu bắt buộc."
      />
    );
  return (
    <div className="employee-app">
      <EmployeeHeader
        section={section}
        navigate={navigate}
        onLogout={() => void logout()}
      />
      <Suspense fallback={sectionFallback}>
        {section === "availability" ? (
          <EmployeeRegistrationPage
            onLogout={logout}
            onSubmissionSaved={() => setSubmissionRevision((current) => current + 1)}
            employee={employee!}
          />
        ) : section === "my-schedule" ? (
          <MySchedulePage
            employeeId={employee!.id}
            submissionRevision={submissionRevision}
            onRegister={() => navigate("/app/availability")}
          />
        ) : (
          <TeamSchedulePage employeeId={employee!.id} />
        )}
      </Suspense>
    </div>
  );
}
