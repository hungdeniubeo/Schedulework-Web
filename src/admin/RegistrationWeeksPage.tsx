import type {
  RegistrationWeek,
  RegistrationWeekStatus,
} from "../types/domain";
import { WeekManager } from "./WeekManager";
import "./RegistrationWeeks.css";

type Props = {
  weeks: RegistrationWeek[];
  selectedId: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onCreate: (weekStart: string, lockAt: string) => Promise<RegistrationWeek>;
  onUpdate: (
    id: string,
    changes: { status?: RegistrationWeekStatus; lock_at?: string },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function RegistrationWeeksPage(props: Props) {
  return (
    <div className="registration-weeks-page">
      <header className="registration-weeks-heading">
        <span className="eyebrow">Thiết lập đăng ký</span>
        <h1>Tuần đăng ký</h1>
        <p>Tạo, chọn và quản lý thời gian nhận đăng ký của nhân viên.</p>
      </header>
      <WeekManager {...props} />
    </div>
  );
}
