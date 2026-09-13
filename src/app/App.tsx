import { useCallback, useEffect, useState } from "react";
import { AdminApp } from "../admin/AdminApp";
import { AppState } from "../components/AppState";
import { EmployeeApp } from "../employee/EmployeeApp";
import { ChangePasswordPage } from "../employee/ChangePasswordPage";
import { configurationError } from "../lib/config";
import { matchRoute } from "./router";

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback((path: string) => {
    window.history.pushState({}, "", path);
    setPathname(path);
  }, []);
  const route = matchRoute(pathname);

  if (configurationError)
    return <AppState title="Thiếu cấu hình" message={configurationError} />;
  if (route.name === "employee" || route.name === "employee-login") {
    return (
      <EmployeeApp
        loginRoute={route.name === "employee-login"}
        section={route.name === "employee" ? route.section : "availability"}
        navigate={navigate}
      />
    );
  }
  if (route.name === "change-password")
    return <ChangePasswordPage navigate={navigate} />;
  if (route.name === "admin" || route.name === "admin-login")
    return (
      <AdminApp
        loginRoute={route.name === "admin-login"}
        section={route.name === "admin" ? route.section : "dashboard"}
        navigate={navigate}
      />
    );
  return (
    <AppState
      title="Không tìm thấy trang"
      message="Đường dẫn này không tồn tại hoặc không còn hiệu lực."
    />
  );
}
