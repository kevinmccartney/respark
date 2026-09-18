import { useEffect, useState } from 'react'
import { apiBaseUrl } from '../lib/api.ts'

type HealthState = 'checking' | 'ok' | 'error'

export function ApiHealthFooter() {
  const [state, setState] = useState<HealthState>('checking')

  useEffect(() => {
    const controller = new AbortController()

    async function checkHealth() {
      try {
        const response = await fetch(`${apiBaseUrl()}/healthz`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          setState('error')
          return
        }

        const body: unknown = await response.json()
        if (
          typeof body === 'object' &&
          body !== null &&
          'status' in body &&
          (body as { status: string }).status === 'ok'
        ) {
          setState('ok')
          return
        }

        setState('error')
      } catch {
        if (!controller.signal.aborted) {
          setState('error')
        }
      }
    }

    void checkHealth()

    return () => controller.abort()
  }, [])

  const label =
    state === 'checking'
      ? 'Checking API…'
      : state === 'ok'
        ? 'API OK'
        : 'API unavailable'

  return (
    <footer className="site-footer">
      <span
        className={`api-health api-health-${state}`}
        role="status"
        aria-live="polite"
      >
        {label}
      </span>
    </footer>
  )
}
