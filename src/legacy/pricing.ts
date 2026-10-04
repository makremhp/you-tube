import { useEffect, useState } from 'react';

export type PricingPlatform = 'youtube' | 'tiktok' | 'telegram';
export type PricingTier = { value: number; price: number };
export type LocalPricing = Record<PricingPlatform, PricingTier[]>;

export const PRICING_KEY = 'vidreward.pricing.local.v1';
export const DEFAULT_PRICING: LocalPricing = {
  youtube: [
    { value: 10, price: 1.5 },
    { value: 20, price: 2 },
    { value: 40, price: 2.8 },
    { value: 80, price: 3.2 },
  ],
  tiktok: [
    { value: 100, price: 2 },
    { value: 200, price: 3.9 },
    { value: 350, price: 5.5 },
    { value: 500, price: 7 },
  ],
  telegram: [
    { value: 100, price: 0.7 },
    { value: 300, price: 1.9 },
    { value: 500, price: 2.6 },
    { value: 700, price: 3 },
  ],
};

export function readLocalPricing(): LocalPricing {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRICING_KEY) ?? 'null') as Partial<LocalPricing> | null;
    if (!parsed) return DEFAULT_PRICING;
    return Object.fromEntries((Object.keys(DEFAULT_PRICING) as PricingPlatform[]).map((platform) => {
      const saved = parsed[platform];
      const defaults = DEFAULT_PRICING[platform];
      const tiers = defaults.map((fallback, index) => {
        const tier = saved?.[index];
        return {
          value: Number.isFinite(Number(tier?.value)) && Number(tier?.value) > 0 ? Number(tier?.value) : fallback.value,
          price: Number.isFinite(Number(tier?.price)) && Number(tier?.price) >= 0 ? Number(tier?.price) : fallback.price,
        };
      });
      return [platform, tiers];
    })) as LocalPricing;
  } catch {
    return DEFAULT_PRICING;
  }
}

export function saveLocalPricing(pricing: LocalPricing) {
  try {
    window.localStorage.setItem(PRICING_KEY, JSON.stringify(pricing));
    window.dispatchEvent(new CustomEvent('vidreward:pricing-updated'));
  } catch {
    // Keep the interface usable when browser storage is unavailable.
  }
}

export function useLocalPricing() {
  const [pricing, setPricing] = useState<LocalPricing>(readLocalPricing);
  useEffect(() => {
    const sync = () => setPricing(readLocalPricing());
    window.addEventListener('storage', sync);
    window.addEventListener('vidreward:pricing-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('vidreward:pricing-updated', sync);
    };
  }, []);
  return pricing;
}