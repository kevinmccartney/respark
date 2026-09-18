import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '../lib/api.ts'
import { formatDuration, formatNumber, formatTimestamp, statusBadgeProps } from '../lib/format.ts'
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
    <main className="mx-auto max-w-6xl px-5 py-5">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">Ingestion runs</h1>
          <p className="mt-1 text-muted-foreground">Recent ETL pipeline executions</p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void onStartRun()
          }}
        >
          <label className="sr-only" htmlFor="etl-source">
            Source
          </label>
          <Select
            value={source}
            onValueChange={(value) => {
              if (value) setSource(value)
            }}
            disabled={starting || forbidden}
          >
            <SelectTrigger id="etl-source" className="min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ETL_JOB_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value} disabled={!s.implemented}>
                  {s.value}
                  {!s.implemented ? ' (soon)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={starting || forbidden}>
            {starting ? 'Starting…' : 'Run ETL'}
          </Button>
        </form>
      </header>

      {startMessage ? (
        <p className="mb-3 text-muted-foreground" role="status">
          {startMessage}
        </p>
      ) : null}

      {loading ? <p className="text-muted-foreground">Loading…</p> : null}
      {error ? (
        <Alert variant={forbidden ? 'destructive' : 'default'} className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !error ? (
        runs.length === 0 ? (
          <p className="text-muted-foreground">No ingestion runs yet.</p>
        ) : (
          <div className="rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Seen</TableHead>
                  <TableHead>Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer"
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
                    <TableCell>
                      <Badge {...statusBadgeProps(run.status)}>{run.status}</Badge>
                    </TableCell>
                    <TableCell>{run.source}</TableCell>
                    <TableCell>{formatTimestamp(run.startedAt)}</TableCell>
                    <TableCell>{formatDuration(run.durationMs)}</TableCell>
                    <TableCell>{formatNumber(run.recordsSeen)}</TableCell>
                    <TableCell className={run.recordsFailed > 0 ? 'font-semibold text-destructive' : undefined}>
                      {formatNumber(run.recordsFailed)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : null}
    </main>
  )
}
