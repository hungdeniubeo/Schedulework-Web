import { describe, expect, it } from "vitest";
import { employeeDestination, hasEmployeeAccess } from "./access";

describe("employee access", () => {
  it("blocks non-employees and deactivated employees", () => {
    expect(
      hasEmployeeAccess({ role: "admin", must_change_password: false }, true),
    ).toBe(false);
    expect(
      hasEmployeeAccess(
        { role: "employee", must_change_password: false },
        false,
      ),
    ).toBe(false);
    expect(
      hasEmployeeAccess(
        { role: "employee", must_change_password: false },
        true,
      ),
    ).toBe(true);
  });

  it("forces an active employee with a temporary password to change it", () => {
    expect(
      employeeDestination({ role: "employee", must_change_password: true }),
    ).toBe("/change-password");
    expect(
      employeeDestination({ role: "employee", must_change_password: false }),
    ).toBe("/app/availability");
  });
});
