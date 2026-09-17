import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AppState } from "../components/AppState";
import { configurationError } from "../lib/config";
import { matchRoute } from "./router";

const AdminApp = lazy(() =>
  import("../admin/AdminApp").then(({ AdminApp }) => ({ default: AdminApp })),
);
const EmployeeApp = lazy(() =>
  import("../employee/EmployeeApp").then(({ EmployeeApp }) => ({
    default: EmployeeApp,
  })),
);
const ChangePasswordPage = lazy(() =>
  import("../employee/ChangePasswordPage").then(({ ChangePasswordPage }) => ({
    default: ChangePasswordPage,
  })),
);
const AdminSetupPage = lazy(() =>
  import("../components/AdminSetupPage").then(({ AdminSetupPage }) => ({
    default: AdminSetupPage,
  })),
);

const routeFallback = (
  <AppState title="Một chút thôi…" message="Đang chuẩn bị trang." />
);

type BrowserLocation = {
  pathname: string;
  search: string;
};

function readLocation(): BrowserLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

export default function App() {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const update = () => setLocation(readLocation());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback((path: string) => {
    window.history.pushState({}, "", path);
    setLocation(readLocation());
  }, []);
  const route = matchRoute(location.pathname);

  if (configurationError)
    return <AppState title="Thiếu cấu hình" message={configurationError} />;
  if (route.name === "setup")
    return (
      <Suspense fallback={routeFallback}>
        <AdminSetupPage navigate={navigate} />
      </Suspense>
    );
  if (route.name === "employee" || route.name === "employee-login") {
    return (
      <Suspense fallback={routeFallback}>
        <EmployeeApp
          loginRoute={route.name === "employee-login"}
          section={route.name === "employee" ? route.section : "availability"}
          navigate={navigate}
        />
      </Suspense>
    );
  }
  if (route.name === "change-password")
    return (
      <Suspense fallback={routeFallback}>
        <ChangePasswordPage navigate={navigate} />
      </Suspense>
    );
  if (route.name === "admin" || route.name === "admin-login")
    return (
      <Suspense fallback={routeFallback}>
        <AdminApp
          loginRoute={route.name === "admin-login"}
          section={route.name === "admin" ? route.section : "dashboard"}
          search={location.search}
          navigate={navigate}
        />
      </Suspense>
    );
  return (
    <AppState
      title="Không tìm thấy trang"
      message="Đường dẫn này không tồn tại hoặc không còn hiệu lực."
    />
  );
}
