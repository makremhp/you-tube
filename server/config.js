const DEFAULT_YOUTUBE_PRICING = { 10: 1.5, 20: 2, 40: 2.8, 80: 3.2 };
const YOUTUBE_DURATIONS = new Set([10, 20, 40, 80]);

function readYoutubePricing() {
  try {
    const value = JSON.parse(process.env.YOUTUBE_PRICING ?? 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_YOUTUBE_PRICING;

    const pricing = Object.fromEntries(
      Object.entries(value)
        .map(([duration, cpm]) => [Number(duration), Number(cpm)])
        .filter(([duration, cpm]) => YOUTUBE_DURATIONS.has(duration) && Number.isFinite(cpm) && cpm >= 0.01 && cpm <= 1000),
    );
    return Object.keys(pricing).length ? pricing : DEFAULT_YOUTUBE_PRICING;
  } catch {
    return DEFAULT_YOUTUBE_PRICING;
  }
}

export function getYoutubeSettings() {
  const cpmOptions = readYoutubePricing();
  const configuredDefault = Number(process.env.YOUTUBE_DEFAULT_CPM ?? 1.5);
  const defaultCPM = Number.isFinite(configuredDefault) && Object.values(cpmOptions).includes(configuredDefault)
    ? configuredDefault
    : Number(Object.values(cpmOptions)[0] ?? 1.5);
  const viewerShare = Number(process.env.YOUTUBE_VIEWER_SHARE ?? 30);
  const platformShare = Number(process.env.YOUTUBE_PLATFORM_SHARE ?? 70);
  const minimumViews = Number(process.env.YOUTUBE_MINIMUM_VIEWS ?? 1000);

  if (
    !Number.isFinite(viewerShare) || viewerShare < 0 || viewerShare > 100
    || !Number.isFinite(platformShare) || platformShare < 0 || platformShare > 100
    || Math.abs(viewerShare + platformShare - 100) > 0.000001
    || !Number.isSafeInteger(minimumViews) || minimumViews < 1
  ) {
    throw new Error('Invalid YouTube campaign settings');
  }

  return { defaultCPM, viewerShare, platformShare, minimumViews, cpmOptions };
}

export const TELEGRAM_TASK_REWARD = Number(process.env.TELEGRAM_TASK_REWARD ?? 0.003);
export const TELEGRAM_RETENTION_DAYS = 3;
export const TIKTOK_TASK_REWARD = Number(process.env.TIKTOK_TASK_REWARD ?? 0.01);
export const AD_REWARD = Number(process.env.AD_REWARD ?? 0.0001);
export const AD_DAILY_LIMIT = Number(process.env.AD_DAILY_LIMIT ?? 100);
export const MONETAG_AD_REWARD = 0.0001;
export const MONETAG_AD_DAILY_LIMIT = 500;
export const AD_MIN_INTERVAL_SECONDS = Number(process.env.AD_MIN_INTERVAL_SECONDS ?? 30);
export const DEFAULT_WITHDRAWAL_SETTINGS = Object.freeze({
  binanceWithdrawMin: 1,
  web3WithdrawMin: 1,
});
export const MIN_WATCH_TOLERANCE = 0.95;
export const MAX_REQUESTED_VIEWS = 100_000_000;

export function normalizeWithdrawalSettings(value) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_WITHDRAWAL_SETTINGS };

  const normalized = { ...DEFAULT_WITHDRAWAL_SETTINGS };
  for (const key of Object.keys(normalized)) {
    const amount = Number(parsed[key]);
    if (Number.isFinite(amount) && amount > 0 && amount <= 100000) {
      normalized[key] = Number(amount.toFixed(6));
    }
  }
  return normalized;
}

export function roundMoney(value, places = 6) {
  return Number(Number(value).toFixed(places));
}

export function viewerReward(cpm) {
  const { viewerShare } = getYoutubeSettings();
  return roundMoney((Number(cpm) / 1000) * (viewerShare / 100), 6);
}
