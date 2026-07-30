import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // 1. Check localStorage first (user's explicit preference)
    const saved = localStorage.getItem('labscan_theme');
    if (saved === THEMES.DARK || saved === THEMES.LIGHT) return saved;
    // 2. Fall back to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return THEMES.LIGHT;
    }
    // 3. Default to dark mode (per user request)
    return THEMES.DARK;
  });

  // Apply theme data-theme attribute on <html> element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
      localStorage.setItem('labscan_theme', next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === THEMES.DARK }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
