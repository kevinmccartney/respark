import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SiteHeader } from '../components/SiteHeader.tsx';

type NotFoundPageProps = {
  title?: string;
  description?: string;
};

export const NotFoundPage = ({
  title = 'Page not found',
  description = 'That URL does not match anything in Respark.',
}: NotFoundPageProps) => {
  const navigate = useNavigate();
  const goBack = () => {
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
        <div
          className="pointer-events-none absolute inset-x-[10%] top-[20%] h-72 bg-[radial-gradient(ellipse_at_center,rgba(180,83,9,0.12),transparent_70%)]"
          aria-hidden
        />
        <section className="relative max-w-lg text-center">
          <p className="mb-3 text-sm font-medium tracking-wide text-amber-800 uppercase">404</p>
          <h1 className="mb-4 font-heading text-4xl tracking-tight text-balance">{title}</h1>
          <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
          <Button type="button" size="lg" onClick={goBack}>
            Back
          </Button>
        </section>
      </main>
    </>
  );
};
