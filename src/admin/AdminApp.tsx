import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppState } from "../components/AppState";
import { AuthLoginPage } from "../components/AuthLoginPage";
import { configurationError, getSupabase } from "../lib/config";
import "./AdminScheduleLegacy.css";
import { isAdmin } from "./api";

const AdminDashboard = lazy(() =>
  import("./AdminDashboard").then(({ AdminDashboard }) => ({
    default: AdminDashboard,
  })),
);

const dashboardFallback = (
  <AppState title="Một chút thôi…" message="Đang tải dashboard." />
);

type Props = {
  loginRoute: boolean;
  section:
    | "dashboard"
    | "availability"
    | "registration-weeks"
    | "schedule"
    | "employees"
    | "groups"
    | "shifts";
  search: string;
  navigate: (path: string) => void;
};

export function AdminApp({ loginRoute, section, search, navigate }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(configurationError);

  useEffect(() => {
    if (configurationError) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError("Không kiểm tra được phiên đăng nhập.");
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next);
        setAllowed(null);
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
    isAdmin(session.user)
      .then((value) => setAllowed(value))
      .catch((reason) => {
        console.error(reason);
        setError("Không kiểm tra được quyền quản trị.");
        setAllowed(false);
      })
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    if (session && allowed && loginRoute) navigate("/admin");
  }, [allowed, loginRoute, navigate, session]);

  async function logout() {
    await getSupabase().auth.signOut();
    navigate("/admin/login");
  }

  if (error)
    return <AppState title="Chưa thể mở trang quản trị" message={error} />;
  if (loading)
    return (
      <AppState
        title="Một chút thôi…"
        message="Đang kiểm tra quyền truy cập."
      />
    );
  if (!session)
    return (
      <AuthLoginPage
        title="Đăng nhập quản trị"
        description="Xem và quản lý đăng ký lịch nhân viên."
      />
    );
  if (allowed === false)
    return (
      <AppState
        title="Không có quyền truy cập"
        message="Tài khoản này chưa được thêm vào danh sách admin."
        action={{ label: "Đăng xuất", onClick: () => void logout() }}
      />
    );
  if (!allowed)
    return (
      <AppState
        title="Một chút thôi…"
        message="Đang kiểm tra quyền truy cập."
      />
    );
  return (
    <Suspense fallback={dashboardFallback}>
      <AdminDashboard
        session={session}
        section={section}
        search={search}
        navigate={navigate}
        onLogout={logout}
      />
    </Suspense>
  );
}
