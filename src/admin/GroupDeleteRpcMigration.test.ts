import { describe, expect, it } from "vitest";

const migrations = import.meta.glob("../../supabase/migrations/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const migrationSql = (
  Object.entries(migrations).find(([path]) =>
    path.endsWith("202609160005_delete_group_and_unassign_employees.sql"),
  )?.[1] ?? ""
).toLocaleLowerCase("en");

describe("atomic group delete migration", () => {
  it("unassigns employees before deleting the group record", () => {
    expect(migrationSql).toContain(
      "create or replace function public.delete_group_and_unassign_employees",
    );
    expect(migrationSql).toContain("update public.employees");
    expect(migrationSql).toContain("set group_id = null");
    expect(migrationSql).toContain("delete from public.groups");
  });

  it("keeps employee and schedule records intact", () => {
    expect(migrationSql).not.toContain("delete from public.employees");
    expect(migrationSql).not.toContain("delete from public.schedule_entries");
    expect(migrationSql).not.toContain("delete from public.availability_submissions");
  });
});