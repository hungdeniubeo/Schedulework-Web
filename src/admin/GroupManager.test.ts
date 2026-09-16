import { describe, expect, it } from "vitest";
import source from "./GroupManager.tsx?raw";

describe("GroupManager delete flow", () => {
  it("opens the confirmation dialog instead of deleting directly from the row", () => {
    expect(source).toContain("deleteTarget");
    expect(source).toContain("setDeleteTarget(group)");
    expect(source).toContain("<GroupDeleteDialog");
  });

  it("reloads the authoritative group list after confirmed deletion", () => {
    expect(source).toContain("await removeGroup(deleteTarget.id)");
    expect(source).toContain("await load()");
  });

  it("refreshes groups on focus or visibility", () => {
    expect(source).toContain("subscribePageRefresh");
    expect(source).toContain("void load()");
  });
});
