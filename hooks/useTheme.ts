import { useState, useEffect } from 'react';
import { AppTheme } from '../types';

export const useTheme = () => {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('bento-theme');
    return (saved as AppTheme) || 'default';
  });

  useEffect(() => {
    localStorage.setItem('bento-theme', theme);
    document.body.className = `theme-${theme}`;
  }, [theme]);

  return { theme, setTheme };
};
