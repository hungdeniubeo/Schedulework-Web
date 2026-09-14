import {
  normalizeAvailability,
  prepareAvailabilityForSave,
  validateAvailability,
} from "./availability";
import type { Availability } from "../types/domain";

const AVAILABILITY_DRAFT_PREFIX = "schedulework:availability-draft:";

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> &
  Partial<Pick<Storage, "key" | "length">>;

function sessionDraftStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function availabilityDraftKey(employeeId: string, weekId: string): string {
  return `${AVAILABILITY_DRAFT_PREFIX}${employeeId}:${weekId}`;
}

export function loadAvailabilityDraft(
  employeeId: string,
  weekId: string,
  storage: DraftStorage | null = sessionDraftStorage(),
): Availability | null {
  if (!storage) return null;
  const key = availabilityDraftKey(employeeId, weekId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { availability?: unknown };
    const availability = parsed?.availability as Availability;
    if (validateAvailability(availability, "").length > 0) {
      clearAvailabilityDraft(employeeId, weekId, storage);
      return null;
    }
    return normalizeAvailability(availability);
  } catch {
    clearAvailabilityDraft(employeeId, weekId, storage);
    return null;
  }
}

export function saveAvailabilityDraft(
  employeeId: string,
  weekId: string,
  availability: Availability,
  storage: DraftStorage | null = sessionDraftStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      availabilityDraftKey(employeeId, weekId),
      JSON.stringify({
        availability: prepareAvailabilityForSave(availability),
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Draft persistence is best-effort and must never block form editing.
  }
}

export function clearAvailabilityDraft(
  employeeId: string,
  weekId: string,
  storage: DraftStorage | null = sessionDraftStorage(),
): void {
  try {
    storage?.removeItem(availabilityDraftKey(employeeId, weekId));
  } catch {
    // Ignore unavailable session storage.
  }
}

export function clearEmployeeAvailabilityDrafts(
  employeeId: string,
  storage: DraftStorage | null = sessionDraftStorage(),
): void {
  if (!storage || typeof storage.key !== "function" || !storage.length) return;
  const prefix = `${AVAILABILITY_DRAFT_PREFIX}${employeeId}:`;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) storage.removeItem(key);
    }
  } catch {
    // Ignore unavailable session storage during logout.
  }
}

export function availabilityMatches(
  first: Availability,
  second: Availability,
): boolean {
  return (
    JSON.stringify(prepareAvailabilityForSave(first)) ===
    JSON.stringify(prepareAvailabilityForSave(second))
  );
}

export function selectAvailabilityDraft(
  submitted: Availability,
  draft: Availability | null,
  locked: boolean,
): { availability: Availability; restored: boolean } {
  const restored = Boolean(
    !locked && draft && !availabilityMatches(draft, submitted),
  );
  return { availability: restored ? draft! : submitted, restored };
}
