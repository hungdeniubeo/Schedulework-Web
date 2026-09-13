import { describe, expect, it } from "vitest";
import { matchRoute } from "./router";

describe("matchRoute", () => {
  it("matches authenticated employee routes", () => {
    expect(matchRoute("/")).toEqual({
      name: "employee",
      section: "availability",
    });
    expect(matchRoute("/app/availability")).toEqual({
      name: "employee",
      section: "availability",
    });
    expect(matchRoute("/app/my-schedule")).toEqual({
      name: "employee",
      section: "my-schedule",
    });
    expect(matchRoute("/app/team-schedule")).toEqual({
      name: "employee",
      section: "team-schedule",
    });
    expect(matchRoute("/login")).toEqual({ name: "employee-login" });
    expect(matchRoute("/change-password")).toEqual({ name: "change-password" });
  });

  it("matches admin routes", () => {
    expect(matchRoute("/admin")).toEqual({
      name: "admin",
      section: "dashboard",
    });
    expect(matchRoute("/admin/availability")).toEqual({
      name: "admin",
      section: "availability",
    });
    expect(matchRoute("/admin/schedule")).toEqual({
      name: "admin",
      section: "schedule",
    });
    expect(matchRoute("/admin/employees")).toEqual({
      name: "admin",
      section: "employees",
    });
    expect(matchRoute("/admin/groups")).toEqual({
      name: "admin",
      section: "groups",
    });
    expect(matchRoute("/admin/shifts")).toEqual({
      name: "admin",
      section: "shifts",
    });
    expect(matchRoute("/admin/login")).toEqual({ name: "admin-login" });
  });

  it("returns not-found for malformed routes", () => {
    expect(matchRoute("/unknown")).toEqual({ name: "not-found" });
  });
});
