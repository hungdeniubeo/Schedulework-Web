import {
  createEmptyAvailability,
  normalizeAvailability,
} from "../lib/availability";
import { selectAvailabilityDraft } from "../lib/draftStorage";
import { isRegistrationLocked } from "../lib/week";
import type { Availability, EmployeePortalData } from "../types/domain";

export function canRefreshEmployeePortal(
  saving: boolean,
  refreshing: boolean,
): boolean {
  return !saving && !refreshing;
}

export function reconcileEmployeePortalRefresh(input: {
  currentContext: EmployeePortalData | null;
  currentAvailability: Availability;
  hasDraft: boolean;
  nextContext: EmployeePortalData;
  nextDraft: Availability | null;
  now: Date;
}): {
  context: EmployeePortalData;
  availability: Availability;
  hasDraft: boolean;
  shouldClearDraft: boolean;
} {
  const sameWeek = input.currentContext?.week.id === input.nextContext.week.id;
  const locked =
    input.nextContext.week.locked ||
    isRegistrationLocked(
      input.nextContext.week.status,
      input.nextContext.week.lockAt,
      input.now,
    );

  if (sameWeek && !locked) {
    return {
      context: input.nextContext,
      availability: input.currentAvailability,
      hasDraft: input.hasDraft,
      shouldClearDraft: false,
    };
  }

  const submitted = input.nextContext.submission
    ? normalizeAvailability(input.nextContext.submission.availability)
    : createEmptyAvailability();
  const selected = selectAvailabilityDraft(
    submitted,
    locked ? null : input.nextDraft,
    locked,
  );

  return {
    context: input.nextContext,
    availability: selected.availability,
    hasDraft: selected.restored,
    shouldClearDraft:
      locked || Boolean(input.nextDraft && !selected.restored),
  };
}
