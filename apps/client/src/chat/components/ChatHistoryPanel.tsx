import { History } from 'lucide-react';

import { Badge, Button } from '@respark/ui/lib';

const MOCK_HISTORY = [
  { id: '1', title: 'Maiden / minotaur theme ideas', when: 'Just now' },
  { id: '2', title: 'Cuts for my Atraxa list', when: 'Yesterday' },
  { id: '3', title: 'Budget ramp in green', when: '3 days ago' },
  { id: '4', title: 'What does Sol Ring do here?', when: 'Last week' },
  { id: '5', title: 'Suggest some cards', when: 'Last week' },
] as const;

type Props = {
  onBack: () => void;
};

export const ChatHistoryPanel = ({ onBack }: Props) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
      <p className="text-sm font-medium">Chat history</p>
      <Badge variant="secondary">Coming soon</Badge>
    </div>
    <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
      {MOCK_HISTORY.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            disabled
            className="flex w-full flex-col gap-0.5 px-4 py-3 text-left opacity-70"
          >
            <span className="truncate text-sm font-medium">{row.title}</span>
            <span className="text-xs text-muted-foreground">{row.when}</span>
          </button>
        </li>
      ))}
    </ul>
    <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Past conversations will show up here. History isn&apos;t saved yet.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onBack}>
        <History className="size-3.5" />
        Back to chat
      </Button>
    </div>
  </div>
);
