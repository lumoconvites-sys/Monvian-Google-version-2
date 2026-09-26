import { ItineraryStep } from '../types';

/**
 * Ensures that pinned stops are always positioned at the very top of the itinerary.
 * "o q for fixado não pode sair de cima. Se fixar mais um o de antes fica em segundo e assim por ordem."
 * - Pinned items are ordered with the most recently pinned first (pinnedAt descending).
 * - Unpinned items follow after all pinned items.
 * - stepOrder is sequentially assigned from 1 to N.
 */
export const sortStepsWithPinnedFirst = (steps: ItineraryStep[]): ItineraryStep[] => {
  if (!steps || steps.length === 0) return [];

  const pinned: ItineraryStep[] = [];
  const unpinned: ItineraryStep[] = [];

  steps.forEach((s) => {
    if (s.isPinned) {
      pinned.push({ ...s });
    } else {
      unpinned.push({ ...s });
    }
  });

  // Sort pinned items: newest pinnedAt first (or preserve order/stepOrder)
  pinned.sort((a, b) => {
    if (a.pinnedAt && b.pinnedAt) {
      return b.pinnedAt - a.pinnedAt;
    }
    if (a.pinnedAt && !b.pinnedAt) return -1;
    if (!a.pinnedAt && b.pinnedAt) return 1;
    return (a.stepOrder || 0) - (b.stepOrder || 0);
  });

  // Unpinned items preserve relative order
  unpinned.sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));

  return [...pinned, ...unpinned].map((s, idx) => ({
    ...s,
    stepOrder: idx + 1,
  }));
};

/**
 * Toggles the pinned status of a step while guaranteeing:
 * 1. Newly pinned items are placed at the very top (index 0).
 * 2. Previously pinned items shift down in order (the previous becomes second, etc.).
 * 3. Unpinned items remain below all pinned items.
 */
export const toggleStepPinnedStatus = (
  currentSteps: ItineraryStep[],
  stepId: string
): ItineraryStep[] => {
  const targetStep = currentSteps.find((s) => s.id === stepId);
  if (!targetStep) return currentSteps;

  const willBePinned = !targetStep.isPinned;
  let newSteps: ItineraryStep[];

  if (willBePinned) {
    // Other already pinned items, ordered with highest timestamp first
    const otherPinned = currentSteps
      .filter((s) => s.id !== stepId && !!s.isPinned)
      .sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));

    // Highest timestamp among currently pinned items
    const maxExistingTs = otherPinned.reduce(
      (max, s) => Math.max(max, s.pinnedAt || 0),
      0
    );
    // Guarantee new item has strictly higher timestamp than any previously pinned item
    const newTs = Math.max(Date.now(), maxExistingTs + 1);

    const updatedTarget: ItineraryStep = {
      ...targetStep,
      isPinned: true,
      pinnedAt: newTs,
    };

    // Unpinned items preserve their relative order
    const unpinned = currentSteps.filter((s) => s.id !== stepId && !s.isPinned);

    // Newly pinned item goes to index 0, previous pinned items shift down in order
    newSteps = [updatedTarget, ...otherPinned, ...unpinned];
  } else {
    // Unpinning: remains in unpinned group below all pinned stops
    const updatedTarget: ItineraryStep = {
      ...targetStep,
      isPinned: false,
      pinnedAt: undefined,
    };

    const pinned = currentSteps
      .filter((s) => s.id !== stepId && !!s.isPinned)
      .sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));

    const remainingUnpinned = currentSteps.filter((s) => s.id !== stepId && !s.isPinned);

    newSteps = [...pinned, updatedTarget, ...remainingUnpinned];
  }

  return newSteps.map((s, idx) => ({
    ...s,
    stepOrder: idx + 1,
  }));
};
