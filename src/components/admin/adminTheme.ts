import type React from 'react';

/**
 * Centralized design tokens and tactile 3D surface styles for Monvian Admin 2.0.
 * Light-only Apple/SaaS aesthetic matching the approved visual reference.
 */
export const ADMIN_COLORS = {
  canvasBg: '#F4F7FC',
  sidebarBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  primaryBlue: '#1668FF',
  primaryBlueHover: '#0F5AE6',
  primaryBlueSoft: '#EBF2FF',
  primaryBlueTint: '#DFECFF',
  textPrimary: '#0D1526',
  textSecondary: '#475569',
  textMuted: '#7B8AA3',
  borderSubtle: 'rgba(226, 232, 240, 0.85)',
  gridLine: '#EBF0F8',
} as const;

export const ADMIN_SHADOWS = {
  sidebar: '10px 0 38px -16px rgba(15, 23, 42, 0.08), 1px 0 0 rgba(226, 232, 240, 0.6)',
  card: '0 12px 32px -12px rgba(30, 58, 138, 0.09), 0 2px 8px -2px rgba(15, 23, 42, 0.04)',
  cardHover: '0 18px 38px -12px rgba(30, 58, 138, 0.14), 0 4px 12px -2px rgba(15, 23, 42, 0.05)',
  floatingPill: '0 10px 26px -8px rgba(30, 58, 138, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
  floatingPillHover: '0 14px 30px -8px rgba(30, 58, 138, 0.17), 0 4px 10px -2px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 1)',
  popover: '0 22px 48px -12px rgba(15, 23, 42, 0.16), 0 6px 16px -4px rgba(30, 58, 138, 0.08)',
} as const;

export const ADMIN_NAV_3D_STYLE: Record<'normal' | 'active', React.CSSProperties> = {
  normal: {
    background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 100%)',
    border: '1px solid rgba(226, 232, 240, 0.9)',
    boxShadow:
      '0 6px 16px -6px rgba(30, 58, 138, 0.08), 0 2px 5px -1px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 1), inset 0 -1.5px 2px rgba(148, 163, 184, 0.12)',
  },
  active: {
    background: 'linear-gradient(180deg, #EFF5FF 0%, #DCEBFF 100%)',
    border: '1px solid rgba(22, 104, 255, 0.24)',
    boxShadow:
      '0 10px 24px -6px rgba(22, 104, 255, 0.24), 0 3px 8px -2px rgba(22, 104, 255, 0.12), inset 2.5px 0 0 rgba(22, 104, 255, 0.85), inset 0 1px 1px rgba(255, 255, 255, 0.92), inset 0 -2px 3px rgba(22, 104, 255, 0.12)',
  },
};

export const ADMIN_CARD_STYLE: React.CSSProperties = {
  background: ADMIN_COLORS.cardBg,
  border: '1px solid rgba(255, 255, 255, 0.96)',
  boxShadow: ADMIN_SHADOWS.card,
};

export const ADMIN_MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export type AdminChartRange = '7d' | '30d' | '90d';
