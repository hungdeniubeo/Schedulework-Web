import type { RegistrationWeek } from "../types/domain";
import { AdminScheduler } from "./AdminScheduler";
import { adminWeekPath } from "./adminWeekSelection";

type Props = {
  selectedWeek: RegistrationWeek | null;
  invalidRequestedWeek: boolean;
  scheduleWeekStarts: string[];
  registrationWeekStarts: string[];
  busy: boolean;
  navigate: (path: string) => void;
  onCreate: () => Promise<void>;
};

export function AdminSchedulePage({
  selectedWeek,
  invalidRequestedWeek,
  scheduleWeekStarts,
  registrationWeekStarts,
  busy,
  navigate,
  onCreate,
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
        <h2>Chưa có tuần đăng ký</h2>
        <p>Hãy tạo tuần đăng ký trước khi bắt đầu xếp lịch.</p>
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

  if (!scheduleWeekStarts.includes(selectedWeek.week_start)) {
    return (
      <section className="panel schedule-missing-week">
        <span className="eyebrow">Xếp lịch chính thức</span>
        <h2>Tuần này chưa có lịch xếp</h2>
        <p>Hãy tạo lịch tuần này để bắt đầu xếp ca.</p>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => void onCreate()}
        >
          {busy ? "Đang tạo..." : "Tạo lịch tuần này"}
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
