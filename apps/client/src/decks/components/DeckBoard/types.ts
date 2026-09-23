import type { DeckCard } from '../../types';

export type BoardHandlers = {
  previewCardId: string | null;
  previewFaceIndex: number;
  onPreview: (cardId: string) => void;
  onTransform: (cardId: string) => void;
  onPickPrinting: (card: DeckCard) => void;
  onBump: (card: DeckCard, delta: number) => void;
  onToggleFoil: (card: DeckCard) => void;
  onToggleSideboard: (card: DeckCard) => void;
};
