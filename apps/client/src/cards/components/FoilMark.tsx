import { formatPrintingFinishes, printingHasFoilTreatment } from '@respark/schemas/cards';

export const FoilMark = ({ label = 'Foil' }: { label?: string }) => (
  <span
    className="foil-label shrink-0 text-[0.65rem] font-semibold tracking-wide"
    aria-label={label}
  >
    {label}
  </span>
);

export const PrintingFinishes = ({ finishes }: { finishes: readonly string[] }) => {
  const text = formatPrintingFinishes(finishes);
  if (!text) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span>{text}</span>
      {printingHasFoilTreatment(finishes) ? <FoilMark /> : null}
    </span>
  );
};
