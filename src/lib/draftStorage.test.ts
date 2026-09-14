import { describe, expect, it } from "vitest";
import { createEmptyAvailability, createPresetDay } from "./availability";
import {
  availabilityDraftKey,
  clearAvailabilityDraft,
  loadAvailabilityDraft,
  saveAvailabilityDraft,
  selectAvailabilityDraft,
} from "./draftStorage";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

describe("availability session drafts", () => {
  it("restores unsaved availability after a route remount or refresh", () => {
    const storage = memoryStorage();
    const availability = createEmptyAvailability();
    availability.days["1"] = createPresetDay("afternoon");
    saveAvailabilityDraft("employee-1", "week-1", availability, storage);
    expect(loadAvailabilityDraft("employee-1", "week-1", storage)?.days["1"])
      .toMatchObject({ preset: "afternoon" });
  });

  it("does not reuse a draft for another employee or week", () => {
    const storage = memoryStorage();
    saveAvailabilityDraft(
      "employee-1",
      "week-1",
      createEmptyAvailability(),
      storage,
    );
    expect(loadAvailabilityDraft("employee-1", "week-2", storage)).toBeNull();
    expect(loadAvailabilityDraft("employee-2", "week-1", storage)).toBeNull();
  });

  it("clears a successful draft and safely removes malformed data", () => {
    const storage = memoryStorage();
    saveAvailabilityDraft(
      "employee-1",
      "week-1",
      createEmptyAvailability(),
      storage,
    );
    clearAvailabilityDraft("employee-1", "week-1", storage);
    expect(loadAvailabilityDraft("employee-1", "week-1", storage)).toBeNull();

    const key = availabilityDraftKey("employee-1", "week-1");
    storage.setItem(key, "{not-json");
    expect(loadAvailabilityDraft("employee-1", "week-1", storage)).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("never applies a local draft to a locked registration week", () => {
    const submitted = createEmptyAvailability();
    const draft = createEmptyAvailability();
    draft.days["1"] = createPresetDay("evening");
    expect(selectAvailabilityDraft(submitted, draft, true)).toEqual({
      availability: submitted,
      restored: false,
    });
  });
});
