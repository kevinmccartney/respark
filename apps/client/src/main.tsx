import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './index.css';
import { ThemeProvider } from '@respark/ui/theme';

import App from './App';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY. Run `clerk env pull` in apps/client.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider storageKey="respark-theme">
      <ClerkProvider
        publishableKey={publishableKey}
        afterSignOutUrl="/"
        appearance={{
          variables: {
            colorPrimary: 'var(--primary)',
            colorPrimaryForeground: 'var(--primary-foreground)',
            colorForeground: 'var(--foreground)',
            colorBackground: 'var(--background)',
            colorMuted: 'var(--muted)',
            colorMutedForeground: 'var(--muted-foreground)',
            colorInput: 'var(--background)',
            colorInputForeground: 'var(--foreground)',
            colorBorder: 'var(--border)',
            borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-sans)',
          },
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </ThemeProvider>
  </StrictMode>,
);
