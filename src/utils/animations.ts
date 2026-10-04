import { Transition } from 'motion/react';

/**
 * Monvian Unified iOS Animation System
 * Standardized springs, easings, and transitions inspired by Apple iOS Human Interface Guidelines.
 */

// Native Apple Spring curves
export const iosSpring: Transition = {
  type: 'spring',
  damping: 28,
  stiffness: 320,
  mass: 0.8,
};

export const iosSpringSnappy: Transition = {
  type: 'spring',
  damping: 24,
  stiffness: 420,
  mass: 0.6,
};

export const iosSpringGentle: Transition = {
  type: 'spring',
  damping: 32,
  stiffness: 260,
  mass: 0.9,
};

// Smooth cubic-bezier standard iOS ease (matches iOS fluid transitions)
export const iosEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Standard fade transition
export const fadeTransition: Transition = {
  duration: 0.2,
  ease: iosEase,
};

// Modal transition (Scale & Fade)
export const modalMotionVariants = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.94 },
};

// Bottom Sheet transition (Slide & subtle scale)
export const sheetMotionVariants = {
  initial: { opacity: 0, y: 32, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 24, scale: 0.98 },
};

// Page / Tab transition
export const pageMotionVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Standardized Tactile Tap Feedback
export const tapScale = {
  scale: 0.96,
};

export const tapScaleIcon = {
  scale: 0.92,
};
