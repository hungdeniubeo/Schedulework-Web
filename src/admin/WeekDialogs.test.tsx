import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import {
  CreateWeekDialog,
  DeleteWeekDialog,
  EditWeekDialog,
} from "./WeekDialogs";

const week: RegistrationWeek = {
  id: "week-1",
  week_start: "2026-09-28",
  lock_at: "2026-09-25T15:00:00.000Z",
  status: "open",
  created_at: "",
  updated_at: "",
};

describe("registration week dialogs", () => {
  it("shows the create fields, week preview, and explicit actions", () => {
    const html = renderToStaticMarkup(
      <CreateWeekDialog
        weeks={[week]}
        busy={false}
        onClose={() => undefined}
        onCreate={async () => week}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain("Tạo tuần đăng ký mới");
    expect(html).toContain("Ngày bắt đầu");
    expect(html).toContain("Khóa đăng ký lúc");
    expect(html).toContain("Tuần");
    expect(html).toContain("Hủy");
    expect(html).toContain("Tạo tuần");
  });

  it("keeps week_start read-only and only edits the deadline", () => {
    const html = renderToStaticMarkup(
      <EditWeekDialog
        week={week}
        busy={false}
        onClose={() => undefined}
        onSave={async () => undefined}
      />,
    );

    expect(html).toContain("Tuần 5 tháng 9 · 28/09 – 04/10");
    expect(html).toContain("Tuần đã tạo không thể đổi ngày bắt đầu");
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain('type="datetime-local"');
    expect(html).toContain('class="date-time-picker"');
    expect(html).toContain("Thứ Sáu, 25/09/2026 · 22:00");
    expect(html).toContain("Lưu thay đổi");
  });

  it("states that employee registrations and the official schedule are both deleted", () => {
    const html = renderToStaticMarkup(
      <DeleteWeekDialog
        week={{ ...week, week_start: "2026-10-05", status: "archived" }}
        busy={false}
        onClose={() => undefined}
        onDelete={async () => undefined}
      />,
    );

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("Xóa toàn bộ tuần");
    expect(html).toContain("đăng ký nhân viên");
    expect(html).toContain("lịch đã xếp");
    expect(html).toContain("05/10 – 11/10");
    expect(html).not.toContain("Lịch chính thức đã xếp không bị ảnh hưởng");
  });
});
