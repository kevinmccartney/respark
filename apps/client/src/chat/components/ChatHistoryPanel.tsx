import { cn } from 'cn';
import { History } from 'lucide-react';

import { Button } from '@respark/ui/lib';

import { useChatConversations } from '../hooks';
import { formatRelativeTime } from '../lib/format-relative-time';

type Props = {
  activeId: string | undefined;
  onSelect: (conversationId: string) => void;
  onBack: () => void;
};

export const ChatHistoryPanel = ({ activeId, onSelect, onBack }: Props) => {
  const {
    data: conversations = [],
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useChatConversations();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="text-sm font-medium">Chat history</p>
      </div>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {isPending ? <li className="px-4 py-3 text-sm text-muted-foreground">Loading…</li> : null}
        {isError ? (
          <li className="space-y-2 px-4 py-3">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'Could not load chat history'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          </li>
        ) : null}
        {!isPending && !isError && conversations.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">No conversations yet.</li>
        ) : null}
        {!isPending && !isError
          ? conversations.map((row) => {
              const active = row.id === activeId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                      active && 'bg-muted/70',
                    )}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => onSelect(row.id)}
                  >
                    <span className="truncate text-sm font-medium">{row.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(row.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })
          : null}
      </ul>
      <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <History className="size-3.5" />
          Back to chat
        </Button>
      </div>
    </div>
  );
};
