import { describe, expect, it } from "vitest";
import migration from "../../supabase/migrations/202609170003_bootstrap_first_admin.sql?raw";

describe("first admin bootstrap migration", () => {
  it("serializes bootstrap and creates exactly one admin profile", () => {
    expect(migration).toContain("bootstrap_first_admin");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("schedulework-bootstrap-first-admin");
    expect(migration).toContain("where role = 'admin'");
    expect(migration).toContain("ADMIN_ALREADY_EXISTS");
    expect(migration).toContain("^[A-Za-z0-9]{3,32}$");
    expect(migration).toContain("'admin', false");
  });

  it("keeps bootstrap service-role only", () => {
    expect(migration).toContain(
      "revoke all on function public.bootstrap_first_admin(uuid, text)",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain(
      "grant execute on function public.bootstrap_first_admin(uuid, text)",
    );
    expect(migration).toContain("to service_role");
  });
});
