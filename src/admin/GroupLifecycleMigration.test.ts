import { describe, expect, it } from "vitest";
import migrationSql from "../../supabase/migrations/202609160004_group_delete_set_null.sql?raw";

describe("group lifecycle migration", () => {
  it("changes employee group deletion to SET NULL", () => {
    expect(migrationSql).toContain(
      "drop constraint if exists employees_group_id_fkey",
    );
    expect(migrationSql).toContain("foreign key (group_id)");
    expect(migrationSql).toContain("references public.groups(id)");
    expect(migrationSql).toContain("on delete set null");
  });

  it("does not delete employee or schedule data", () => {
    expect(migrationSql).not.toContain("delete from public.employees");
    expect(migrationSql).not.toContain("delete from public.schedule_entries");
    expect(migrationSql).not.toContain("delete from public.availability_submissions");
  });
});
