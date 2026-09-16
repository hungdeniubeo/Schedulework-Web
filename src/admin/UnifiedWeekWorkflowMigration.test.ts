import { describe, expect, it } from "vitest";
import migrationSql from "../../supabase/migrations/202609160003_create_registration_workflow.sql?raw";

describe("unified week workflow migration", () => {
  it("backfills only registration weeks that do not already have a schedule", () => {
    expect(migrationSql).toContain("insert into public.schedule_weeks");
    expect(migrationSql).toContain("from public.registration_weeks");
    expect(migrationSql).toContain("not exists");
    expect(migrationSql).toContain("status");
    expect(migrationSql).toContain("'draft'");
  });

  it("creates registration and schedule rows in one admin-only RPC", () => {
    expect(migrationSql).toContain(
      "create or replace function public.create_registration_workflow",
    );
    expect(migrationSql).toContain("private.is_admin()");
    expect(migrationSql).toContain("insert into public.registration_weeks");
    expect(migrationSql).toContain("insert into public.schedule_weeks");
    expect(migrationSql).toContain("returning * into created_week");
    expect(migrationSql).toContain(
      "grant execute on function public.create_registration_workflow(date, timestamptz)",
    );
  });
});
