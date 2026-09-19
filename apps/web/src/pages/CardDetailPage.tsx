import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "../components/SiteHeader.tsx";
import { ApiError } from "../lib/api.ts";
import {
  fetchCard,
  type CardDetail,
  type CardPrintingSummary,
} from "../lib/cards.ts";

type CardDetailLocationState = {
  fromSearch?: string;
};

function searchBackPath(state: unknown): string {
  if (
    state &&
    typeof state === "object" &&
    "fromSearch" in state &&
    typeof (state as CardDetailLocationState).fromSearch === "string" &&
    (state as CardDetailLocationState).fromSearch!.startsWith("/search")
  ) {
    return (state as CardDetailLocationState).fromSearch!;
  }
  return "/search";
}

export function CardDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const backToSearch = searchBackPath(location.state);
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const printingParam = searchParams.get("printing");

  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setCard(null);
      try {
        const detail = await fetchCard(getToken, id);
        if (controller.signal.aborted) return;
        setCard(detail);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Could not load card");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    if (id) void load();
    return () => controller.abort();
  }, [getToken, id]);

  const selectedPrinting = useMemo(() => {
    if (!card || card.printings.length === 0) return null;
    return (
      card.printings.find((p) => p.id === printingParam) ?? card.printings[0]
    );
  }, [card, printingParam]);

  function selectPrinting(printing: CardPrintingSummary) {
    const next = new URLSearchParams(searchParams);
    // Default printing is the first (newest); omit param when selected.
    if (card && printing.id === card.printings[0]?.id) next.delete("printing");
    else next.set("printing", printing.id);
    setSearchParams(next, { replace: true });
  }

  const imageSrc =
    selectedPrinting?.imageLarge ?? selectedPrinting?.imageNormal ?? null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8 text-left">
        <div>
          <Button
            variant="outline"
            size="sm"
            render={<Link to={backToSearch} />}
          >
            Back to search
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground" aria-live="polite">
            Loading card…
          </p>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && card ? (
          <>
            <div className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr]">
              <div className="overflow-hidden rounded-md bg-muted">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={card.name}
                    className="h-auto w-full"
                  />
                ) : (
                  <div className="flex aspect-5/7 items-center justify-center p-6 text-sm text-muted-foreground">
                    No image
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <header className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="font-heading text-3xl tracking-tight">
                      {card.name}
                    </h1>
                    {card.manaCost ? (
                      <span className="font-mono text-lg text-muted-foreground">
                        {card.manaCost}
                      </span>
                    ) : null}
                  </div>
                  {card.typeLine ? (
                    <p className="text-muted-foreground">{card.typeLine}</p>
                  ) : null}
                </header>

                {card.oracleText ? (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {card.oracleText}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No oracle text.
                  </p>
                )}

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <Meta label="Layout" value={card.layout} />
                  <Meta
                    label="Colors"
                    value={card.colors?.length ? card.colors.join(", ") : null}
                  />
                  <Meta
                    label="Color identity"
                    value={
                      card.colorIdentity?.length
                        ? card.colorIdentity.join(", ")
                        : null
                    }
                  />
                  <Meta
                    label="Keywords"
                    value={
                      card.keywords?.length ? card.keywords.join(", ") : null
                    }
                  />
                  <Meta label="Mana value" value={card.manaValue} />
                  <Meta
                    label="Reserved"
                    value={
                      card.reserved === null
                        ? null
                        : card.reserved
                          ? "Yes"
                          : "No"
                    }
                  />
                </dl>

                {selectedPrinting ? (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      {selectedPrinting.setName} ({selectedPrinting.setCode}) #
                      {selectedPrinting.collectorNumber}
                      {selectedPrinting.rarity
                        ? ` · ${selectedPrinting.rarity}`
                        : ""}
                    </p>
                    {selectedPrinting.artist ? (
                      <p>Illustrated by {selectedPrinting.artist}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <section className="space-y-3" aria-labelledby="printings-heading">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="printings-heading" className="font-heading text-xl">
                  Printings
                </h2>
                <Badge variant="secondary">{card.printings.length}</Badge>
              </div>
              {card.printings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No printings found.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {card.printings.map((printing) => {
                    const active = printing.id === selectedPrinting?.id;
                    return (
                      <li key={printing.id}>
                        <button
                          type="button"
                          onClick={() => selectPrinting(printing)}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 ${
                            active ? "bg-muted" : ""
                          }`}
                        >
                          <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">
                            {printing.imageNormal ? (
                              <img
                                src={printing.imageNormal}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {printing.setName}{" "}
                              <span className="font-normal text-muted-foreground">
                                ({printing.setCode})
                              </span>
                            </p>
                            <p className="truncate text-muted-foreground">
                              #{printing.collectorNumber}
                              {printing.rarity ? ` · ${printing.rarity}` : ""}
                              {printing.releasedAt
                                ? ` · ${printing.releasedAt}`
                                : ""}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
