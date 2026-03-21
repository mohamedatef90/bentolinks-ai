import { tokens } from '../styles/tokens';

export const useDesignTokens = () => {
  return tokens;
};

// Helper to apply tokens as CSS variables
export const applyTokensToRoot = () => {
  const root = document.documentElement;
  
  // Colors - Brand
  Object.entries(tokens.colors.brand).forEach(([key, value]) => {
    root.style.setProperty(`--color-brand-${key}`, value);
  });
  
  // Colors - Background
  Object.entries(tokens.colors.bg).forEach(([key, value]) => {
    root.style.setProperty(`--color-bg-${key}`, value);
  });
  
  // Colors - Surface
  Object.entries(tokens.colors.surface).forEach(([key, value]) => {
    root.style.setProperty(`--color-surface-${key}`, value);
  });
  
  // Colors - Text
  Object.entries(tokens.colors.text).forEach(([key, value]) => {
    root.style.setProperty(`--color-text-${key}`, value);
  });
  
  // Colors - Border
  Object.entries(tokens.colors.border).forEach(([key, value]) => {
    root.style.setProperty(`--color-border-${key}`, value);
  });
  
  // Colors - Status
  Object.entries(tokens.colors.status).forEach(([key, value]) => {
    root.style.setProperty(`--color-status-${key}`, value);
  });
  
  // Shadows
  Object.entries(tokens.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });
  
  // Transitions
  Object.entries(tokens.transitions).forEach(([key, value]) => {
    root.style.setProperty(`--transition-${key}`, value);
  });
};
