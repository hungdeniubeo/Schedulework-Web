import { afterEach, describe, expect, it, vi } from "vitest";
import type { RegistrationWeek } from "../types/domain";

const supabase = vi.hoisted(() => ({ client: null as any }));

vi.mock("../lib/config", () => ({
  getSupabase: () => supabase.client,
}));

import { createWeek, deleteWeek } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registration week API", () => {
  it("returns the newly created week so the Admin UI can select it", async () => {
    const created: RegistrationWeek = {
      id: "week-new",
      week_start: "2026-10-05",
      lock_at: "2026-10-02T15:00:00.000Z",
      status: "open",
      created_at: "2026-09-14T00:00:00.000Z",
      updated_at: "2026-09-14T00:00:00.000Z",
    };
    const query = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: created, error: null }),
    };
    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    supabase.client = { from: vi.fn().mockReturnValue(query) };

    await expect(
      createWeek("2026-10-05", "2026-10-02T15:00:00.000Z"),
    ).resolves.toEqual(created);
    expect(query.insert).toHaveBeenCalledWith({
      week_start: "2026-10-05",
      lock_at: "2026-10-02T15:00:00.000Z",
      status: "open",
    });
    expect(query.select).toHaveBeenCalledWith("*");
  });

  it("deletes the complete weekly workflow through the transactional RPC", async () => {
    const rpc = vi.fn(async () => ({ data: "2026-09-21", error: null }));
    const from = vi.fn(() => {
      throw new Error("direct table delete must not be used");
    });
    supabase.client = { rpc, from };

    await expect(deleteWeek("week-1")).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("delete_registration_workflow", {
      target_registration_week_id: "week-1",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("surfaces atomic delete failure without falling back to direct deletes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.client = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: "REGISTRATION_WEEK_NOT_FOUND" },
      })),
    };

    await expect(deleteWeek("missing")).rejects.toThrow(
      "Không xóa được toàn bộ dữ liệu tuần đăng ký.",
    );
  });
});
