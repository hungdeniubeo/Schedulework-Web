import { afterEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ client: null as any }));

vi.mock("../lib/config", () => ({
  getSupabase: () => supabase.client,
}));

import { deleteWeek } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registration workflow delete diagnostics", () => {
  it("preserves the Supabase error code and message so a failed delete is actionable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.client = {
      rpc: vi.fn(async () => ({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function public.delete_registration_workflow",
        },
      })),
    };

    await expect(deleteWeek("week-1")).rejects.toThrow(
      "[PGRST202] Could not find the function public.delete_registration_workflow",
    );
  });
});
