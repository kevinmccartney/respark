import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { platformInfoSchema } from 'schemas/platform';
import { apiBaseUrl } from '../lib/api.ts';

type HealthState = 'checking' | 'ok' | 'error';

export const ApiHealthFooter = () => {
  const [state, setState] = useState<HealthState>('checking');
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const [healthResponse, infoResponse] = await Promise.all([
          fetch(`${apiBaseUrl()}/healthz`, { signal: controller.signal }),
          fetch(`${apiBaseUrl()}/info`, { signal: controller.signal }),
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
  }, []);

  const label =
    state === 'checking'
      ? 'Checking API…'
      : state === 'ok'
        ? version
          ? `API OK · v${version}`
          : 'API OK'
        : 'API unavailable';

  return (
    <footer className="shrink-0 border-t bg-card px-5 py-2 text-center">
      <Badge
        variant={state === 'error' ? 'destructive' : state === 'ok' ? 'secondary' : 'outline'}
        role="status"
        aria-live="polite"
        className={state === 'ok' ? 'bg-emerald-100 text-emerald-800' : undefined}
      >
        {label}
      </Badge>
    </footer>
  );
};
