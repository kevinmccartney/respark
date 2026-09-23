import { ClerkProvider } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { ThemeProvider } from '@respark/ui/theme';

import './index.css';
import App from './App';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY. Run `clerk env pull` in apps/client.');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const Providers = ({ children }: { children: ReactNode }) => (
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
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </ThemeProvider>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
