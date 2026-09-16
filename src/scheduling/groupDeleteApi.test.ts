import { describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ client: null as any }));

vi.mock("../lib/config", () => ({
  getSupabase: () => supabase.client,
}));

import { removeGroup } from "./api";

describe("removeGroup atomic delete", () => {
  it("uses the database RPC that unassigns employees and deletes the group", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    supabase.client = { rpc };

    await expect(removeGroup("group-1")).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("delete_group_and_unassign_employees", {
      target_group_id: "group-1",
    });
  });

  it("surfaces a generic delete error when the RPC fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.client = {
      rpc: vi.fn(async () => ({ error: { message: "database failure" } })),
    };

    await expect(removeGroup("group-1")).rejects.toThrow("Không xóa được nhóm.");
  });
});
