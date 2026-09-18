import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api.ts'
import { formatDuration, formatNumber, formatTimestamp, statusClass } from '../lib/format.ts'
import {
  ETL_JOB_SOURCES,
  fetchIngestionRuns,
  isForbidden,
  startEtlJob,
  type IngestionRun,
} from '../lib/runs.ts'

export function RunsListPage() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [runs, setRuns] = useState<IngestionRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [source, setSource] = useState<string>('Scryfall')
  const [starting, setStarting] = useState(false)
  const [startMessage, setStartMessage] = useState<string | null>(null)

  const loadRuns = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    setForbidden(false)
    try {
      const list = await fetchIngestionRuns(getToken, { limit: 100 })
      if (!signal?.aborted) setRuns(list)
    } catch (err) {
      if (signal?.aborted) return
      if (isForbidden(err)) {
        setForbidden(true)
        setError('Your account is not an admin. Set publicMetadata.role to "admin" in Clerk.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Could not load ingestion runs')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    const controller = new AbortController()
    void loadRuns(controller.signal)
    return () => controller.abort()
  }, [loadRuns])

  async function onStartRun() {
    setStarting(true)
    setStartMessage(null)
    try {
      const result = await startEtlJob(getToken, source)
      setStartMessage(`Started ${result.source} job — refresh in a moment for the new run.`)
      // Brief delay so the CLI can insert the running row.
      await new Promise((r) => setTimeout(r, 800))
      await loadRuns()
    } catch (err) {
      if (err instanceof ApiError) setStartMessage(err.message)
      else setStartMessage('Could not start ETL job')
    } finally {
      setStarting(false)
    }
  }

  return (
    <main className="admin-main">
      <header className="page-header page-header-with-actions">
        <div>
          <h1>Ingestion runs</h1>
          <p className="muted">Recent ETL pipeline executions</p>
        </div>
        <form
          className="etl-start-form"
          onSubmit={(e) => {
            e.preventDefault()
            void onStartRun()
          }}
        >
          <label className="etl-start-label">
            <span className="visually-hidden">Source</span>
            <select
              className="etl-source-select"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={starting || forbidden}
            >
              {ETL_JOB_SOURCES.map((s) => (
                <option key={s.value} value={s.value} disabled={!s.implemented}>
                  {s.value}
                  {!s.implemented ? ' (soon)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="auth-button auth-button-primary"
            disabled={starting || forbidden}
          >
            {starting ? 'Starting…' : 'Run ETL'}
          </button>
        </form>
      </header>

      {startMessage ? (
        <p className="muted" role="status">
          {startMessage}
        </p>
      ) : null}

      {loading ? <p className="muted">Loading…</p> : null}
      {error ? (
        <p className={forbidden ? 'error-banner' : 'error-text'} role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        runs.length === 0 ? (
          <p className="muted">No ingestion runs yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Seen</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="clickable-row"
                    tabIndex={0}
                    role="link"
                    onClick={() => navigate(`/runs/${run.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/runs/${run.id}`)
                      }
                    }}
                  >
                    <td>
                      <span className={statusClass(run.status)}>{run.status}</span>
                    </td>
                    <td>{run.source}</td>
                    <td>{formatTimestamp(run.startedAt)}</td>
                    <td>{formatDuration(run.durationMs)}</td>
                    <td>{formatNumber(run.recordsSeen)}</td>
                    <td className={run.recordsFailed > 0 ? 'cell-warn' : undefined}>
                      {formatNumber(run.recordsFailed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </main>
  )
}
