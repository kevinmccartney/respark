import { Moon, Sun } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Button } from './lib/button.js';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const systemPrefersDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches;

const themeFromSystem = (): Theme => (systemPrefersDark() ? 'dark' : 'light');

const persistTheme = (storageKey: string, theme: Theme) => {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // ignore
  }
};

/** Stored light/dark wins; missing or legacy `system` → read OS preference and persist it. */
const readOrSeedTheme = (storageKey: string): Theme => {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  const seeded = themeFromSystem();
  persistTheme(storageKey, seeded);
  return seeded;
};

const applyThemeClass = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
};

export const ThemeProvider = ({
  children,
  storageKey,
}: {
  children: ReactNode;
  storageKey: string;
}) => {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === 'undefined' ? 'light' : readOrSeedTheme(storageKey),
  );

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      persistTheme(storageKey, next);
    },
    [storageKey],
  );

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'light' ? 'dark' : 'light';
      persistTheme(storageKey, next);
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, cycleTheme }), [theme, setTheme, cycleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};

export const ThemeToggle = () => {
  const { theme, cycleTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={cycleTheme}
      aria-label={`Theme: ${theme}. Click to switch.`}
      title={`Theme: ${theme}`}
    >
      {theme === 'light' ? <Sun /> : <Moon />}
    </Button>
  );
};
