import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RegistrationWeek } from "../types/domain";
import type { CloudEmployee } from "../scheduling/types";
import { AdminAvailabilityPage } from "./AdminAvailabilityPage";

const week: RegistrationWeek = {
  id: "week-1",
  week_start: "2026-09-21",
  lock_at: "2099-09-18T15:00:00.000Z",
  status: "open",
  created_at: "",
  updated_at: "",
};

const employee: CloudEmployee = {
  id: "employee-1",
  name: "Nguyễn Phi Hùng",
  active: true,
  groupId: "group-1",
  positionId: null,
  positionName: null,
  sortOrder: 0,
  isNew: false,
};

describe("AdminAvailabilityPage", () => {
  it("renders only the registration matrix for a valid week", () => {
    const html = renderToStaticMarkup(
      <AdminAvailabilityPage
        selectedWeek={week}
        invalidRequestedWeek={false}
        employees={[employee]}
        groups={[{ id: "group-1", name: "MEAT", sortOrder: 0 }]}
        submissions={[]}
        navigate={vi.fn()}
      />,
    );
    expect(html).toContain("Lịch nhân viên đăng ký");
    expect(html).toContain("Xếp lịch tuần này");
    expect(html).not.toContain("Quản lý tuần đăng ký");
    expect(html).not.toContain("Tạo tuần mới");
    expect(html).not.toContain("Tiến độ tuần");
    expect(html).not.toContain("Tổng quan tuần");
  });

  it("shows a management link when no registration week exists", () => {
    const html = renderToStaticMarkup(
      <AdminAvailabilityPage
        selectedWeek={null}
        invalidRequestedWeek={false}
        employees={[]}
        groups={[]}
        submissions={[]}
        navigate={vi.fn()}
      />,
    );
    expect(html).toContain("Chưa có tuần đăng ký");
    expect(html).toContain("Tạo tuần đăng ký");
  });

  it("does not silently fall back for an invalid requested week", () => {
    const html = renderToStaticMarkup(
      <AdminAvailabilityPage
        selectedWeek={null}
        invalidRequestedWeek
        employees={[]}
        groups={[]}
        submissions={[]}
        navigate={vi.fn()}
      />,
    );
    expect(html).toContain("Không tìm thấy tuần đăng ký");
  });
});
