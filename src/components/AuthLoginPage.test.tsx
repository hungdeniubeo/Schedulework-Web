import { describe, expect, it } from "vitest";
import source from "./AuthLoginPage.tsx?raw";

describe("AuthLoginPage username login", () => {
  it("uses username instead of email", () => {
    expect(source).toContain("Tên đăng nhập");
    expect(source).toContain('autoComplete="username"');
    expect(source).not.toContain('type="email"');
    expect(source).not.toContain("Email hoặc mật khẩu không đúng.");
  });
});
