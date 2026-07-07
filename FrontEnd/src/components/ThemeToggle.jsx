import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Laptop } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  return (
    <button
      onClick={cycleTheme}
      type="button"
      title={`Tema actual: ${theme === 'light' ? 'Claro' : theme === 'dark' ? 'Oscuro' : 'Sistema'}. Clic para cambiar.`}
      className="p-2 px-3 rounded-xl bg-bg-surface dark:bg-bg-card border border-bdr-base hover:border-brand-primary/40 text-txt-muted hover:text-brand-primary flex items-center justify-center cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 relative group overflow-hidden"
    >
      <span className="flex items-center gap-2">
        {theme === 'light' && <Sun className="w-4 h-4 text-amber-500 animate-pulse" />}
        {theme === 'dark' && <Moon className="w-4 h-4 text-blue-400" />}
        {theme === 'system' && <Laptop className="w-4 h-4 text-txt-subtle" />}
        
        <span className="text-xs font-semibold select-none capitalize leading-none pt-0.5">
          {theme === 'light' ? 'Claro' : theme === 'dark' ? 'Oscuro' : 'Sistema'}
        </span>
      </span>
    </button>
  );
}
