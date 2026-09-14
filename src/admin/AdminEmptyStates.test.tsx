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
          email: "employee@example.com",
          temporaryPassword: "temporary-password",
        })}
        onResetPassword={async () => ({
          email: "employee@example.com",
          temporaryPassword: "temporary-password",
        })}
      />,
    );
    const groups = renderToStaticMarkup(<GroupManager />);
    const shifts = renderToStaticMarkup(<ShiftManager />);

    expect(employees).toContain("Chưa có nhân viên.");
    expect(groups).toContain("Chưa có nhóm.");
    expect(shifts).toContain("Chưa có ca làm.");
  });
});
