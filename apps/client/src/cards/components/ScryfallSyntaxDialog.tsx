import Markdown, { type Components } from 'react-markdown';
import { SYNTAX_HELP_MARKDOWN } from 'scryfall-query';
import { Button } from '@/core/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/core/ui/dialog';

const helpMarkdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  h1: ({ children }) => (
    <h2 className="mb-2 mt-4 font-heading text-base font-semibold first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-4 font-heading text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1.5 mt-3 font-heading text-sm font-medium first:mt-0">{children}</h4>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-md bg-muted p-2 text-xs last:mb-0">{children}</pre>
  ),
  a: ({ href, children }) => {
    if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        {children}
      </a>
    );
  },
  hr: () => <hr className="my-3 border-border" />,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ScryfallSyntaxDialog = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      showCloseButton={false}
      className="flex max-h-[min(90vh,40rem)] w-[min(calc(100%-2rem),40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-1">
          <DialogTitle>Scryfall syntax</DialogTitle>
          <DialogDescription>
            What Respark’s local parser supports. Full public reference:{' '}
            <a
              href="https://scryfall.com/docs/syntax"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              scryfall.com/docs/syntax
            </a>
            .
          </DialogDescription>
        </div>
        <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
          Close
        </DialogClose>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm text-foreground">
        <Markdown components={helpMarkdownComponents}>{SYNTAX_HELP_MARKDOWN}</Markdown>
      </div>
    </DialogContent>
  </Dialog>
);
