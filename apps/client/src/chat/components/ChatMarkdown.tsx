import Markdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';

import { CHAT_CARD_PATH } from '../constants';

import { ChatCardLink } from './ChatCardLink';

const chatMarkdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  h1: ({ children }) => <p className="mb-2 font-heading font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mb-2 font-heading font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mb-2 font-heading font-semibold">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.8em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-md bg-background/70 p-2 text-xs last:mb-0">
      {children}
    </pre>
  ),
  a: ({ href, children }) => {
    const cardMatch = href?.match(CHAT_CARD_PATH);
    if (cardMatch?.[1]) {
      return <ChatCardLink cardId={cardMatch[1]}>{children}</ChatCardLink>;
    }
    if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        {children}
      </a>
    );
  },
  hr: () => <hr className="my-3 border-border" />,
  img: () => null,
};

export const ChatMarkdown = ({ text }: { text: string }) => (
  <Markdown remarkPlugins={[remarkBreaks]} components={chatMarkdownComponents}>
    {text}
  </Markdown>
);
