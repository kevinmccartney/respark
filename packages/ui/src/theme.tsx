import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readStoredTheme = (storageKey: string): Theme => {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'system';
};

const systemPrefersDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyThemeClass = (resolved: 'light' | 'dark') => {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
};

const persistTheme = (storageKey: string, theme: Theme) => {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // ignore
  }
};

export const ThemeProvider = ({
  children,
  storageKey,
}: {
  children: ReactNode;
  storageKey: string;
}) => {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof window === 'undefined' ? 'system' : readStoredTheme(storageKey),
  );
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && systemPrefersDark(),
  );
  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      persistTheme(storageKey, next);
    },
    [storageKey],
  );

  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
      persistTheme(storageKey, next);
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, cycleTheme }),
    [theme, resolvedTheme, setTheme, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};
