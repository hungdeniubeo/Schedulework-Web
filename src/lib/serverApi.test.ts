import { describe, expect, it } from "vitest";
import source from "./serverApi.ts?raw";

describe("username account API", () => {
  it("uses username credentials for employee accounts", () => {
    expect(source).toContain("username: string");
    expect(source).toContain('action: "create-employee"');
    expect(source).toContain("username: input.username");
    expect(source).toContain("username: result.username");
    expect(source).not.toContain("email: input.email");
  });

  it("uses the username login edge function and installs a Supabase session", () => {
    expect(source).toContain("/functions/v1/username-login");
    expect(source).toContain("signInWithUsername");
    expect(source).toContain("auth.setSession");
    expect(source).toContain("access_token: payload.accessToken");
    expect(source).toContain("refresh_token: payload.refreshToken");
  });

  it("keeps reset, delete, and password change account actions", () => {
    expect(source).toContain('action: "reset-employee-password"');
    expect(source).toContain('action: "delete-employee"');
    expect(source).toContain('action: "change-password"');
  });
});
