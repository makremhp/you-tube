import { useCallback, useEffect, useState } from 'react';

export type AdsteraFormat = 'social' | '320x50';

export type AdsteraAd = {
  id: string;
  name: string;
  format: AdsteraFormat;
  code: string;
  enabled: boolean;
  updatedAt: string;
  builtIn: boolean;
};

const STORAGE_KEY = 'vidreward.adstera.codes.v1';
const LEGACY_ADMIN_KEY = 'vidreward.admin.preview.v1';
const CHANGE_EVENT = 'vidreward:adstera-codes-changed';

const banners = [
  { key: 'b895987c82805b8778a34f54911e8de0', src: 'https://interventioncopiedloitering.com/b895987c82805b8778a34f54911e8de0/invoke.js' },
  { key: 'ab4615d3d759a81e9b876abbcebaf690', src: 'https://interventioncopiedloitering.com/ab4615d3d759a81e9b876abbcebaf690/invoke.js' },
  { key: '3b49398bb9242d548c0464f244b621fa', src: 'https://interventioncopiedloitering.com/3b49398bb9242d548c0464f244b621fa/invoke.js' },
  { key: 'b3570e82f7fb6c462dfdfded816f1576', src: 'https://interventioncopiedloitering.com/b3570e82f7fb6c462dfdfded816f1576/invoke.js' },
  { key: 'de29a44d70992e967ae5d20275e77fab', src: 'https://interventioncopiedloitering.com/de29a44d70992e967ae5d20275e77fab/invoke.js' },
  { key: '280eab7c354ed87595a376b2f5e270cb', src: 'https://interventioncopiedloitering.com/280eab7c354ed87595a376b2f5e270cb/invoke.js' },
  { key: 'd47f719464108005a03a03e6d49fba1a', src: 'https://interventioncopiedloitering.com/d47f719464108005a03a03e6d49fba1a/invoke.js' },
  { key: '04bcf6532017b6790ab2ddac95a5621d', src: 'https://interventioncopiedloitering.com/04bcf6532017b6790ab2ddac95a5621d/invoke.js' },
  { key: '8c0574e870e5a3843e89d947bd38aaff', src: 'https://interventioncopiedloitering.com/8c0574e870e5a3843e89d947bd38aaff/invoke.js' },
  { key: '9f6fe4084cb3d8a8eb4d8246ee57ed25', src: 'https://interventioncopiedloitering.com/9f6fe4084cb3d8a8eb4d8246ee57ed25/invoke.js' },
] as const;

const socialScripts = [
  'https://interventioncopiedloitering.com/5d/77/0f/5d770ff402768d79ddda9c1cd67e9819.js',
  'https://interventioncopiedloitering.com/96/90/da/9690da690d344e2579dffa12d4e2ac24.js',
  'https://interventioncopiedloitering.com/f0/07/9c/f0079c7c7d8c3c01bd28c4116a805f4a.js',
  'https://interventioncopiedloitering.com/7e/7f/2b/7e7f2b6f7c43d86c6859e5b0a40afe3e.js',
  'https://interventioncopiedloitering.com/7e/28/55/7e2855c2f9fb53ed0ca536022ca067df.js',
  'https://interventioncopiedloitering.com/d0/f6/b3/d0f6b318f29b5787025697029ae72f23.js',
  'https://interventioncopiedloitering.com/58/0d/ca/580dcaa1a10c7fb3943a7ea94b700f42.js',
  'https://interventioncopiedloitering.com/da/5e/c3/da5ec3a230bfa740492f3f78bd1ed182.js',
] as const;

function makeDefaults(): AdsteraAd[] {
  const defaultDate = new Date().toISOString().slice(0, 10);
  return [
    ...banners.map((banner, index): AdsteraAd => {
      const options = {
        key: banner.key,
        format: 'iframe',
        height: 50,
        width: 320,
        params: {},
      };
      return {
        id: `adstera-banner-${String(index + 1).padStart(2, '0')}`,
        name: `Banner 320 × 50 · ${String(index + 1).padStart(2, '0')}`,
        format: '320x50',
        code: `<script>window.atOptions=${JSON.stringify(options)};</script>\n<script src="${banner.src}"></script>`,
        enabled: true,
        updatedAt: defaultDate,
        builtIn: true,
      };
    }),
    ...socialScripts.map((src, index): AdsteraAd => ({
      id: `adstera-social-${String(index + 1).padStart(2, '0')}`,
      name: `Social · ${String(index + 1).padStart(2, '0')}`,
      format: 'social',
      code: `<script async src="${src}"></script>`,
      enabled: true,
      updatedAt: defaultDate,
      builtIn: true,
    })),
  ];
}

function isAdsteraAd(value: unknown): value is AdsteraAd {
  if (!value || typeof value !== 'object') return false;
  const ad = value as Partial<AdsteraAd>;
  return typeof ad.id === 'string'
    && typeof ad.name === 'string'
    && (ad.format === 'social' || ad.format === '320x50')
    && typeof ad.code === 'string'
    && typeof ad.enabled === 'boolean';
}

function readLegacyCustomAds(): AdsteraAd[] {
  try {
    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_ADMIN_KEY) ?? 'null') as {
      ads?: Array<Record<string, unknown>>;
    } | null;
    return (legacy?.ads ?? [])
      .filter((item) => {
        const code = typeof item.code === 'string' ? item.code : '';
        return item.id !== 'AD-01'
          && item.id !== 'AD-02'
          && code.trim().length > 0
          && !code.includes('Social placement')
          && !code.includes('320 × 50 banner');
      })
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `legacy-ad-${index + 1}`,
        name: typeof item.name === 'string' ? item.name : `Adstera code ${index + 1}`,
        format: item.format === '320x50' ? '320x50' : 'social',
        code: String(item.code),
        enabled: Boolean(item.enabled),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
        builtIn: false,
      }));
  } catch {
    return [];
  }
}

export function getAdsteraAds(): AdsteraAd[] {
  const defaults = makeDefaults();
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as unknown;
    if (!Array.isArray(saved)) return [...defaults, ...readLegacyCustomAds()];

    const storedById = new Map(
      saved.filter(isAdsteraAd).map((ad) => [ad.id, ad]),
    );
    const knownIds = new Set(defaults.map((ad) => ad.id));
    const restoredDefaults = defaults.map((ad) => ({
      ...ad,
      ...storedById.get(ad.id),
      builtIn: true,
    }));
    const customAds = saved.filter(
      (value): value is AdsteraAd => isAdsteraAd(value) && !knownIds.has(value.id),
    );
    return [...restoredDefaults, ...customAds];
  } catch {
    return [...defaults, ...readLegacyCustomAds()];
  }
}

export function saveAdsteraAds(ads: AdsteraAd[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ads));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function buildAdsteraDocument(ad: AdsteraAd): string {
  const size = ad.format === '320x50'
    ? 'width:320px;height:50px;'
    : 'width:320px;height:80px;';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html, body { margin: 0; width: 100%; min-height: 100%; overflow: hidden; background: transparent; }
      body { ${size} max-width: 100vw; }
      img, iframe { max-width: 100%; }
    </style>
  </head>
  <body>${ad.code}</body>
</html>`;
}

export function useAdsteraAds() {
  const [ads, setAds] = useState<AdsteraAd[]>(getAdsteraAds);
  const refresh = useCallback(() => setAds(getAdsteraAds()), []);

  useEffect(() => {
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const save = useCallback((next: AdsteraAd[]) => {
    saveAdsteraAds(next);
    setAds(next);
  }, []);

  return { ads, save };
}