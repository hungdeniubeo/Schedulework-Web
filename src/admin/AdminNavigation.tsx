import "./AdminNavigation.css";
import { adminWeekPath } from "./adminWeekSelection";

export type AdminSection =
  | "dashboard"
  | "availability"
  | "registration-weeks"
  | "schedule"
  | "employees"
  | "groups"
  | "shifts";

type Props = {
  section: AdminSection;
  selectedWeekStart: string | null;
  navigate: (path: string) => void;
};

const tabs = [
  ["dashboard", "/admin", "Trang chủ"],
  ["availability", "/admin/availability", "Đăng ký nhân viên"],
  ["registration-weeks", "/admin/registration-weeks", "Tuần đăng ký"],
  ["schedule", "/admin/schedule", "Xếp lịch"],
  ["employees", "/admin/employees", "Nhân viên"],
  ["groups", "/admin/groups", "Nhóm"],
  ["shifts", "/admin/shifts", "Ca làm"],
] as const satisfies readonly (readonly [AdminSection, string, string])[];

const weekSensitiveSections = new Set<AdminSection>([
  "availability",
  "registration-weeks",
  "schedule",
]);

export function AdminNavigation({
  section,
  selectedWeekStart,
  navigate,
}: Props) {
  return (
    <nav className="admin-tabs" aria-label="Điều hướng quản trị">
      {tabs.map(([key, path, label]) => {
        const target =
          selectedWeekStart && weekSensitiveSections.has(key)
            ? adminWeekPath(path, selectedWeekStart)
            : path;
        return (
          <button
            key={key}
            type="button"
            className={section === key ? "active" : ""}
            aria-current={section === key ? "page" : undefined}
            data-target={target}
            onClick={() => navigate(target)}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
