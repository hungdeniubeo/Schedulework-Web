import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getPublicSupabaseConfig: () => ({
    url: "https://example.supabase.co",
    publishableKey: "public-key",
  }),
}));

import { createEmployeeAccount, resetEmployeePassword } from "./serverApi";

describe("createEmployeeAccount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps employee creation returning one-time credentials", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      employee: {
        id: "employee-1",
        userId: "user-1",
        name: "Nguyễn Phi Hùng",
        active: true,
      },
      email: "employee@example.com",
      temporaryPassword: "temporary-once",
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createEmployeeAccount({
      name: "Nguyễn Phi Hùng",
      email: "employee@example.com",
      accessToken: "access-token",
    })).resolves.toEqual({
      email: "employee@example.com",
      temporaryPassword: "temporary-once",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      action: "create-employee",
      name: "Nguyễn Phi Hùng",
      email: "employee@example.com",
    });
  });
});

describe("resetEmployeePassword", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the existing one-time temporary credential flow", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      email: "employee@example.com",
      temporaryPassword: "temporary-once",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resetEmployeePassword("employee-1", "access-token"),
    ).resolves.toEqual({
      email: "employee@example.com",
      temporaryPassword: "temporary-once",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      action: "reset-employee-password",
      employeeId: "employee-1",
    });
  });
});
