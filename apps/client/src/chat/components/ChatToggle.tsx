import { MessageSquare } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { useChatSession } from '../lib/chat-session.tsx';

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
