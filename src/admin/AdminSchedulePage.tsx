import type { RegistrationWeek } from "../types/domain";
import { AdminScheduler } from "./AdminScheduler";
import { adminWeekPath } from "./adminWeekSelection";

type Props = {
  selectedWeek: RegistrationWeek | null;
  invalidRequestedWeek: boolean;
  registrationWeekStarts: string[];
  navigate: (path: string) => void;
};

export function AdminSchedulePage({
  selectedWeek,
  invalidRequestedWeek,
  registrationWeekStarts,
  navigate,
}: Props) {
  if (invalidRequestedWeek) {
    return (
      <section className="panel schedule-missing-week">
        <span className="eyebrow">Xếp lịch</span>
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
      <section className="panel schedule-missing-week">
        <span className="eyebrow">Xếp lịch</span>
        <h2>Chưa có tuần để xếp lịch</h2>
        <p>
          Hãy tạo tuần đăng ký trước. Lịch xếp sẽ được tạo tự động cùng tuần.
        </p>
        <button
          type="button"
          className="button primary"
          onClick={() => navigate("/admin/registration-weeks")}
        >
          Tạo tuần mới
        </button>
      </section>
    );
  }

  return (
    <AdminScheduler
      preferredWeekStart={selectedWeek.week_start}
      registrationWeekStarts={registrationWeekStarts}
      onWeekStartChange={(weekStart) => {
        if (
          weekStart !== selectedWeek.week_start &&
          registrationWeekStarts.includes(weekStart)
        ) {
          navigate(adminWeekPath("/admin/schedule", weekStart));
        }
      }}
      onOpenAvailability={() =>
        navigate(adminWeekPath("/admin/availability", selectedWeek.week_start))
      }
    />
  );
}
