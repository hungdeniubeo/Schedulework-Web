export type AppRoute =
  | {
      name: "employee";
      section: "availability" | "my-schedule" ;
    }
  | { name: "employee-login" }
  | { name: "change-password" }
  | {
      name: "admin";
      section:
        | "dashboard"
        | "availability"
        | "schedule"
        | "employees"
        | "groups"
        | "shifts";
    }
  | { name: "admin-login" }
  | { name: "not-found" };

export function matchRoute(pathname: string): AppRoute {
  if (
    pathname === "/" ||
    pathname === "/app" ||
    pathname === "/app/availability"
  ) {
    return { name: "employee", section: "availability" };
  }
  if (pathname === "/app/my-schedule")
    return { name: "employee", section: "my-schedule" };
  if (pathname === "/login") return { name: "employee-login" };
  if (pathname === "/change-password") return { name: "change-password" };
  if (pathname === "/admin") return { name: "admin", section: "dashboard" };
  const adminSection =
    /^\/admin\/(availability|schedule|employees|groups|shifts)$/.exec(
      pathname,
    )?.[1];
  if (adminSection)
    return {
      name: "admin",
      section: adminSection as
        | "availability"
        | "schedule"
        | "employees"
        | "groups"
        | "shifts",
    };
  if (pathname === "/admin/login") return { name: "admin-login" };
  return { name: "not-found" };
}
