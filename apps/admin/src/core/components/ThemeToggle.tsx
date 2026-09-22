import { Monitor, Moon, Sun } from 'lucide-react';

import { Button } from '@respark/ui/lib';
import { useTheme, type Theme } from '@respark/ui/theme';

const LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export const ThemeToggle = () => {
  const { theme, cycleTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={cycleTheme}
      aria-label={`Theme: ${LABELS[theme]}. Click to change.`}
      title={`Theme: ${LABELS[theme]}`}
    >
      {theme === 'light' ? <Sun /> : theme === 'dark' ? <Moon /> : <Monitor />}
    </Button>
  );
};
