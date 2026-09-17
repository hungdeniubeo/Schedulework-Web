import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmployeeManager } from "./EmployeeManager";
import { GroupManager } from "./GroupManager";
import { ShiftManager } from "./ShiftManager";

describe("Admin management empty states", () => {
  it("explains empty employee, group, and shift lists", () => {
    const employees = renderToStaticMarkup(
      <EmployeeManager
        onAdd={async () => ({
          username: "Employee01",
          temporaryPassword: "temporary-password",
        })}
        onResetPassword={async () => ({
          username: "Employee01",
          temporaryPassword: "temporary-password",
        })}
        onDelete={async () => undefined}
      />,
    );
    const groups = renderToStaticMarkup(<GroupManager />);
    const shifts = renderToStaticMarkup(<ShiftManager />);

    expect(employees).toContain("Chưa có nhân viên.");
    expect(employees).toContain("Thêm nhân viên");
    expect(employees).not.toContain("Tạo tài khoản");
    expect(groups).toContain("Chưa có nhóm.");
    expect(groups).toContain("Nhóm làm việc");
    expect(shifts).toContain("Chưa có ca làm.");
    expect(shifts).toContain("Khung giờ dùng chung");
    expect(shifts).not.toContain('type="time"');
  });
});
