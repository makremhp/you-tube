import { sql } from './db.js';
import {
  AD_DAILY_LIMIT, AD_REWARD, MONETAG_AD_DAILY_LIMIT, MONETAG_AD_REWARD,
  TELEGRAM_TASK_REWARD, TIKTOK_TASK_REWARD,
} from './config.js';

/*
 * إعدادات تُدار من لوحة الإدارة وتُحفظ في vr_platform_settings.
 * الخادم هو المرجع الوحيد: الحد اليومي والمكافأة يُقرآن من هنا عند كل طلب.
 */

export const DEFAULT_AD_SETTINGS = Object.freeze({
  monetagDailyLimit: MONETAG_AD_DAILY_LIMIT,
  monetagReward: MONETAG_AD_REWARD,
  adsteraDailyLimit: AD_DAILY_LIMIT,
  adsteraReward: AD_REWARD,
});

export const DEFAULT_TASK_REWARD_SETTINGS = Object.freeze({
  telegramTaskReward: TELEGRAM_TASK_REWARD,
  tiktokTaskReward: TIKTOK_TASK_REWARD,
});

function parseValue(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function readLimit(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= 1_000_000 ? number : fallback;
}

function readReward(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0.000001 && number <= 1000 ? Number(number.toFixed(6)) : fallback;
}

export function normalizeAdSettings(value) {
  const parsed = parseValue(value);
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return {
    monetagDailyLimit: readLimit(source.monetagDailyLimit, DEFAULT_AD_SETTINGS.monetagDailyLimit),
    monetagReward: readReward(source.monetagReward, DEFAULT_AD_SETTINGS.monetagReward),
    adsteraDailyLimit: readLimit(source.adsteraDailyLimit, DEFAULT_AD_SETTINGS.adsteraDailyLimit),
    adsteraReward: readReward(source.adsteraReward, DEFAULT_AD_SETTINGS.adsteraReward),
  };
}

export function normalizeTaskRewardSettings(value) {
  const parsed = parseValue(value);
  const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return {
    telegramTaskReward: readReward(source.telegramTaskReward, DEFAULT_TASK_REWARD_SETTINGS.telegramTaskReward),
    tiktokTaskReward: readReward(source.tiktokTaskReward, DEFAULT_TASK_REWARD_SETTINGS.tiktokTaskReward),
  };
}

export async function getAdSettings() {
  const rows = await sql.query(`SELECT value::text AS settings FROM vr_platform_settings WHERE key = 'ads'`);
  return normalizeAdSettings(rows[0]?.settings);
}

export async function getTaskRewardSettings() {
  const rows = await sql.query(`SELECT value::text AS settings FROM vr_platform_settings WHERE key = 'task_rewards'`);
  return normalizeTaskRewardSettings(rows[0]?.settings);
}

/* حدّ المزوّد ومكافأته: provider = 'monetag' | 'adstera' */
export function providerAdConfig(settings, provider) {
  return provider === 'monetag'
    ? { limit: settings.monetagDailyLimit, reward: settings.monetagReward }
    : { limit: settings.adsteraDailyLimit, reward: settings.adsteraReward };
}
