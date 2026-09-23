import { ColorIdentity } from '@respark-client/cards';

import type { DeckCardGroup } from '../../types';

export const GroupHeader = ({ group }: { group: DeckCardGroup }) => (
  <h4 className="mb-2 flex items-center gap-1.5 border-b pb-1 font-heading text-sm">
    {group.colorIdentity ? <ColorIdentity colors={group.colorIdentity} size={14} /> : null}
    <span>
      {group.label}{' '}
      <span className="font-normal text-muted-foreground">({group.totalQuantity})</span>
    </span>
  </h4>
);
