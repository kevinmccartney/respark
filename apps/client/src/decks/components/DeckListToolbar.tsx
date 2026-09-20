import { Label } from '@/core/ui/label';
import {
  DECK_GROUP_LABELS,
  DECK_GROUP_MODES,
  DECK_SORT_LABELS,
  DECK_SORT_MODES,
  DECK_VIEW_LABELS,
  DECK_VIEW_MODES,
  type DeckGroupMode,
  type DeckSortMode,
  type DeckViewMode,
} from '../lib/deck-grouping.ts';

const SELECT_CLASS =
  'border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

type Props = {
  viewMode: DeckViewMode;
  groupMode: DeckGroupMode;
  sortMode: DeckSortMode;
  onViewModeChange: (mode: DeckViewMode) => void;
  onGroupModeChange: (mode: DeckGroupMode) => void;
  onSortModeChange: (mode: DeckSortMode) => void;
};

export const DeckListToolbar = ({
  viewMode,
  groupMode,
  sortMode,
  onViewModeChange,
  onGroupModeChange,
  onSortModeChange,
}: Props) => (
  <>
    <ToolbarSelect<DeckViewMode>
      id="deck-view"
      label="View"
      value={viewMode}
      options={DECK_VIEW_MODES.map((mode) => ({
        value: mode,
        label: DECK_VIEW_LABELS[mode],
      }))}
      onChange={onViewModeChange}
    />
    <ToolbarSelect<DeckGroupMode>
      id="deck-group"
      label="Group"
      value={groupMode}
      options={DECK_GROUP_MODES.map((mode) => ({
        value: mode,
        label: DECK_GROUP_LABELS[mode],
      }))}
      onChange={onGroupModeChange}
    />
    <ToolbarSelect<DeckSortMode>
      id="deck-sort"
      label="Sort"
      value={sortMode}
      options={DECK_SORT_MODES.map((mode) => ({
        value: mode,
        label: DECK_SORT_LABELS[mode],
      }))}
      onChange={onSortModeChange}
    />
  </>
);

const ToolbarSelect = <T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) => (
  <div className="flex items-center gap-2">
    <Label htmlFor={id} className="text-xs text-muted-foreground">
      {label}
    </Label>
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={SELECT_CLASS}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);
