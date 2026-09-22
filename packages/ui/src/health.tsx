import { useEffect, useState } from 'react';

import { platformInfoSchema } from '@respark/schemas/platform';

type HealthState = 'checking' | 'ok' | 'error';

export const ApiHealthFooter = ({ apiBaseUrl }: { apiBaseUrl: string }) => {
  const [state, setState] = useState<HealthState>('checking');
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const [healthResponse, infoResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/healthz`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/info`, { signal: controller.signal }),
        ]);

        if (!healthResponse.ok) {
          setState('error');
          return;
        }

        const healthBody: unknown = await healthResponse.json();
        if (
          typeof healthBody !== 'object' ||
          healthBody === null ||
          !('status' in healthBody) ||
          healthBody.status !== 'ok'
        ) {
          setState('error');
          return;
        }

        setState('ok');

        if (!infoResponse.ok) return;
        let infoBody: unknown;
        try {
          infoBody = await infoResponse.json();
        } catch {
          return;
        }
        const parsed = platformInfoSchema.safeParse(infoBody);
        if (parsed.success) setVersion(parsed.data.version);
      } catch {
        if (!controller.signal.aborted) {
          setState('error');
        }
      }
    };

    void load();

    return () => controller.abort();
  }, [apiBaseUrl]);

  const label =
    state === 'checking'
      ? 'Checking API…'
      : state === 'ok'
        ? version
          ? `API OK · v${version}`
          : 'API OK'
        : 'API unavailable';

  const chipClass =
    state === 'error'
      ? 'bg-destructive text-white'
      : state === 'ok'
        ? 'bg-emerald-100 text-emerald-800'
        : 'border border-border text-foreground';

  return (
    <footer className="shrink-0 border-t bg-card px-5 py-2 text-center">
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${chipClass}`}
      >
        {label}
      </span>
    </footer>
  );
};
