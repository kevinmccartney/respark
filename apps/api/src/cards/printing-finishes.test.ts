import { describe, expect, it } from 'vitest';
import {
  formatPrintingFinishes,
  premiumFinishLabel,
  printingAllowsFoil,
  printingFoilIsOptional,
  printingHasFoilTreatment,
  printingHasPremiumFinish,
  resolveDeckLineFoil,
} from 'schemas/cards';

describe('printing finishes', () => {
  it('treats etched as a premium finish like foil', () => {
    expect(printingHasPremiumFinish(['etched'])).toBe(true);
    expect(printingHasPremiumFinish(['foil'])).toBe(true);
    expect(printingHasPremiumFinish(['nonfoil'])).toBe(false);
  });

  it('allows foil toggle when finishes are unknown or premium', () => {
    expect(printingAllowsFoil([])).toBe(true);
    expect(printingAllowsFoil(['etched'])).toBe(true);
    expect(printingAllowsFoil(['nonfoil', 'foil'])).toBe(true);
    expect(printingAllowsFoil(['nonfoil'])).toBe(false);
  });

  it('shows foil overlay for etched and foil-only printings', () => {
    expect(printingHasFoilTreatment(['etched'])).toBe(true);
    expect(printingHasFoilTreatment(['foil'])).toBe(true);
    expect(printingHasFoilTreatment(['nonfoil', 'foil'])).toBe(false);
    expect(printingHasFoilTreatment(['nonfoil'])).toBe(false);
  });

  it('labels etched ahead of foil', () => {
    expect(premiumFinishLabel(['etched'])).toBe('Etched');
    expect(premiumFinishLabel(['foil'])).toBe('Foil');
    expect(premiumFinishLabel(['nonfoil', 'foil'])).toBe(null);
  });

  it('formats known finish names for display', () => {
    expect(formatPrintingFinishes(['etched'])).toBe('Etched');
    expect(formatPrintingFinishes(['nonfoil', 'foil'])).toBe('Nonfoil, Foil');
    expect(formatPrintingFinishes(['galaxy'])).toBe('galaxy');
  });

  it('treats etched and foil-only printings as always-foil deck lines', () => {
    expect(printingFoilIsOptional(['etched'])).toBe(false);
    expect(printingFoilIsOptional(['foil'])).toBe(false);
    expect(printingFoilIsOptional(['nonfoil', 'foil'])).toBe(true);
    expect(printingFoilIsOptional([])).toBe(true);
    expect(resolveDeckLineFoil(['etched'], false)).toBe(true);
    expect(resolveDeckLineFoil(['foil'], false)).toBe(true);
    expect(resolveDeckLineFoil(['nonfoil', 'foil'], false)).toBe(false);
    expect(resolveDeckLineFoil(['nonfoil', 'foil'], true)).toBe(true);
    expect(resolveDeckLineFoil(['nonfoil'], true)).toBe(false);
  });
});
