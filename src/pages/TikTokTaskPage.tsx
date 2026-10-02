import { useState, type ChangeEvent } from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock3, ImageIcon, ImagePlus, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import type { PromotionCampaign, TaskProof } from '@/legacy/shared';

export function TikTokTaskPage({
  campaign,
  proof,
  onSubmitProof,
  onBack,
}: {
  campaign: PromotionCampaign;
  proof?: TaskProof;
  onSubmitProof: (campaignId: string, image: string) => void;
  onBack: () => void;
}) {
  const { dir, t } = useLanguage();
  const [proofImage, setProofImage] = useState('');

  const handleProofImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('اختر ملف صورة صالحًا لإثبات المهمة.');
      event.target.value = '';
      return;
    }
    if (file.size > 2_000_000) {
      window.alert('حجم الإثبات يجب أن يكون أقل من 2 ميغابايت.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProofImage(String(reader.result ?? ''));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 pb-28 pt-6 md:px-8 md:pt-9 lg:px-10 lg:pb-12" dir={dir}>
      <Button
        type="button"
        data-testid="button-back-tiktok-tasks"
        onClick={onBack}
        variant="unstyled"
        size="fit"
        className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-[#1557ee] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1557ee]"
      >
        <ArrowRight className="h-4 w-4" />
        {t('العودة إلى مهام TikTok')}
      </Button>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]">
        <div className="p-5 sm:p-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-[#f2f5f8] sm:h-[72px] sm:w-[72px]">
              {campaign.image
                ? <img src={campaign.image} alt={`صورة حملة ${campaign.title}`} className="h-full w-full object-cover" />
                : <ImageIcon aria-hidden="true" className="h-6 w-6 text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">TikTok</span>
                <span className="rounded-full bg-[#eafbf8] px-2.5 py-1 text-[10px] font-bold text-[#159b89]">متابعة</span>
              </div>
              <h1 className="break-words text-lg font-bold leading-7 text-[#12234b] sm:text-xl">{campaign.title}</h1>
              <p className="mt-1 text-xs text-slate-500">{campaign.targetCount.toLocaleString()} متابع مستهدف · $0.01 لكل متابعة</p>
            </div>
          </div>
          <a
            href={campaign.link}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="mt-5 block truncate rounded-xl bg-slate-50 px-3 py-2.5 text-left text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-[#1557ee]"
          >
            {campaign.link}
          </a>
        </div>

        <div className="border-t border-slate-100 bg-[#fbfcff] p-4 sm:p-6">
          {proof ? (
            <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white p-3 sm:p-4" role="status">
              <img src={proof.image} alt="إثبات المتابعة" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-bold text-[#2456b8]"><Clock3 className="h-4 w-4" /> قيد المراجعة</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">وصل الإثبات، وسيُراجع قبل اعتماد المكافأة.</p>
              </div>
              <CheckCircle2 className="mr-auto h-5 w-5 shrink-0 text-[#159b89]" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  data-testid={`button-open-${campaign.id}`}
                  onClick={() => window.open(campaign.link, '_blank', 'noopener,noreferrer')}
                  variant="secondary"
                  size="sm"
                  className="min-h-12 justify-center gap-2 rounded-xl border-[#1c2228] bg-[#1c2228] text-sm font-bold text-white shadow-[0_4px_10px_rgba(17,24,39,.12)] transition hover:border-[#343c44] hover:bg-[#343c44] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1557ee]"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  {t('افتح حساب TikTok')}
                </Button>
                <div className="flex items-start gap-3 rounded-xl bg-white p-4 text-xs leading-6 text-slate-500">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 font-bold text-slate-600">1</span>
                  <span>تابع الحساب، ثم التقط صورة تظهر اسم الحساب بوضوح لإثبات المهمة.</span>
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                {proofImage ? (
                  <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <img src={proofImage} alt="معاينة صورة الإثبات" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-600">صورة الإثبات جاهزة</span>
                    <button
                      type="button"
                      onClick={() => setProofImage('')}
                      aria-label="إزالة صورة الإثبات"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-center text-xs font-bold text-slate-600 transition hover:border-[#1557ee] hover:text-[#1557ee] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1557ee]">
                    <ImagePlus className="h-4 w-4 text-[#1557ee]" />
                    اختر صورة الإثبات
                    <input type="file" data-testid={`input-proof-${campaign.id}`} accept="image/*" onChange={handleProofImage} className="sr-only" />
                  </label>
                )}
                <Button
                  type="button"
                  data-testid={`button-submit-proof-${campaign.id}`}
                  disabled={!proofImage}
                  onClick={() => onSubmitProof(campaign.id, proofImage)}
                  variant="primary"
                  size="sm"
                  className="min-h-12 justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {t('أرسل الإثبات للمراجعة')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}