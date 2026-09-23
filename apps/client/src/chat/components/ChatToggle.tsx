import { cn } from 'cn';
import { MessageSquare } from 'lucide-react';
import { useMatches } from 'react-router-dom';

import { Button } from '@respark/ui/lib';

import { routeHasPagination, usePaginationFooterVisible } from '@respark-client/core';

import { useChatSession } from '../hooks/chat-session';

export const ChatToggle = () => {
  const { isOpen, setOpen } = useChatSession();
  const matches = useMatches();
  const hasPagination = matches.some((match) => routeHasPagination(match.handle));
  const paginationFooterVisible = usePaginationFooterVisible();
  const clearPagination = hasPagination && paginationFooterVisible;

  if (isOpen) return null;

  return (
    <Button
      type="button"
      size="icon-lg"
      className={cn(
        'fixed right-5 z-40 size-14 rounded-full shadow-lg transition-[bottom] duration-200',
        clearPagination ? 'bottom-32 sm:bottom-24' : 'bottom-16',
        "[&_svg:not([class*='size-'])]:size-6",
      )}
      aria-expanded={false}
      aria-controls="global-chat-drawer"
      aria-label="Open chat"
      title="Open chat"
      onClick={() => setOpen(true)}
    >
      <MessageSquare />
    </Button>
  );
};
