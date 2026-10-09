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

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: string };

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) headers['x-telegram-init-data'] = initData;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${import.meta.env.BASE_URL}api/${path.replace(/^\/+/, '')}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = await response.json() as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }
  if (!response.ok || !envelope || !envelope.success) {
    throw new ApiError(response.status, envelope && !envelope.success ? envelope.error : 'Request failed');
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
  viewerShare?: number | null;
  platformShare?: number | null;
  viewerRewardPerView?: number | null;
  platformRevenuePerView?: number | null;
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
