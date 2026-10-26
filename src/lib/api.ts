import {
  calculateViewerReward,
  formatHistoryDate,
  formatUsd,
  type DepositRecord,
  type PromotionCampaign,
  type TaskProof,
  type TransactionStatus,
  type Video,
  type WithdrawRecord,
} from '@/legacy/shared';
import { getClientSignals } from '@/lib/clientSignals';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const VPN_BLOCKED_EVENT = 'vr:vpn-blocked';
export const DEVICE_BLOCKED_EVENT = 'vr:device-blocked';
const REQUEST_TIMEOUT_MS = 30_000;

function isArabicUi() {
  try {
    const saved = window.localStorage.getItem('vidreward-language');
    if (saved === 'ar' || saved === 'en') return saved === 'ar';
  } catch {
    // fall through to the browser language
  }
  return (navigator.languages?.[0] || navigator.language || '').toLowerCase().startsWith('ar');
}

type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: string; code?: string };

const securityStorageFallback = new Map<string, string>();

function randomHex(byteCount: number) {
  const bytes = new Uint8Array(byteCount);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function readOrCreateSecurityValue(key: string, byteCount: number) {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved && /^[a-f0-9]{64}$/i.test(saved)) return saved;
  } catch {
    const saved = securityStorageFallback.get(key);
    if (saved) return saved;
  }

  const created = randomHex(byteCount);
  try {
    window.localStorage.setItem(key, created);
  } catch {
    securityStorageFallback.set(key, created);
  }
  return created;
}

function readSecurityValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return securityStorageFallback.get(key) ?? null;
  }
}

export async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = {};
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) headers['x-telegram-init-data'] = initData;
  headers['x-client-device-id'] = readOrCreateSecurityValue('vr-security-device-id', 32);
  const signals = await getClientSignals();
  if (/^[a-f0-9]{64}$/i.test(signals.fingerprint)) headers['x-device-fingerprint'] = signals.fingerprint;
  if (signals.timezone && signals.timezone.length <= 64) headers['x-client-timezone'] = signals.timezone;
  if (signals.webrtcIps) headers['x-client-webrtc-ips'] = signals.webrtcIps;
  const securitySessionId = readSecurityValue('vr-security-session-id');
  if (securitySessionId && /^[a-f0-9]{64}$/i.test(securitySessionId)) headers['x-security-session-id'] = securitySessionId;
  if (method !== 'GET') headers['x-request-nonce'] = randomHex(16);
  let savedLanguage: string | null = null;
  try {
    savedLanguage = window.localStorage.getItem('vidreward-language');
  } catch {
    // Browser language remains the fallback when storage is unavailable.
  }
  const browserLanguage = navigator.languages?.[0] || navigator.language || '';
  headers['x-app-language'] = savedLanguage === 'ar' || savedLanguage === 'en'
    ? savedLanguage
    : browserLanguage.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}api/${path.replace(/^\/+/, '')}`, {
      method,
      headers,
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    // انقطاع الاتصال أو انتهاء المهلة: رسالة مفهومة بدل خطأ المتصفح الخام، ولا يُعرض أي نجاح.
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    const arabic = isArabicUi();
    throw new ApiError(0, timedOut
      ? (arabic ? 'انتهت مهلة الطلب. تحقق من الاتصال ثم حاول مرة أخرى.' : 'The request timed out. Check your connection and try again.')
      : (arabic ? 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مرة أخرى.' : 'Could not reach the server. Check your internet connection and try again.'));
  } finally {
    window.clearTimeout(timer);
  }
  const returnedSessionId = response.headers.get('x-security-session-id');
  if (returnedSessionId && /^[a-f0-9]{64}$/i.test(returnedSessionId)) {
    try {
      window.localStorage.setItem('vr-security-session-id', returnedSessionId);
    } catch {
      securityStorageFallback.set('vr-security-session-id', returnedSessionId);
    }
  }
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = await response.json() as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }
  if (!response.ok || !envelope || !envelope.success) {
    const code = envelope && !envelope.success ? envelope.code : undefined;
    if (code === 'VPN_DETECTED') window.dispatchEvent(new Event(VPN_BLOCKED_EVENT));
    if (code === 'MULTI_ACCOUNT_DEVICE') window.dispatchEvent(new Event(DEVICE_BLOCKED_EVENT));
    throw new ApiError(response.status, envelope && !envelope.success ? envelope.error : 'Request failed', code);
  }
  return envelope.data;
}

export const apiGet = <T>(path: string) => apiRequest<T>('GET', path);
export const apiPost = <T>(path: string, body: unknown = {}, idempotencyKey?: string) => apiRequest<T>('POST', path, body, idempotencyKey);
export const apiPatch = <T>(path: string, body: unknown) => apiRequest<T>('PATCH', path, body);
export const apiDelete = <T>(path: string) => apiRequest<T>('DELETE', path);

export type YoutubeCampaignSettings = {
  defaultCPM: number;
  viewerShare: number;
  platformShare: number;
  minimumViews: number;
  cpmOptions: Record<number, number>;
};

export type ApiCampaignRow = {
  id: string;
  platform: 'youtube' | 'telegram' | 'tiktok';
  title: string;
  description?: string | null;
  creator?: string | null;
  link?: string | null;
  youtubeUrl?: string | null;
  thumbnail?: string | null;
  duration?: number | null;
  cpm?: number | null;
  reward?: number | null;
  price?: number | null;
  targetCount?: number | null;
  requestedViews?: number | null;
  campaignBudget?: number | null;
  country?: string | null;
  device?: string | null;
  status: string;
  views?: number | null;
  joinedCount?: number | null;
  completedCount?: number | null;
  createdAt: string;
  completed?: boolean | null;
};

export type ApiBalance = { advertiserBalance: number; viewerBalance: number };

type ApiHistoryRow = {
  id: string;
  amount: number;
  method: string;
  destination: string;
  memoTag: string;
  blockchainTxId?: string | null;
  status: string;
  createdAt: string;
};

type ApiProofRow = {
  campaignId: string;
  userId: number;
  image: string;
  status: TaskProof['status'];
  submittedAt: string;
};

const videoStatuses: Video['status'][] = ['نشط', 'مسودة', 'مكتمل', 'موقوف'];
const promotionStatuses: PromotionCampaign['status'][] = ['نشط', 'بانتظار تحقق البوت', 'موقوف'];
const transactionStatuses: TransactionStatus[] = ['تم', 'قيد المعالجة', 'تم الإلغاء', 'مرفوض'];

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

export function toVideo(row: ApiCampaignRow): Video {
  const cpm = Number(row.cpm ?? 0);
  return {
    id: Number(row.id),
    title: row.title,
    creator: row.creator ?? '',
    views: Number(row.views ?? 0).toLocaleString('en-US'),
    reward: formatUsd(row.reward ?? calculateViewerReward(cpm)),
    cpm,
    duration: Number(row.duration ?? 0),
    status: videoStatuses.includes(row.status as Video['status']) ? row.status as Video['status'] : 'نشط',
    created: formatCreatedAt(row.createdAt),
    art: 'media-art',
    link: row.youtubeUrl ?? row.link ?? '',
    requestedViews: Number(row.requestedViews ?? 0) || undefined,
    budget: Number(row.campaignBudget ?? row.price ?? 0) || undefined,
  };
}

export function toPromotion(row: ApiCampaignRow): PromotionCampaign {
  return {
    id: String(row.id),
    platform: row.platform === 'tiktok' ? 'tiktok' : 'telegram',
    title: row.title,
    link: row.link ?? '',
    image: row.thumbnail ?? undefined,
    targetCount: Number(row.targetCount ?? 0),
    price: Number(row.price ?? 0),
    status: promotionStatuses.includes(row.status as PromotionCampaign['status']) ? row.status as PromotionCampaign['status'] : 'نشط',
    joinedCount: Number(row.joinedCount ?? 0),
    completedCount: Number(row.completedCount ?? 0),
    created: formatCreatedAt(row.createdAt),
  };
}

function toHistoryStatus(status: string): TransactionStatus {
  return transactionStatuses.includes(status as TransactionStatus) ? status as TransactionStatus : 'قيد المعالجة';
}

export function toDepositRecord(row: ApiHistoryRow, language: 'ar' | 'en'): DepositRecord {
  return {
    id: row.id,
    amount: Number(row.amount),
    method: row.method === 'stars' ? 'stars' : 'web3',
    destination: row.destination,
    memoTag: row.memoTag,
    blockchainTxId: row.blockchainTxId ?? undefined,
    createdAt: formatHistoryDate(new Date(row.createdAt), language),
    status: toHistoryStatus(row.status),
  };
}

export function toWithdrawRecord(row: ApiHistoryRow, language: 'ar' | 'en'): WithdrawRecord {
  return {
    id: row.id,
    amount: Number(row.amount),
    method: row.method === 'binance' ? 'binance' : 'web3',
    destination: row.destination,
    memoTag: row.memoTag,
    blockchainTxId: row.blockchainTxId ?? undefined,
    createdAt: formatHistoryDate(new Date(row.createdAt), language),
    status: toHistoryStatus(row.status),
  };
}

export function toTaskProof(row: ApiProofRow): TaskProof {
  return {
    campaignId: String(row.campaignId),
    userId: Number(row.userId),
    image: row.image,
    status: row.status,
    submittedAt: row.submittedAt,
  };
}

export type ApiHistoryRecordRow = ApiHistoryRow;
export type ApiProofRecordRow = ApiProofRow;
