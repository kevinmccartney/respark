import { useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../lib/api.ts'
import { formatDuration, formatNumber, formatTimestamp, statusClass } from '../lib/format.ts'
import {
  fetchIngestionErrors,
  fetchIngestionRun,
  isForbidden,
  type IngestionError,
  type IngestionRun,
} from '../lib/runs.ts'

const PAGE_SIZE = 50

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()

  const [run, setRun] = useState<IngestionRun | null>(null)
  const [errors, setErrors] = useState<IngestionError[]>([])
  const [totalErrors, setTotalErrors] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorsLoading, setErrorsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [expandedPayload, setExpandedPayload] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      setForbidden(false)
      setOffset(0)
      try {
        const [runRow, errorPage] = await Promise.all([
          fetchIngestionRun(getToken, id!),
          fetchIngestionErrors(getToken, id!, { limit: PAGE_SIZE, offset: 0 }),
        ])
        if (controller.signal.aborted) return
        setRun(runRow)
        setErrors(errorPage.errors)
        setTotalErrors(errorPage.total)
      } catch (err) {
        if (controller.signal.aborted) return
        if (isForbidden(err)) {
          setForbidden(true)
          setError('Your account is not an admin. Set publicMetadata.role to "admin" in Clerk.')
        } else if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('Could not load run')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [getToken, id])

  async function loadErrorPage(nextOffset: number) {
    if (!id) return
    setErrorsLoading(true)
    try {
      const errorPage = await fetchIngestionErrors(getToken, id, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      setErrors(errorPage.errors)
      setTotalErrors(errorPage.total)
      setOffset(nextOffset)
      setExpandedPayload(null)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Could not load failed rows')
    } finally {
      setErrorsLoading(false)
    }
  }

  return (
    <main className="admin-main">
      <p className="breadcrumb">
        <Link to="/">← Runs</Link>
      </p>

      {loading ? <p className="muted">Loading…</p> : null}
      {error ? (
        <p className={forbidden ? 'error-banner' : 'error-text'} role="alert">
          {error}
        </p>
      ) : null}

      {run ? (
        <>
          <header className="page-header">
            <div className="page-header-row">
              <h1>{run.source}</h1>
              <span className={statusClass(run.status)}>{run.status}</span>
            </div>
            <p className="muted mono">{run.id}</p>
          </header>

          <dl className="stat-grid">
            <div>
              <dt>Started</dt>
              <dd>{formatTimestamp(run.startedAt)}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{formatTimestamp(run.completedAt)}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{formatDuration(run.durationMs)}</dd>
            </div>
            <div>
              <dt>Source version</dt>
              <dd>{run.sourceVersion ?? '—'}</dd>
            </div>
            <div>
              <dt>Seen</dt>
              <dd>{formatNumber(run.recordsSeen)}</dd>
            </div>
            <div>
              <dt>Inserted</dt>
              <dd>{formatNumber(run.recordsInserted)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatNumber(run.recordsUpdated)}</dd>
            </div>
            <div>
              <dt>Unchanged</dt>
              <dd>{formatNumber(run.recordsUnchanged)}</dd>
            </div>
            <div>
              <dt>Failed</dt>
              <dd className={run.recordsFailed > 0 ? 'cell-warn' : undefined}>
                {formatNumber(run.recordsFailed)}
              </dd>
            </div>
            <div>
              <dt>Download</dt>
              <dd>
                {run.downloadBytes != null ? `${formatNumber(run.downloadBytes)} bytes` : '—'}
              </dd>
            </div>
          </dl>

          {run.sourceUrl ? (
            <p className="muted">
              Source URL:{' '}
              <a href={run.sourceUrl} target="_blank" rel="noreferrer">
                {run.sourceUrl}
              </a>
            </p>
          ) : null}

          {run.errorMessage ? (
            <section className="run-error-block" aria-label="Run error">
              <h2>Run error</h2>
              <pre className="error-pre">{run.errorMessage}</pre>
            </section>
          ) : null}

          <section className="errors-section" aria-labelledby="errors-heading">
            <div className="section-header">
              <h2 id="errors-heading">Failed rows</h2>
              <span className="muted">
                {formatNumber(totalErrors)} total
                {totalErrors > 0
                  ? ` · showing ${offset + 1}–${offset + errors.length}`
                  : null}
              </span>
            </div>

            {errorsLoading ? <p className="muted">Loading…</p> : null}

            {!errorsLoading && errors.length === 0 ? (
              <p className="muted">No failed rows for this run.</p>
            ) : null}

            {!errorsLoading && errors.length > 0 ? (
              <>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th>External ID</th>
                        <th>Error</th>
                        <th>Created</th>
                        <th>Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.map((row) => (
                        <tr key={row.id}>
                          <td>{row.stage}</td>
                          <td className="mono">{row.externalId ?? '—'}</td>
                          <td className="error-cell">{row.errorMessage}</td>
                          <td>{formatTimestamp(row.createdAt)}</td>
                          <td>
                            {row.payload == null ? (
                              '—'
                            ) : (
                              <button
                                type="button"
                                className="link-button"
                                onClick={() =>
                                  setExpandedPayload((cur) => (cur === row.id ? null : row.id))
                                }
                              >
                                {expandedPayload === row.id ? 'Hide' : 'Show'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {expandedPayload != null ? (
                  <pre className="payload-pre">
                    {JSON.stringify(
                      errors.find((e) => e.id === expandedPayload)?.payload,
                      null,
                      2,
                    )}
                  </pre>
                ) : null}

                <div className="pager">
                  <button
                    type="button"
                    className="auth-button"
                    disabled={offset === 0 || errorsLoading}
                    onClick={() => void loadErrorPage(Math.max(0, offset - PAGE_SIZE))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="auth-button"
                    disabled={offset + PAGE_SIZE >= totalErrors || errorsLoading}
                    onClick={() => void loadErrorPage(offset + PAGE_SIZE)}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  )
}
