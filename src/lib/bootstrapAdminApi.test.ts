import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getPublicSupabaseConfig: () => ({
    url: "https://example.supabase.co",
    publishableKey: "public-key",
  }),
  getSupabase: vi.fn(),
}));

import {
  bootstrapAdmin,
  getAdminBootstrapAvailability,
} from "./serverApi";

describe("admin bootstrap API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("checks whether first-admin setup is available", async () => {
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => new Response(
      JSON.stringify({ available: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAdminBootstrapAvailability()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/bootstrap-admin",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ apikey: "public-key" }),
      }),
    );
  });

  it("creates the first admin with username and password only", async () => {
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => new Response(
      JSON.stringify({ created: true }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(bootstrapAdmin("Admin01", "Password123")).resolves.toBeUndefined();
    const request = fetchMock.mock.calls[0]?.[1];
    if (!request) throw new Error("bootstrap request was not captured");
    expect(JSON.parse(String(request.body))).toEqual({
      username: "Admin01",
      password: "Password123",
    });
    expect(String(request.body)).not.toContain("email");
  });
});
