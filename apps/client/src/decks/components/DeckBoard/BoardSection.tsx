import type { DeckCardGroup, DeckViewMode } from '../../types';

import { ListGroup } from './ListGroup';
import type { BoardHandlers } from './types';
import { VisualGroup } from './VisualGroup';

export const BoardSection = ({
  title,
  showTitle,
  groups,
  viewMode,
  ...handlers
}: {
  title: string;
  showTitle: boolean;
  groups: DeckCardGroup[];
  viewMode: DeckViewMode;
} & BoardHandlers) => {
  const total = groups.reduce((sum, group) => sum + group.totalQuantity, 0);

  return (
    <div className="space-y-3">
      {showTitle ? (
        <h3 className="font-heading text-lg">
          {title} <span className="text-sm font-normal text-muted-foreground">({total})</span>
        </h3>
      ) : null}
      <div
        className={
          viewMode === 'list' ? 'columns-3xs gap-x-8' : 'flex flex-wrap items-start gap-x-5 gap-y-8'
        }
      >
        {groups.map((group) =>
          viewMode === 'list' ? (
            <ListGroup key={`${title}-${group.key}`} group={group} {...handlers} />
          ) : (
            <VisualGroup key={`${title}-${group.key}`} group={group} {...handlers} />
          ),
        )}
      </div>
    </div>
  );
};
