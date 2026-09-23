import { BackButton } from '@respark/ui/back-button';

type NotFoundPageProps = {
  title?: string;
  description?: string;
};

export const NotFoundPage = ({
  title = 'Page not found',
  description = 'That URL does not match anything in admin.',
}: NotFoundPageProps) => (
  <main className="mx-auto flex max-w-lg flex-col items-center px-5 py-16 text-center">
    <p className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">404</p>
    <h1 className="mb-3 font-heading text-3xl tracking-tight">{title}</h1>
    <p className="mb-8 text-muted-foreground">{description}</p>
    <BackButton fallbackTo="/" />
  </main>
);
