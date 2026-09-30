import { BarChart3, DollarSign, Eye, Plus, Sparkles, Target, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import {
  getGreetingName, StatCard, WalletArtwork,
  type PromotionCampaign, type TelegramUser,
} from '@/legacy/shared';

export function CreatorOverview({
  advertiserBalance,
  telegramUser,
  platformCampaigns,
  onAdd,
  onDeposit,
}: {
  advertiserBalance: number;
  telegramUser: TelegramUser | null;
  platformCampaigns: PromotionCampaign[];
  onAdd: () => void;
  onDeposit: () => void;
}) {
  const { dir, t, isArabic } = useLanguage();
  const telegramGoal = platformCampaigns.filter((campaign) => campaign.platform === 'telegram').reduce((total, campaign) => total + campaign.targetCount, 0);
  const tiktokGoal = platformCampaigns.filter((campaign) => campaign.platform === 'tiktok').reduce((total, campaign) => total + campaign.targetCount, 0);
  return (
    <main className="mx-auto w-full max-w-[1370px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <section className="animate-rise flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#1557ee]"><span className="h-1.5 w-1.5 rounded-full bg-[#23bdc9]" /> {t('الأربعاء، ٢٣ سبتمبر ٢٠٢٦')}</div>
          <h1 data-testid="text-greeting-overview" className="creator-greeting flex items-baseline gap-2 whitespace-nowrap font-display text-[25px] font-bold leading-tight tracking-[-.04em] text-[#12234b] sm:text-[29px] md:text-[36px]">
            <span>{t('صباح الخير')}{' '}</span>
            <span className="text-[#1557ee]">{getGreetingName(telegramUser)}..</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">{t('ملخص أداء حملاتك ورصيدك في مكان واحد.')}</p>
        </div>
        <Button type="button" data-testid="button-add-video-main" onClick={onAdd} variant="primary" size="lg" className="flex items-center justify-center gap-2 text-sm font-bold">
          <Plus className="h-4 w-4" /> {t('أضف إعلان جديد')}
        </Button>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="animate-rise"><StatCard icon={Eye} label={t('إجمالي المشاهدات')} value="27,584" change="12.8%" tone="blue" /></div>
        <div className="animate-rise delay-1"><StatCard icon={DollarSign} label={t('إجمالي الإنفاق')} value="$124.80" change="8.4%" tone="cyan" /></div>
        <div className="animate-rise delay-2"><StatCard icon={Users} label={t('مشاهدون جدد')} value="1,892" change="18.2%" tone="navy" /></div>
        <div className="animate-rise delay-3"><StatCard icon={TrendingUp} label={t('متوسط الإكمال')} value="76.4%" change="4.6%" tone="sand" /></div>
      </section>
      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="animate-rise"><StatCard icon={Users} label="هدف مشتركي Telegram" value={telegramGoal.toLocaleString(isArabic ? 'ar' : 'en-US')} change={`${platformCampaigns.filter((campaign) => campaign.platform === 'telegram').length} حملات`} tone="cyan" /></div>
        <div className="animate-rise delay-1"><StatCard icon={Target} label="هدف متابعي TikTok" value={tiktokGoal.toLocaleString(isArabic ? 'ar' : 'en-US')} change={`${platformCampaigns.filter((campaign) => campaign.platform === 'tiktok').length} حملات`} tone="navy" /></div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-[1.1fr_.9fr]">
        <div className="relative overflow-hidden rounded-[22px] border border-blue-100 bg-[#eff4ff] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500">{t('رصيد الإعلانات')}</div>
              <div className="mt-1 text-3xl font-bold tracking-tight text-[#12234b]">${advertiserBalance.toFixed(2)}</div>
              <div className="mt-2 text-[11px] text-slate-400">{t('متاح لتمويل الحملات القادمة')}</div>
            </div>
            <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-white/80 shadow-sm">
              <WalletArtwork method="balance" size="md" className="h-14 w-14" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/80 bg-white/60 px-3 py-2">
            <WalletArtwork method="web3" size="xs" />
            <span className="text-[10px] font-bold text-slate-600">{t('جاهز للتحويل عبر Web3 · Polygon')}</span>
          </div>
          <Button type="button" data-testid="button-overview-deposit" onClick={onDeposit} variant="secondary" size="sm" className="mt-6 flex items-center gap-2 bg-white text-xs font-bold text-[#1557ee]">
            <Plus className="h-4 w-4" /> {t('إيداع رصيد جديد')}
          </Button>
        </div>
        <div className="rounded-[22px] bg-[#0e2452] p-6 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)]">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-100">{t('أداء هذا الشهر')}</span><BarChart3 className="h-5 w-5 text-cyan-300" /></div>
          <div className="mt-6 flex items-end justify-between">
            <div><div className="text-3xl font-bold">9,428</div><div className="mt-1 text-[11px] text-blue-100/60">{t('إكمالات الفيديو')}</div></div>
            <div className="text-left"><div className="text-xl font-bold text-cyan-300">+14.8%</div><div className="mt-1 text-[10px] text-blue-100/60">{t('مقارنة بالأسبوع الماضي')}</div></div>
          </div>
          <div className="mt-7 flex h-16 items-end gap-2 border-b border-white/10">
            {[32, 46, 40, 64, 55, 74, 67, 86, 77, 96, 87, 100].map((height, i) => <div key={i} className="flex h-full flex-1 items-end"><div className={`w-full rounded-t-sm ${i === 11 ? 'bg-cyan-300' : 'bg-blue-300/30'}`} style={{ height: `${height}%` }} /></div>)}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-4"><div className="min-w-0"><h2 className="font-display text-lg font-bold text-[#12234b]">{t('خطواتك التالية')}</h2><p className="mt-1 text-xs text-slate-400">{t('أكمل هذه الخطوات لتحصل على أفضل نتيجة.')}</p></div><Sparkles className="h-5 w-5 shrink-0 text-[#1557ee]" /></div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {([
            { number: '01', title: t('أضف إعلانك الأول'), description: t('شارك فيديو يستحق وقت المشاهدين.'), action: onAdd },
            { number: '02', title: t('موّل حملتك'), description: t('أنشئ فاتورة إيداع آمنة عبر Stars أو Web3.'), action: onDeposit },
            { number: '03', title: t('راجع الأداء'), description: t('تابع المشاهدات والإكمالات من صفحة الإعلانات.') },
          ] as Array<{ number: string; title: string; description: string; action?: () => void }>).map(({ number, title, description, action }) => (
            <Button type="button" key={number} onClick={typeof action === 'function' ? action : undefined} variant="unstyled" size="fit" dir={dir} className={`flex w-full min-w-0 items-start gap-3 whitespace-normal overflow-hidden rounded-2xl border border-slate-100 bg-[#fbfcff] p-4 transition hover:border-blue-100 hover:bg-[#f4f8ff] ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf3ff] text-[10px] font-bold text-[#1557ee]">{number}</span>
              <span className={`min-w-0 flex-1 overflow-hidden ${dir === 'rtl' ? 'text-right' : 'text-left'}`}><span className="block break-words text-xs font-bold leading-5 text-[#12234b]">{title}</span><span className="mt-1 block break-words text-[11px] leading-5 text-slate-400">{description}</span></span>
            </Button>
          ))}
        </div>
      </section>
    </main>
  );
}

