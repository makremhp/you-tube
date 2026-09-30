import { useEffect, useState, type ChangeEvent } from 'react';
import { Target, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import type { PromotionCampaign, PromotionPlatform, TaskProof } from '@/legacy/shared';

export function PlatformTasksPage({
  platform,
  campaigns,
  proofs,
  onSubmitProof,
}: {
  platform: PromotionPlatform;
  campaigns: PromotionCampaign[];
  proofs: TaskProof[];
  onSubmitProof: (campaignId: string, image: string) => void;
}) {
  const { dir } = useLanguage();
  const isTelegram = platform === 'telegram';
  const activeCampaigns = campaigns.filter((campaign) => campaign.platform === platform && campaign.status === 'نشط');
  const demoTasks: PromotionCampaign[] = isTelegram
    ? [
        { id: 'demo-telegram-1', platform, title: 'قناة أخبار التقنية العربية', link: 'https://t.me/telegram', targetCount: 100, price: 0.7, status: 'نشط', created: 'مثال' },
        { id: 'demo-telegram-2', platform, title: 'مجتمع المبدعين الرقميين', link: 'https://t.me/telegram', targetCount: 100, price: 0.7, status: 'نشط', created: 'مثال' },
      ]
    : [
        { id: 'demo-tiktok-1', platform, title: 'اكتشف حساب صناع المحتوى', link: 'https://www.tiktok.com/@tiktok', targetCount: 100, price: 2, status: 'نشط', created: 'مثال' },
        { id: 'demo-tiktok-2', platform, title: 'تابع أحدث المقاطع القصيرة', link: 'https://www.tiktok.com/@tiktok', targetCount: 100, price: 2, status: 'نشط', created: 'مثال' },
      ];
  const tasks = activeCampaigns.length ? activeCampaigns : demoTasks;
  const [joiningId, setJoiningId] = useState('');
  const [returnedIds, setReturnedIds] = useState<Record<string, boolean>>({});
  const [proofImages, setProofImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!joiningId) return;
    const markReturned = () => {
      if (document.visibilityState !== 'visible') return;
      setReturnedIds((current) => ({ ...current, [joiningId]: true }));
      setJoiningId('');
    };
    window.addEventListener('focus', markReturned);
    document.addEventListener('visibilitychange', markReturned);
    return () => {
      window.removeEventListener('focus', markReturned);
      document.removeEventListener('visibilitychange', markReturned);
    };
  }, [joiningId]);

  const handleProofImage = (taskId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2_000_000) {
      window.alert('حجم الإثبات يجب أن يكون أقل من 2 ميغابايت.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProofImages((current) => ({ ...current, [taskId]: String(reader.result ?? '') }));
    reader.readAsDataURL(file);
  };

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <div className="mb-7">
        <div className="text-xs font-semibold text-[#1557ee]">مساحة الربح / {isTelegram ? 'Telegram' : 'TikTok'}</div>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#12234b]">{isTelegram ? 'مهام Telegram' : 'مهام TikTok'}</h1>
        <p className="mt-2 text-sm text-slate-500">{isTelegram ? 'انضم إلى القناة ثم أرسل طلب تحقق يدوي.' : 'تابع الحساب وأرفق صورة إثبات؛ تبقى المهمة قيد المراجعة.'}</p>
      </div>
      {!activeCampaigns.length && <div className="mb-5 rounded-xl border border-blue-100 bg-[#f4f8ff] px-4 py-3 text-[11px] leading-5 text-slate-600">المعروض أدناه أمثلة توضيحية للمهام. الحملات التي تنشئها ستظهر هنا بعد تفعيلها.</div>}
      {isTelegram && campaigns.some((campaign) => campaign.platform === 'telegram' && campaign.status !== 'نشط') && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900">توجد حملة Telegram بانتظار التحقق من إعداد البوت؛ لا تُعرض كمهمة نشطة قبل تأكيد الصلاحيات من جهة موثوقة.</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {tasks.map((task) => {
          const proof = proofs.find((item) => item.campaignId === task.id);
          return (
            <article key={task.id} data-testid={`task-${platform}-${task.id}`} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 shadow-[var(--shadow-soft)]">
              <div className="flex gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]">{isTelegram ? <Users className="h-5 w-5" /> : <Target className="h-5 w-5" />}</div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-bold text-[#12234b]">{task.title}</h2>
                  <a href={task.link} target="_blank" rel="noreferrer" dir="ltr" className="mt-1 block truncate text-left text-[10px] text-slate-400">{task.link}</a>
                </div>
                <span className="shrink-0 rounded-full bg-[#eafbf8] px-2.5 py-1 text-[10px] font-bold text-[#159b89]">{isTelegram ? '$0.02' : '$0.01'}</span>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                {isTelegram ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" data-testid={`button-join-${task.id}`} onClick={() => { window.open(task.link, '_blank', 'noopener,noreferrer'); setJoiningId(task.id); }} variant="primary" size="sm" className="text-xs font-bold">انضم إلى القناة</Button>
                    {returnedIds[task.id] && <Button type="button" data-testid={`button-verify-${task.id}`} onClick={() => setReturnedIds((current) => ({ ...current, [task.id]: false }))} variant="secondary" size="sm" className="text-xs font-bold">أرسل للتحقق اليدوي</Button>}
                    {returnedIds[task.id] === false && <span role="status" className="text-[10px] font-bold text-amber-700">بانتظار مراجعة العضوية يدويًا</span>}
                    <p className="w-full text-[10px] leading-5 text-slate-400">العودة من القناة لا تؤكد الاشتراك تلقائيًا؛ يلزم التحقق اليدوي.</p>
                  </div>
                ) : proof ? (
                  <div className="flex items-center gap-3">
                    <img src={proof.image} alt="إثبات المتابعة" className="h-12 w-16 rounded-lg object-cover" />
                    <div><p className="text-xs font-bold text-[#2456b8]">قيد المراجعة</p><p className="mt-1 text-[10px] text-slate-400">أُرسل الإثبات للمراجعة اليدوية.</p></div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Button type="button" data-testid={`button-open-${task.id}`} onClick={() => window.open(task.link, '_blank', 'noopener,noreferrer')} variant="primary" size="sm" className="w-fit text-xs font-bold">فتح حساب TikTok</Button>
                    <label className="block text-[10px] font-bold text-slate-600">أرفق صورة تثبت المتابعة
                      <input type="file" data-testid={`input-proof-${task.id}`} accept="image/*" onChange={(event) => handleProofImage(task.id, event)} className="mt-2 block w-full text-[10px] text-slate-500 file:ml-3 file:rounded-lg file:border-0 file:bg-[#edf3ff] file:px-3 file:py-2 file:text-[10px] file:font-bold file:text-[#1557ee]" />
                    </label>
                    {proofImages[task.id] && <img src={proofImages[task.id]} alt="معاينة صورة الإثبات" className="h-32 w-full rounded-xl object-cover" />}
                    <Button type="button" data-testid={`button-submit-proof-${task.id}`} disabled={!proofImages[task.id]} onClick={() => onSubmitProof(task.id, proofImages[task.id])} variant="secondary" size="sm" className="w-fit text-xs font-bold disabled:opacity-50">إرسال الإثبات للمراجعة</Button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
