import type { AvailabilitySubmission, RegistrationWeek } from "../types/domain";
import type { CloudEmployee, Group } from "../scheduling/types";
import { AdminMatrix } from "./AdminMatrix";
import { adminWeekPath } from "./adminWeekSelection";

type Props = {
  selectedWeek: RegistrationWeek | null;
  invalidRequestedWeek: boolean;
  employees: CloudEmployee[];
  groups: Group[];
  submissions: AvailabilitySubmission[];
  navigate: (path: string) => void;
};

export function AdminAvailabilityPage({
  selectedWeek,
  invalidRequestedWeek,
  employees,
  groups,
  submissions,
  navigate,
}: Props) {
  if (invalidRequestedWeek) {
    return (
      <section className="panel availability-empty-state">
        <span className="eyebrow">Đăng ký nhân viên</span>
        <h2>Không tìm thấy tuần đăng ký</h2>
        <p>Tuần được yêu cầu không tồn tại hoặc đã bị xóa.</p>
        <button
          type="button"
          className="button primary"
          onClick={() => navigate("/admin/registration-weeks")}
        >
          Quản lý tuần đăng ký
        </button>
      </section>
    );
  }

  if (!selectedWeek) {
    return (
      <section className="panel availability-empty-state">
        <span className="eyebrow">Đăng ký nhân viên</span>
        <h2>Chưa có tuần đăng ký</h2>
        <p>Hãy tạo tuần đăng ký trước khi xem lịch nhân viên.</p>
        <button
          type="button"
          className="button primary"
          onClick={() => navigate("/admin/registration-weeks")}
        >
          Tạo tuần đăng ký
        </button>
      </section>
    );
  }

  return (
    <AdminMatrix
      employees={employees}
      groups={groups}
      submissions={submissions}
      weekStart={selectedWeek.week_start}
      onOpenScheduler={() =>
        navigate(adminWeekPath("/admin/schedule", selectedWeek.week_start))
      }
    />
  );
}
