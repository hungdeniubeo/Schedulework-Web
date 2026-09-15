import { describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ client: null as any }));
vi.mock("../lib/config", () => ({ getSupabase: () => supabase.client }));

import { reorderSchedulerEmployee } from "./api";

describe("reorderSchedulerEmployee", () => {
  it("persists a scheduler row move through one RPC", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    supabase.client = { rpc };

    await reorderSchedulerEmployee("employee-a", "group-soup", "employee-b");

    expect(rpc).toHaveBeenCalledWith("reorder_scheduler_employee", {
      target_employee_id: "employee-a",
      target_group_id: "group-soup",
      before_employee_id: "employee-b",
    });
  });

  it("uses null when dropping on a group header", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    supabase.client = { rpc };

    await reorderSchedulerEmployee("employee-a", "group-soup");

    expect(rpc).toHaveBeenCalledWith("reorder_scheduler_employee", {
      target_employee_id: "employee-a",
      target_group_id: "group-soup",
      before_employee_id: null,
    });
  });
});
