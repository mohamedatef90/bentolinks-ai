import { tokens } from './tokens';

export const tailwindTheme = {
  extend: {
    colors: {
      brand: tokens.colors.brand,
      bg: tokens.colors.bg,
      surface: tokens.colors.surface,
      status: tokens.colors.status,
    },
    spacing: tokens.spacing,
    fontSize: tokens.typography.fontSize,
    fontWeight: tokens.typography.fontWeight,
    lineHeight: tokens.typography.lineHeight,
    borderRadius: tokens.borderRadius,
    boxShadow: tokens.shadows,
    transitionDuration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
  },
};
