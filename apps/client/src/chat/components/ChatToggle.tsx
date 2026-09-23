import { MessageSquare } from 'lucide-react';

import { Button } from '@respark/ui/lib';

import { useChatSession } from '../hooks/chat-session';

export const ChatToggle = () => {
  const { isOpen, setOpen } = useChatSession();
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-pressed={isOpen}
      aria-expanded={isOpen}
      aria-controls="global-chat-drawer"
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      title={isOpen ? 'Close chat' : 'Open chat'}
      onClick={() => setOpen(!isOpen)}
    >
      <MessageSquare />
    </Button>
  );
};
