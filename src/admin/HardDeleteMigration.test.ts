import { describe, expect, it } from "vitest";

const migrations = import.meta.glob("../../supabase/migrations/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const migrationSql = (
  Object.entries(migrations).find(([path]) =>
    path.endsWith("202609170001_hard_delete_employee_and_group_cleanup.sql"),
  )?.[1] ?? ""
).toLocaleLowerCase("en");

describe("hard delete database cascade rules", () => {
  it("cascades auth deletion through employee-owned operational data", () => {
    expect(migrationSql).toContain("employees_user_id_fkey");
    expect(migrationSql).toContain("references auth.users(id)");
    expect(migrationSql).toContain("availability_submissions_employee_id_fkey");
    expect(migrationSql).toContain("schedule_entries_employee_id_fkey");
    expect(migrationSql.match(/on delete cascade/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("allows a group to be deleted even when old employees still reference it", () => {
    expect(migrationSql).toContain("employees_group_id_fkey");
    expect(migrationSql).toContain("references public.groups(id)");
    expect(migrationSql).toContain("on delete set null");
  });
});