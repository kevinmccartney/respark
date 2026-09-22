import { SignInButton, SignUpButton } from '@clerk/react';

import { Button } from '@respark/ui/lib';
export const WelcomePage = () => (
  <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
    <div
      className="pointer-events-none absolute inset-x-[10%] top-[20%] h-72 bg-[radial-gradient(ellipse_at_center,rgba(180,83,9,0.12),transparent_70%)]"
      aria-hidden
    />
    <section className="relative max-w-xl text-center">
      <p className="mb-3 text-sm font-medium tracking-wide text-amber-800 uppercase">
        Magic: The Gathering companion
      </p>
      <h1 className="mb-4 font-heading text-4xl tracking-tight text-balance sm:text-5xl">
        Respark your deck building
      </h1>
      <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-muted-foreground">
        Learn cards, refine your lists, and build decks with a companion built for the long game—not
        just the next brew night.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <SignUpButton mode="modal">
          <Button type="button" size="lg">
            Get started
          </Button>
        </SignUpButton>
        <SignInButton mode="modal">
          <Button type="button" variant="outline" size="lg">
            I already have an account
          </Button>
        </SignInButton>
      </div>
    </section>
  </div>
);
