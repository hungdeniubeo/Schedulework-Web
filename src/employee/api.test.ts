import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Availability } from "../types/domain";

const supabase = vi.hoisted(() => ({ client: null as any }));

vi.mock("../lib/config", () => ({
  getSupabase: () => supabase.client,
}));

import { saveEmployeeAvailability } from "./api";

const availability: Availability = {
  version: 1,
  days: {
    "1": { status: "off", periods: [], start: null, end: null },
    "2": { status: "off", periods: [], start: null, end: null },
    "3": { status: "off", periods: [], start: null, end: null },
    "4": { status: "off", periods: [], start: null, end: null },
    "5": { status: "off", periods: [], start: null, end: null },
    "6": { status: "off", periods: [], start: null, end: null },
    "7": { status: "off", periods: [], start: null, end: null },
  },
};

function supabaseWithDeniedSave(week: { status: "open" | "locked"; lock_at: string }) {
  const submissionQuery = {
    upsert: () => submissionQuery,
    select: () => submissionQuery,
    single: async () => ({ data: null, error: { code: "42501" } }),
  };
  const weekQuery = {
    select: () => weekQuery,
    eq: () => weekQuery,
    maybeSingle: async () => ({ data: week, error: null }),
  };

  return {
    from: (table: string) =>
      table === "availability_submissions" ? submissionQuery : weekQuery,
  };
}

describe("saveEmployeeAvailability", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("upserts and returns the latest values when editing an existing submission", async () => {
    const upsert = vi.fn();
    const query = {
      upsert: (payload: unknown, options: unknown) => {
        upsert(payload, options);
        return query;
      },
      select: () => query,
      single: async () => ({
        data: {
          availability,
          note: "Đã sửa",
          submitted_at: "2026-09-14T00:00:00Z",
          updated_at: "2026-09-15T00:00:00Z",
        },
        error: null,
      }),
    };
    supabase.client = { from: () => query };

    await expect(
      saveEmployeeAvailability({
        weekId: "week-id",
        employeeId: "employee-id",
        availability,
        note: "Đã sửa",
      }),
    ).resolves.toMatchObject({ note: "Đã sửa" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ week_id: "week-id", employee_id: "employee-id" }),
      { onConflict: "week_id,employee_id" },
    );
  });

  it("reports a generic save error when a denied save is rechecked against an open week", async () => {
    supabase.client = supabaseWithDeniedSave({
      status: "open",
      lock_at: "2099-09-18T15:00:00.000Z",
    });

    await expect(
      saveEmployeeAvailability({
        weekId: "week-id",
        employeeId: "employee-id",
        availability,
        note: "",
      }),
    ).rejects.toMatchObject({ code: "SAVE_ERROR" });
  });

  it("reports a locked registration when a denied save is rechecked against a locked week", async () => {
    supabase.client = supabaseWithDeniedSave({
      status: "locked",
      lock_at: "2099-09-18T15:00:00.000Z",
    });

    await expect(
      saveEmployeeAvailability({
        weekId: "week-id",
        employeeId: "employee-id",
        availability,
        note: "",
      }),
    ).rejects.toMatchObject({ code: "REGISTRATION_LOCKED" });
  });
});
