import { cn } from 'cn';
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, Input } from '@respark/ui/lib';

import {
  defaultName,
  loadGame,
  PLAYER_COLORS,
  saveGame,
  STARTING_LIFE,
  type Player,
  type PlayerColor,
} from '../lib/game-storage';
import { COLOR_STYLES } from '../lib/player-colors';

type PlayerNameProps = {
  name: string;
  fallback: string;
  onRename: (name: string) => void;
};

const PlayerName = ({ name, fallback, onRename }: PlayerNameProps) => {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(name)}
        title="Rename player"
        className="rounded-md px-2 py-1 text-lg font-medium transition-colors hover:bg-current/10"
      >
        {name}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onRename(draft.trim() || fallback);
        setDraft(null);
      }}
    >
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          // Cancel the edit without also closing fullscreen.
          e.stopPropagation();
          setDraft(null);
        }}
        onFocus={(e) => e.target.select()}
        autoFocus
        aria-label={`${fallback} name`}
        maxLength={40}
        className="w-40 text-foreground"
      />
      <Button type="submit">Save</Button>
    </form>
  );
};

const swatchClass = (color: PlayerColor) =>
  cn('size-6 rounded-full ring-1 ring-black/20 dark:ring-white/25', COLOR_STYLES[color].swatch);

type ColorPickerProps = {
  playerName: string;
  color: PlayerColor;
  onChange: (color: PlayerColor) => void;
};

const ColorPicker = ({ playerName, color, onChange }: ColorPickerProps) => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Change ${playerName} color (${COLOR_STYLES[color].label})`}
        title="Change color"
        className={swatchClass(color)}
      />
    );
  }

  return (
    <div
      role="group"
      aria-label={`${playerName} color`}
      className="flex items-center gap-1.5"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        setOpen(false);
      }}
    >
      {PLAYER_COLORS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => {
            onChange(option);
            setOpen(false);
          }}
          aria-label={COLOR_STYLES[option].label}
          aria-pressed={option === color}
          title={COLOR_STYLES[option].label}
          autoFocus={option === color}
          className={cn(
            swatchClass(option),
            option === color && 'ring-2 ring-current ring-offset-1 ring-offset-transparent',
          )}
        />
      ))}
    </div>
  );
};

const tapZoneClass = (align: string) =>
  cn(
    'flex flex-1 touch-manipulation items-center transition-colors outline-none select-none hover:bg-current/5 focus-visible:bg-current/5 active:bg-current/10',
    align,
  );

type PlayerPanelsProps = {
  players: Player[];
  fullscreen: boolean;
  onUpdate: (index: number, patch: Partial<Player>) => void;
};

const PlayerPanels = ({ players, fullscreen, onUpdate }: PlayerPanelsProps) => (
  <div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2">
    {players.map(({ name, life, color }, index) => (
      <section
        key={index}
        aria-label={name}
        className={cn(
          'flex flex-col overflow-hidden rounded-lg border transition-colors',
          COLOR_STYLES[color].panel,
        )}
      >
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-4">
          <div className="col-start-2">
            <PlayerName
              name={name}
              fallback={defaultName(index)}
              onRename={(next) => onUpdate(index, { name: next })}
            />
          </div>
          <div className="justify-self-end">
            <ColorPicker
              playerName={name}
              color={color}
              onChange={(next) => onUpdate(index, { color: next })}
            />
          </div>
        </div>
        <div className="relative flex min-h-48 flex-1">
          <button
            type="button"
            onClick={() => onUpdate(index, { life: life - 1 })}
            aria-label={`${name} lose 1 life`}
            className={tapZoneClass('justify-start pl-4')}
          >
            <Minus className="size-8 opacity-60" />
          </button>
          <button
            type="button"
            onClick={() => onUpdate(index, { life: life + 1 })}
            aria-label={`${name} gain 1 life`}
            className={tapZoneClass('justify-end pr-4')}
          >
            <Plus className="size-8 opacity-60" />
          </button>
          <output
            aria-live="polite"
            className={cn(
              'pointer-events-none absolute inset-0 flex items-center justify-center font-heading tracking-tight tabular-nums',
              fullscreen ? 'text-9xl' : 'text-7xl',
            )}
          >
            {life}
          </output>
        </div>
      </section>
    ))}
  </div>
);

export const LifeTrackerPage = () => {
  const [savedGame] = useState(loadGame);
  const [players, setPlayers] = useState(savedGame.players);
  const [fullscreen, setFullscreen] = useState(savedGame.fullscreen);

  useEffect(() => saveGame({ players, fullscreen }), [players, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);

  const updatePlayer = (index: number, patch: Partial<Player>) =>
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const resetLife = () => setPlayers((prev) => prev.map((p) => ({ ...p, life: STARTING_LIFE })));

  const resetButton = (
    <Button variant="default" onClick={resetLife}>
      <RotateCcw data-icon="inline-start" />
      Reset
    </Button>
  );

  if (fullscreen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Life tracker"
        className="fixed inset-0 z-[60] flex flex-col gap-4 bg-background p-4"
      >
        <div className="flex shrink-0 items-center justify-between gap-2">
          {resetButton}
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => setFullscreen(false)}
            aria-label="Exit fullscreen"
            title="Exit fullscreen"
          >
            <X />
          </Button>
        </div>
        <PlayerPanels players={players} fullscreen onUpdate={updatePlayer} />
      </div>
    );
  }

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-5 px-6 py-8 text-left">
      <header className="flex items-end justify-between gap-4">
        <h1 className="font-heading text-3xl tracking-tight">Life tracker</h1>
        <div className="flex items-center gap-2">
          {resetButton}
          <Button variant="outline" onClick={() => setFullscreen(true)}>
            <Maximize2 data-icon="inline-start" />
            Fullscreen
          </Button>
        </div>
      </header>
      <PlayerPanels players={players} fullscreen={false} onUpdate={updatePlayer} />
    </main>
  );
};
