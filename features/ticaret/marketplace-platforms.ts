/**
 * Marketplace platforma sabitləri və tipləri.
 * Client komponentlərdən idxal üçün — `marketplace-defaults.ts` server-only-dir.
 */

export const SUPPORTED_PLATFORMS = [
  "bolt_food",
  "wolt",
  "yango_deli",
  "tap_az",
  "progo",
  "birmarket",
  "umico",
  "amazon",
  "noon",
  "diger",
] as const;

export type Platform = (typeof SUPPORTED_PLATFORMS)[number];

export type PlatformDefaults = {
  komissiya_faiz: number;
  hesab_id: string | null;
  anbar_id: number | null;
};

export type MarketplaceDefaultsMap = Partial<Record<Platform, PlatformDefaults>>;
