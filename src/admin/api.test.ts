import { describe, expect, it, vi } from "vitest";
import type { RegistrationWeek } from "../types/domain";

const supabase = vi.hoisted(() => ({ client: null as any }));

vi.mock("../lib/config", () => ({
  getSupabase: () => supabase.client,
}));

import { createWeek, deleteWeek } from "./api";

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

  it("deletes a registration week by id", async () => {
    const query = {
      delete: vi.fn(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    query.delete.mockReturnValue(query);
    supabase.client = { from: vi.fn().mockReturnValue(query) };

    await expect(deleteWeek("week-old")).resolves.toBeUndefined();

    expect(supabase.client.from).toHaveBeenCalledWith("registration_weeks");
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenCalledWith("id", "week-old");
  });
});
