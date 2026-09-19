import { useAuth } from '@clerk/react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SiteHeader } from '../components/SiteHeader.tsx'
import { ApiError } from '../lib/api.ts'
import { createDeck } from '../lib/decks.ts'

export function NewDeckPage() {
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trimmedName || saving) return

    setSaving(true)
    setError(null)
    try {
      await createDeck(getToken, trimmedName)
      navigate('/home')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create deck')
      setSaving(false)
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center gap-8 px-6 py-12 text-center">
        <header className="max-w-lg">
          <h1 className="font-heading text-3xl tracking-tight">New deck</h1>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Name it now — you can add cards from search soon.
          </p>
        </header>

        <Card className="w-full max-w-md text-left" aria-labelledby="new-deck-heading">
          <CardHeader>
            <CardTitle id="new-deck-heading">Deck details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <Label htmlFor="deck-name">Deck name</Label>
              <Input
                id="deck-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Mono-Red Burn"
                maxLength={120}
                autoFocus
                required
                disabled={saving}
              />

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="mt-2 flex justify-end gap-2">
                <Button variant="outline" render={<Link to="/home" />}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!trimmedName || saving}>
                  {saving ? 'Creating…' : 'Create deck'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
