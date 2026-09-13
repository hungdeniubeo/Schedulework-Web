import { describe, expect, it } from "vitest";
import { buildMatrixRows } from "./matrix";
import { createEmptyAvailability } from "../lib/availability";
import type { AdminEmployee, AvailabilitySubmission } from "../types/domain";

const employees: AdminEmployee[] = [
  { id: "e1", name: "Hùng", active: true, created_at: "", updated_at: "" },
  { id: "e2", name: "Minh", active: true, created_at: "", updated_at: "" },
];

describe("buildMatrixRows", () => {
  it("keeps active employees without submissions visible", () => {
    const availability = createEmptyAvailability();
    availability.days["1"] = {
      status: "available",
      periods: ["morning"],
      start: null,
      end: null,
    };
    const submissions: AvailabilitySubmission[] = [
      {
        id: "s1",
        week_id: "w1",
        employee_id: "e1",
        availability,
        note: null,
        submitted_at: "",
        updated_at: "",
      },
    ];

    expect(buildMatrixRows(employees, submissions)).toEqual([
      expect.objectContaining({ employee: employees[0], submitted: true }),
      expect.objectContaining({ employee: employees[1], submitted: false }),
    ]);
  });

  it("excludes deactivated employees from the current matrix", () => {
    expect(buildMatrixRows([{ ...employees[0], active: false }], [])).toEqual(
      [],
    );
  });
});
