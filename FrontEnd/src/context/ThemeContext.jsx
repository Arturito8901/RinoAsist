import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme') || 'system';
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    
    const applyTheme = () => {
      let activeDark = false;
      if (theme === 'dark') {
        root.classList.add('dark');
        activeDark = true;
      } else if (theme === 'light') {
        root.classList.remove('dark');
        activeDark = false;
      } else {
        // System preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          root.classList.add('dark');
          activeDark = true;
        } else {
          root.classList.remove('dark');
          activeDark = false;
        }
      }
      setIsDark(activeDark);

      // Update Favicon dynamically based on theme
      const favicon = document.getElementById('favicon') || document.querySelector('link[rel="icon"]');
      if (favicon) {
        favicon.href = activeDark ? '/favicon-dark.png' : '/favicon-light.png';
      }
    };

    applyTheme();
    localStorage.setItem('theme', theme);

    // Watch for system preference changes if 'system' is selected
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        applyTheme();
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
