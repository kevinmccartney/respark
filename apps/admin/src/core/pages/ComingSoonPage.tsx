type ComingSoonPageProps = {
  title: string;
  description: string;
};

export const ComingSoonPage = ({ title, description }: ComingSoonPageProps) => (
  <main className="mx-auto max-w-lg px-5 py-16">
    <p className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
      Coming soon
    </p>
    <h1 className="mb-3 font-heading text-3xl tracking-tight">{title}</h1>
    <p className="text-muted-foreground">{description}</p>
  </main>
);
