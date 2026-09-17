import { describe, expect, it } from "vitest";
import source from "./AdminSetupPage.tsx?raw";

describe("AdminSetupPage", () => {
  it("uses only username and password for first-admin setup", () => {
    expect(source).toContain("Tên đăng nhập");
    expect(source).toContain("Mật khẩu");
    expect(source).toContain("Tạo tài khoản Admin");
    expect(source).toContain("getAdminBootstrapAvailability");
    expect(source).toContain("bootstrapAdmin(username, password)");
    expect(source).not.toContain("Email");
    expect(source).not.toContain("email");
    expect(source).not.toContain("Xác nhận mật khẩu");
  });

  it("locks setup after an admin exists", () => {
    expect(source).toContain("Hệ thống đã được thiết lập.");
    expect(source).toContain('navigate("/admin/login")');
  });
});
