import { useEffect, useState } from 'react';
import {
  Check, CheckCircle2, Copy, DollarSign, ExternalLink, FileText, QrCode,
  RefreshCw, ShieldCheck, Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import {
  CompactInvoiceValue, createMemoTag, createUniqueIdentifier, formatHistoryDate,
  formatRemaining, invoiceLifetime, methodLabel, PaymentMethodBadge, StatusBadge,
  WalletArtwork, depositAddress,
  type DepositMethod, type DepositRecord, type TelegramUser,
} from '@/legacy/shared';

export function DepositPage({
  advertiserBalance,
  telegramUser,
  onDepositRequested,
  onDepositCompleted,
  onDepositExpired,
}: {
  advertiserBalance: number;
  telegramUser: TelegramUser | null;
  onDepositRequested: (record: DepositRecord) => void;
  onDepositCompleted: (id: string) => void;
  onDepositExpired: (id: string) => void;
}) {
  const { t, language, dir } = useLanguage();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<DepositMethod>('stars');
  const [invoice, setInvoice] = useState<{ id: string; amount: number; method: DepositMethod; destination: string; memoTag: string; telegramUserId: number | null; expiresAt: number; stars?: number } | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<'pending' | 'completed' | 'expired'>('pending');
  const [remainingSeconds, setRemainingSeconds] = useState(invoiceLifetime);
  const [finalizedInvoiceId, setFinalizedInvoiceId] = useState('');
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const numericAmount = Number(amount);
  const validAmount = Number.isFinite(numericAmount) && numericAmount >= 1 && numericAmount <= 10000;

  const copyValue = async (value: string, key: string) => {
    try { await navigator.clipboard.writeText(value); } catch { /* clipboard may be unavailable in preview */ }
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1800);
  };

  const createInvoice = async () => {
    if (!validAmount) return;
    setIsCreatingInvoice(true);
    setError('');
    const createdAt = Date.now();
    let destination = depositAddress;
    let stars: number | undefined;
    let paymentPayload = createMemoTag(telegramUser?.id);
    if (method === 'stars') {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}api/telegram/stars/invoice`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ amountUsd: numericAmount, telegramUserId: telegramUser?.id }),
        });
        const data = await response.json() as { invoiceUrl?: string; amountUsd?: number; stars?: number; payload?: string; message?: string };
        if (!response.ok || !data.invoiceUrl || !data.amountUsd || !data.stars) {
          throw new Error(data.message || t('تعذر إنشاء فاتورة Stars.'));
        }
        destination = data.invoiceUrl;
        stars = data.stars;
        paymentPayload = data.payload || paymentPayload;
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : t('تعذر إنشاء فاتورة Stars.'));
        setIsCreatingInvoice(false);
        return;
      }
    }
    const transactionId = createUniqueIdentifier('DEP');
    const nextInvoice = {
      id: transactionId,
      amount: numericAmount,
      method,
      destination,
      memoTag: paymentPayload,
      telegramUserId: telegramUser?.id ?? null,
      expiresAt: createdAt + invoiceLifetime * 1000,
      stars,
    };
    setInvoice(nextInvoice);
    setInvoiceStatus('pending');
    setRemainingSeconds(invoiceLifetime);
    setFinalizedInvoiceId('');
    onDepositRequested({
      id: nextInvoice.id,
      amount: nextInvoice.amount,
      method: nextInvoice.method,
      destination: nextInvoice.destination,
      memoTag: nextInvoice.memoTag,
      createdAt: formatHistoryDate(new Date(createdAt), language),
      status: 'قيد المعالجة',
    });
    setIsCreatingInvoice(false);
  };

  useEffect(() => {
    if (!invoice || invoiceStatus !== 'pending') return;
    const updateCountdown = () => {
      const next = Math.max(0, Math.ceil((invoice.expiresAt - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) setInvoiceStatus('expired');
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [invoice, invoiceStatus]);

  useEffect(() => {
    if (!invoice || finalizedInvoiceId === invoice.id) return;
    if (invoiceStatus === 'completed') {
      setFinalizedInvoiceId(invoice.id);
      onDepositCompleted(invoice.id);
    } else if (invoiceStatus === 'expired') {
      setFinalizedInvoiceId(invoice.id);
      onDepositExpired(invoice.id);
    }
  }, [invoice, invoiceStatus, finalizedInvoiceId, onDepositCompleted, onDepositExpired]);

  const openStarsInvoice = () => {
    if (!invoice || invoice.method !== 'stars') return;
    const webApp = window.Telegram?.WebApp;
    if (webApp?.openInvoice) {
      webApp.openInvoice(invoice.destination, (status) => {
        if (status === 'paid') setInvoiceStatus('completed');
        if (status === 'failed' || status === 'cancelled') setInvoiceStatus('pending');
      });
      return;
    }
    window.open(invoice.destination, '_blank', 'noopener,noreferrer');
  };

  const invoiceHeading = invoice?.method === 'stars'
    ? t(`ادفع ${invoice.amount.toFixed(2)} دولار عبر Stars`)
    : t(`أرسل ${invoice?.amount.toFixed(2)} USDT إلى العنوان التالي`);
  const statusLabel = invoiceStatus === 'completed' ? t('تم التأكيد تلقائيًا') : invoiceStatus === 'expired' ? t('انتهت صلاحية الفاتورة') : t('جاري المعالجة');

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <div className="mb-7">
        <div className="text-xs font-semibold text-[#1557ee]">{t('إدارة الإعلانات')} / {t('إيداع')}</div>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#12234b] md:text-3xl">{t('إيداع رصيد الإعلانات')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t('أنشئ فاتورة، أرسل المبلغ، وسنتحقق من العملية تلقائيًا دون الحاجة إلى تأكيد يدوي.')}</p>
      </div>

      {!invoice ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] md:p-8">
              <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><DollarSign className="h-5 w-5" /></div><div><h2 className="font-display text-lg font-bold text-[#12234b]">{t('بيانات الإيداع')}</h2><p className="mt-1 text-xs text-slate-400">{t('اختر Stars أو محفظة Web3')}</p></div></div>
            <div className="mt-7">
               <div className="mb-2 text-xs font-bold text-slate-700">{t('طريقة الدفع')}</div>
              <div className="grid grid-cols-2 gap-2">
                   {([
                     { value: 'stars', title: t('Stars') },
                     { value: 'web3', title: t('Web3') },
                  ] as Array<{ value: DepositMethod; title: string }>).map(({ value, title }) => (
                   <Button type="button" key={value} data-testid={`button-deposit-method-${value}`} data-selected={method === value} onClick={() => setMethod(value)} variant="unstyled" size="fit" className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-right transition ${method === value ? 'border-[#1557ee] bg-[#eff4ff] text-[#1557ee]' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                     <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white"><WalletArtwork method={value} size="sm" className="h-[26px] w-[26px]" /></span>
                     <span className="truncate whitespace-nowrap text-[11px] font-bold">{title}</span>
                    {method === value && <CheckCircle2 className="mr-auto h-4 w-4" />}
                   </Button>
                ))}
              </div>
            </div>
              <label className="mt-6 block text-xs font-bold text-slate-700">{t('المبلغ المطلوب (دولار)')}<div className="relative mt-2"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" max="10000" step="0.01" placeholder="50.00" data-testid="input-deposit-amount" className="w-full rounded-xl border border-slate-200 bg-[#fbfcff] px-4 py-3 pl-16 text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /><span className="absolute left-4 top-3 rounded-md bg-[#eafbf8] px-2 py-1 text-[10px] font-bold text-[#159b89]">USD</span></div></label>
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-[11px] leading-5 text-amber-800"><div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> {t('تنبيه قبل الدفع')}</div><p className="mt-1">{method === 'stars' ? t(`كل 1 دولار = 100 نجمة. سيدفع المستخدم ${Math.round(numericAmount * 100 || 0).toLocaleString('en-US')} نجمة عبر Telegram.`) : t('استخدم شبكة Polygon فقط، وأرسل المبلغ نفسه الموضح في الفاتورة.')}</p></div>
             {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-center text-xs font-bold leading-5 text-rose-600">{error}</div>}
               <Button type="button" data-testid="button-create-invoice" onClick={createInvoice} disabled={!validAmount} loading={isCreatingInvoice} loadingLabel={t('جاري إنشاء الفاتورة...')} variant="primary" size="lg" className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-bold disabled:bg-slate-200 disabled:text-slate-400"><FileText className="h-4 w-4" /> {t('إنشاء فاتورة الإيداع')}</Button>
          </section>
           <section className="relative overflow-hidden rounded-[24px] bg-[#0e2452] p-6 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)] md:p-8">
              <div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-100">{t('الرصيد الحالي')}</span><WalletArtwork method="balance" size="sm" className="h-12 w-12" /></div>
            <div className="mt-7 text-4xl font-bold tracking-tight">${advertiserBalance.toFixed(2)}</div>
            <p className="mt-2 text-xs leading-5 text-blue-100/65">الرصيد الذي يمكنك استخدامه لتمويل إعلاناتك. ستظهر الإيداعات بعد التحقق التلقائي.</p>
               <div className="mt-8 border-t border-white/10 pt-5"><div className="text-[10px] font-bold text-blue-100/60">{t('طرق الإيداع')}</div><div className="mt-3 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-blue-100/70"><WalletArtwork method="stars" size="xs" className="h-7 w-7" />{t('الدفع السريع')}</span><span className="font-bold text-cyan-300">{t('Stars')}</span></div><div className="mt-3 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-blue-100/70"><WalletArtwork method="web3" size="xs" className="h-7 w-7" />{t('التحويل المباشر')}</span><span className="font-bold text-cyan-300">USDT · Polygon</span></div></div>
          </section>
        </div>
      ) : (
        <section className="animate-rise rounded-[24px] border border-slate-200 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5 md:p-6">
          <div className="grid min-h-[60px] gap-3 rounded-[18px] border border-slate-100 bg-[#fbfcff] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
                <div className={`flex items-center gap-2 text-[10px] font-bold ${invoiceStatus === 'completed' ? 'text-[#159b89]' : invoiceStatus === 'expired' ? 'text-rose-500' : 'text-amber-600'}`}><WalletArtwork method={invoice.method} size="xs" className="h-8 w-8" /><span className={`h-1.5 w-1.5 rounded-full ${invoiceStatus === 'completed' ? 'bg-[#159b89]' : invoiceStatus === 'expired' ? 'bg-rose-500' : 'animate-pulse bg-amber-500'}`} /> {statusLabel}</div>
              <h2 className="mt-1 truncate font-display text-sm font-bold text-[#12234b]">{invoiceHeading}</h2>
            </div>
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><span className="max-w-[150px] rounded-lg bg-[#edf3ff] px-2 py-1 text-[#1557ee]"><PaymentMethodBadge method={invoice.method} compact /></span><span className="rounded-lg bg-[#eafbf8] px-2 py-1 text-[#159b89]">{invoice.amount.toFixed(2)} {invoice.method === 'stars' ? 'USD' : 'USDT'}</span></div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="grid gap-3">
               {invoice.method === 'web3' && <div className="grid gap-3 sm:grid-cols-2">
                      <CompactInvoiceValue
                       label={t('عنوان الإيداع (Polygon)')}
                   value={invoice.destination}
                       action={<Button type="button" data-testid="button-copy-deposit-destination" onClick={() => copyValue(invoice.destination, 'destination')} variant="icon" size="icon" className="copy-action grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#1557ee]" aria-label="نسخ وجهة الإيداع">{copied === 'destination' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button>}
                 />
                 <div className="min-w-0">
                   <CompactInvoiceValue
                      label={t('Memo / Tag فريد لهذه العملية')}
                     value={invoice.memoTag}
                     tone="text-[#159b89]"
                      action={<Button type="button" data-testid="button-copy-deposit-memo" onClick={() => copyValue(invoice.memoTag, 'memo')} variant="icon" size="icon" className="copy-action grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#1557ee]" aria-label="نسخ Memo Tag">{copied === 'memo' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button>}
                   />
                    <p className="mt-1 px-1 text-[9px] font-semibold leading-4 text-slate-400">{t('الصق هذا الرمز في خانة الملاحظات عند إرسال الإيداع.')}</p>
                 </div>
               </div>}
              <div className="grid gap-3 sm:grid-cols-3">
                  <CompactInvoiceValue label={t('المبلغ')} value={`${invoice.amount.toFixed(2)} ${invoice.method === 'stars' ? 'USD' : 'USDT'}`} />
                 <CompactInvoiceValue label={t('طريقة الدفع')} value={t(methodLabel(invoice.method))} />
                  {invoice.method === 'stars' && <CompactInvoiceValue label={t('عدد النجوم')} value={`${invoice.stars?.toLocaleString('en-US') ?? '—'} Stars`} tone="text-[#f59e0b]" />}
                 <CompactInvoiceValue label={t('الوقت المتبقي')} value={invoiceStatus === 'pending' ? formatRemaining(remainingSeconds) : invoiceStatus === 'completed' ? t('تمت العملية') : t('منتهية')} tone={invoiceStatus === 'pending' ? 'text-amber-600' : 'text-[#159b89]'} />
              </div>
              <div className={`flex min-h-[60px] items-center gap-2 rounded-[16px] border px-3.5 ${invoiceStatus === 'pending' ? 'border-amber-100 bg-amber-50 text-amber-700' : invoiceStatus === 'completed' ? 'border-emerald-100 bg-[#eafbf8] text-[#159b89]' : 'border-rose-100 bg-rose-50 text-rose-600'}`}>
                <Timer className="h-4 w-4 shrink-0" />
                  <p className="truncate text-[10px] font-bold">{invoiceStatus === 'pending' ? t(`في انتظار تأكيد الدفع · تنتهي خلال ${formatRemaining(remainingSeconds)}`) : invoiceStatus === 'completed' ? t('تم تأكيد دفع Stars وإضافة الإيداع.') : t('انتهت الفاتورة قبل وصول الدفع.')}</p>
              </div>
            </div>
            <div className="flex h-[60px] items-center gap-3 rounded-[16px] border border-dashed border-slate-200 bg-[#fbfcff] px-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-white bg-[#eef3ff] text-[#1557ee] shadow-sm"><QrCode className="h-6 w-6" /></div>
                <p className="text-[10px] font-semibold leading-4 text-slate-400">{invoice.method === 'stars' ? t('اضغط زر الدفع أسفل الفاتورة لإكمال الدفع داخل Telegram.') : t('استخدم شبكة Polygon وأرسل المبلغ المحدد.')}</p>
            </div>
          </div>
            {invoice.method === 'stars' && invoiceStatus === 'pending' && <Button type="button" data-testid="button-pay-stars" onClick={openStarsInvoice} aria-label={t('اضغط لفتح رابط دفع Telegram وإكمال الدفع')} variant="primary" size="lg" className="payment-link-button group mt-5 flex w-full items-center gap-3 rounded-2xl border border-[#0f48d0] bg-[#1557ee] px-4 py-3.5 text-start text-white">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><WalletArtwork method="stars" size="sm" className="h-8 w-8" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{t('ادفع بالنجوم')}</span>
                 <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-blue-100"><ExternalLink className="h-3 w-3" /> {t('اضغط لفتح رابط الدفع')}</span>
              </span>
              <span className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1.5 text-[10px] font-semibold">{invoice.stars?.toLocaleString('en-US')} {t('Stars')}</span>
           </Button>}
          {invoiceStatus !== 'pending' && <div className="mt-7 flex justify-end border-t border-slate-100 pt-6"><Button type="button" onClick={() => setInvoice(null)} variant="primary" size="default" className="flex items-center justify-center gap-2 text-xs font-bold"><RefreshCw className="h-4 w-4" /> إنشاء فاتورة جديدة</Button></div>}
        </section>
      )}
    </main>
  );
}
