export const STARTING_LIFE = 20;
export const PLAYER_COUNT = 2;

export const PLAYER_COLORS = ['colorless', 'white', 'blue', 'black', 'red', 'green'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export type Player = { name: string; life: number; color: PlayerColor };

export type Game = { players: Player[]; fullscreen: boolean };

export const defaultName = (index: number) => `Player ${index + 1}`;

const STORAGE_KEY = 'respark.life-tracker';

export const initialPlayers = (): Player[] =>
  Array.from({ length: PLAYER_COUNT }, (_, i) => ({
    name: defaultName(i),
    life: STARTING_LIFE,
    color: 'colorless',
  }));

const isPlayerColor = (value: unknown): value is PlayerColor =>
  PLAYER_COLORS.includes(value as PlayerColor);

const isSavedPlayer = (value: unknown): value is Omit<Player, 'color'> & { color?: unknown } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Player).name === 'string' &&
  Number.isInteger((value as Player).life);

const parsePlayers = (value: unknown): Player[] | null => {
  if (!Array.isArray(value) || value.length !== PLAYER_COUNT || !value.every(isSavedPlayer)) {
    return null;
  }
  return value.map(({ name, life, color }) => ({
    name,
    life,
    color: isPlayerColor(color) ? color : 'colorless',
  }));
};

/** Saved game if it is well-formed; anything else starts a new game. */
export const loadGame = (): Game => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    // Older saves stored only the players array.
    if (Array.isArray(stored)) {
      return { players: parsePlayers(stored) ?? initialPlayers(), fullscreen: false };
    }
    if (typeof stored === 'object' && stored !== null) {
      const { players, fullscreen } = stored as Partial<Record<keyof Game, unknown>>;
      return {
        players: parsePlayers(players) ?? initialPlayers(),
        fullscreen: fullscreen === true,
      };
    }
  } catch {
    // ignore
  }
  return { players: initialPlayers(), fullscreen: false };
};

export const saveGame = (game: Game) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  } catch {
    // ignore
  }
};

export const isGameInProgress = (game: Game) =>
  game.players.some((player) => player.life !== STARTING_LIFE);
