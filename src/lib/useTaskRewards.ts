import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type TaskRewards = { telegramTaskReward: number; tiktokTaskReward: number };

// قيم احتياطية فقط لحين وصول الردّ؛ القيمة الفعلية يحددها الخادم من لوحة الإدارة.
const FALLBACK: TaskRewards = { telegramTaskReward: 0.003, tiktokTaskReward: 0.01 };

let cached: TaskRewards | null = null;

export function formatTaskReward(value: number) {
  return `$${Number(Number(value).toFixed(6))}`;
}

export function useTaskRewards(): TaskRewards {
  const [rewards, setRewards] = useState<TaskRewards>(cached ?? FALLBACK);
  useEffect(() => {
    let alive = true;
    apiGet<TaskRewards>('settings/rewards')
      .then((value) => {
        cached = { telegramTaskReward: Number(value.telegramTaskReward), tiktokTaskReward: Number(value.tiktokTaskReward) };
        if (alive) setRewards(cached);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return rewards;
}
