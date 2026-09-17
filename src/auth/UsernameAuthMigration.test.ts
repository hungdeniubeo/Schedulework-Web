import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/202609170002_username_auth.sql?raw";

describe("username auth migration", () => {
  it("adds a case-sensitive alphanumeric username and requires it for new profiles", () => {
    expect(migration).toContain("add column if not exists username text");
    expect(migration).toContain("profiles_username_required_for_new_rows");
    expect(migration).toContain("^[A-Za-z0-9]{3,32}$");
    expect(migration).toContain("create unique index if not exists profiles_username_exact_uidx");
    expect(migration).toContain("account_username text");
    expect(migration).toContain("public.provision_employee_account(uuid, text, text)");
  });

  it("does not wipe runtime or Auth data as part of normal migration", () => {
    const normalized = migration.toLowerCase();
    expect(normalized).not.toContain("delete from auth.users");
    expect(normalized).not.toContain("truncate ");
    expect(normalized).not.toContain("delete from public.employees");
  });
});
