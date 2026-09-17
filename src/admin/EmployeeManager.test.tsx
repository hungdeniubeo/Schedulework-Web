import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CloudEmployee } from "../scheduling/types";
import source from "./EmployeeManager.tsx?raw";
import { DeleteEmployeeDialog, EmployeeCard } from "./EmployeeManager";

const employee: CloudEmployee = {
  id: "employee-1",
  name: "Nguyễn Phi Hùng",
  active: true,
  groupId: "group-1",
  positionId: "position-1",
  positionName: "Bếp trưởng",
  sortOrder: 0,
  isNew: false,
};

describe("employee management cards", () => {
  it("uses the employee summary as the accessible expansion control", () => {
    const html = renderToStaticMarkup(
      <EmployeeCard
        employee={employee}
        groupName="Nhóm Bếp"
        groups={[{ id: "group-1", name: "Nhóm Bếp", sortOrder: 0 }]}
        positions={[{ id: "position-1", name: "Bếp trưởng", sortOrder: 0 }]}
        disabled={false}
        onUpdate={() => undefined}
        onMove={() => undefined}
        onResetPassword={() => undefined}
        onDeleteRequest={() => undefined}
      />,
    );

    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Nguyễn Phi Hùng");
    expect(html).toContain("Nhóm Bếp");
    expect(html).toContain("Bếp trưởng");
    expect(html).not.toContain("Chỉnh sửa");
  });

  it("offers reset and permanent delete without deactivate/reactivate actions", () => {
    const html = renderToStaticMarkup(
      <EmployeeCard
        employee={employee}
        groupName="Nhóm Bếp"
        groups={[]}
        positions={[]}
        disabled={false}
        onUpdate={() => undefined}
        onMove={() => undefined}
        onResetPassword={() => undefined}
        onDeleteRequest={() => undefined}
      />,
    );

    expect(html).toContain("Reset mật khẩu");
    expect(html).toContain(">Xóa<");
    expect(html).not.toContain("Deactivate");
    expect(html).not.toContain("Reactivate");
  });

  it("refreshes employee and group structure when the page becomes active again", () => {
    expect(source).toContain("subscribePageRefresh");
    expect(source).toContain("refreshStructure");
    expect(source).toContain("listSchedulerEmployees()");
    expect(source).toContain("listGroups()");
  });

  it("creates employee accounts with a case-sensitive alphanumeric username", () => {
    expect(source).toContain("Tên đăng nhập");
    expect(source).toContain('pattern="[A-Za-z0-9]+"');
    expect(source).toContain("minLength={3}");
    expect(source).toContain("maxLength={32}");
    expect(source).toContain("credentials.username");
    expect(source).not.toContain("Email đăng nhập");
    expect(source).not.toContain('type="email"');
  });
});

describe("employee delete confirmation", () => {
  it("warns that employee deletion is permanent and removes related schedule data", () => {
    const html = renderToStaticMarkup(
      <DeleteEmployeeDialog
        employee={employee}
        deleting={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(html).toContain("Xóa vĩnh viễn nhân viên Nguyễn Phi Hùng?");
    expect(html).toContain("Thao tác này không thể hoàn tác");
    expect(html).toContain("dữ liệu đăng ký và lịch xếp liên quan");
    expect(html).toContain(">Hủy<");
    expect(html).toContain(">Xóa vĩnh viễn<");
  });
});
