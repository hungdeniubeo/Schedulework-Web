import { afterEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ client: null as any }));

vi.mock("../lib/config", () => ({
  getSupabase: () => supabase.client,
}));

import {
  consolidateScheduleEntry,
  employeeFromRow,
  listScheduleAvailability,
  removePosition,
} from "./api";
import type { ScheduleEntry } from "./types";

describe("employeeFromRow", () => {
  it("maps an employee position from the joined position row", () => {
    expect(
      employeeFromRow({
        id: "employee-1",
        name: "Nguyễn Phi Hùng",
        active: true,
        group_id: "group-1",
        position_id: "position-1",
        positions: { name: "Bếp trưởng" },
        sort_order: 2,
        is_full_time: true,
        is_new: true,
      }),
    ).toEqual({
      id: "employee-1",
      name: "Nguyễn Phi Hùng",
      active: true,
      groupId: "group-1",
      positionId: "position-1",
      positionName: "Bếp trưởng",
      sortOrder: 2,
      isNew: true,
    });
  });

  it("maps an employee without a position", () => {
    expect(
      employeeFromRow({
        id: "employee-2",
        name: "Không chức danh",
        active: true,
        group_id: null,
        position_id: null,
        positions: null,
        sort_order: 0,
        is_full_time: false,
        is_new: true,
        is_head_chef: true,
        is_executive_chef: true,
        is_manager: true,
        role_label: "Full time",
      }),
    ).toEqual({
      id: "employee-2",
      name: "Không chức danh",
      active: true,
      groupId: null,
      positionId: null,
      positionName: null,
      sortOrder: 0,
      isNew: true,
    });
  });
});

function clientWithPositionDelete(error: { code: string; message: string } | null) {
  const query = {
    delete: () => query,
    eq: async () => ({ error }),
  };
  return { from: () => query };
}

describe("removePosition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects deletion when a position is assigned", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.client = clientWithPositionDelete({
      code: "23503",
      message: "foreign key violation",
    });

    await expect(removePosition("position-1")).rejects.toThrow(
      "Vị trí này đang được sử dụng. Hãy bỏ vị trí khỏi nhân viên trước khi xóa.",
    );
  });

  it("allows deletion when a position is unused", async () => {
    supabase.client = clientWithPositionDelete(null);

    await expect(removePosition("position-1")).resolves.toBeUndefined();
  });
});

describe("listScheduleAvailability", () => {
  it("loads submissions only from the registration week matching week_start", async () => {
    const registrationEq = vi.fn();
    const submissionEq = vi.fn();
    const expected = [{ id: "submission-1", employee_id: "employee-1" }];
    const registrationQuery = {
      select: () => registrationQuery,
      eq: (column: string, value: string) => {
        registrationEq(column, value);
        return registrationQuery;
      },
      maybeSingle: async () => ({ data: { id: "registration-week-1" }, error: null }),
    };
    const submissionQuery = {
      select: () => submissionQuery,
      eq: async (column: string, value: string) => {
        submissionEq(column, value);
        return { data: expected, error: null };
      },
    };
    supabase.client = {
      from: (table: string) =>
        table === "registration_weeks" ? registrationQuery : submissionQuery,
    };

    await expect(listScheduleAvailability("2026-09-21")).resolves.toEqual(expected);
    expect(registrationEq).toHaveBeenCalledWith("week_start", "2026-09-21");
    expect(submissionEq).toHaveBeenCalledWith("week_id", "registration-week-1");
  });
});

describe("consolidateScheduleEntry", () => {
  it("uses one transactional database operation for a merged cell", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    supabase.client = { rpc };
    const entry: ScheduleEntry = {
      id: "11111111-1111-1111-1111-111111111111",
      scheduleWeekId: "22222222-2222-2222-2222-222222222222",
      employeeId: "33333333-3333-3333-3333-333333333333",
      dayOfWeek: 2,
      shiftTypeId: "44444444-4444-4444-4444-444444444444",
      customStart: null,
      customEnd: null,
      customLabel: "10:00-14:00/17:00-23:00",
      sortOrderInCell: 0,
    };

    await consolidateScheduleEntry(entry, [
      "55555555-5555-5555-5555-555555555555",
    ]);

    expect(rpc).toHaveBeenCalledWith("consolidate_schedule_entry", {
      keeper_entry_id: entry.id,
      target_employee_id: entry.employeeId,
      target_day_of_week: entry.dayOfWeek,
      target_shift_type_id: entry.shiftTypeId,
      target_custom_label: entry.customLabel,
      target_sort_order: entry.sortOrderInCell,
      remove_entry_ids: ["55555555-5555-5555-5555-555555555555"],
    });
  });
});
