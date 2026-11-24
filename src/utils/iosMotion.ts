/**
 * Shared iOS-inspired motion physics & transition tokens for Monvian.
 * Prioritizes critically damped, GPU-composited animations with zero sluggishness.
 */

export const IOS_EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;

export const IOS_SPRING_SHEET = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 35,
  mass: 0.85,
};

export const IOS_SPRING_PRESS = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 30,
  mass: 0.6,
};

export const IOS_PAGE_TRANSITION = {
  duration: 0.26,
  ease: IOS_EASE_SMOOTH,
};

export const IOS_MODAL_EXIT_TRANSITION = {
  duration: 0.2,
  ease: IOS_EASE_SMOOTH,
};
