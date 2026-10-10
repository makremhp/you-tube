import { useEffect, useRef, useState } from 'react';
import { ArrowUpLeft, CheckCircle2, Clipboard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import { ApiError, apiGet } from '@/lib/api';
import {
  formatHistoryDate, formatUsd,
  WalletArtwork,
  type TelegramUser, type WithdrawMethod, type WithdrawRecord,
} from '@/legacy/shared';

export function WithdrawPage({
  viewerBalance,
  telegramUser,
  onWithdraw,
}: {
  viewerBalance: number;
  telegramUser: TelegramUser | null;
  onWithdraw: (record: WithdrawRecord) => Promise<void>;
}) {
  const { t, language, dir } = useLanguage();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<WithdrawMethod>('binance');
  const [destination, setDestination] = useState('');
  const [message, setMessage] = useState('');
  const [minimums, setMinimums] = useState({ binanceWithdrawMin: 1, web3WithdrawMin: 1 });
  const [minimumLoaded, setMinimumLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [messageIsError, setMessageIsError] = useState(false);
  const minimumLoadFailedRef = useRef(false);
  useEffect(() => {
    let active = true;
    const loadMinimums = () => {
      apiGet<{ binanceWithdrawMin: number; web3WithdrawMin: number }>('withdrawal/settings')
      .then((settings) => {
        if (active) {
          setMinimums({
            binanceWithdrawMin: Number(settings.binanceWithdrawMin) || 1,
            web3WithdrawMin: Number(settings.web3WithdrawMin) || 1,
          });
          setMinimumLoaded(true);
          if (minimumLoadFailedRef.current) {
            minimumLoadFailedRef.current = false;
            setMessage('');
            setMessageIsError(false);
          }
        }
      })
      .catch(() => {
        if (active) {
          minimumLoadFailedRef.current = true;
          setMessage(language === 'ar' ? 'تعذر تحميل الحد الأدنى للسحب من الخادم. أعد المحاولة لاحقًا.' : 'Could not load the withdrawal minimum from the server. Please retry.');
          setMessageIsError(true);
        }
      });
    };
    const timer = window.setInterval(loadMinimums, 5000);
    window.addEventListener('focus', loadMinimums);
    loadMinimums();
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', loadMinimums);
    };
  }, [language]);
  const numericAmount = Number(amount);
  const minimum = method === 'binance' ? minimums.binanceWithdrawMin : minimums.web3WithdrawMin;
  const validAddress = /^0x[a-fA-F0-9]{40}$/.test(destination.trim());
  const validBinanceId = /^\d{3,20}$/.test(destination.trim());
  const validDestination = method === 'binance' ? validBinanceId : validAddress;
  const valid = minimumLoaded && Number.isFinite(numericAmount) && numericAmount >= minimum && numericAmount <= viewerBalance && validDestination;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setMessage('');
    setMessageIsError(false);
    try {
      await onWithdraw({
        id: `WDR-${Date.now()}`,
        amount: numericAmount,
        method,
        destination: destination.trim(),
        memoTag: '',
        createdAt: formatHistoryDate(new Date(), language),
        status: 'قيد المعالجة',
      });
      setMessage(language === 'ar'
        ? `تم إرسال طلب السحب بقيمة ${numericAmount.toFixed(4)} USDT.`
        : `Withdrawal request for ${numericAmount.toFixed(4)} USDT submitted.`);
      setAmount('');
      setDestination('');
    } catch (error) {
      if (error instanceof ApiError && error.message.startsWith('Minimum withdrawal is')) {
        setMessage(language === 'ar'
          ? `الحد الأدنى للسحب بهذه الطريقة هو ${minimum} USDT.`
          : `The minimum withdrawal for this method is ${minimum} USDT.`);
      } else {
        setMessage(error instanceof Error
          ? error.message
          : (language === 'ar' ? 'تعذر إرسال طلب السحب. تحقق من البيانات وحاول مجددًا.' : 'Could not submit the withdrawal. Check the details and try again.'));
      }
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[980px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <div className="mb-7"><div className="text-xs font-semibold text-[#1557ee]">مساحة الربح / السحب</div><h1 className="mt-2 font-display text-2xl font-bold text-[#12234b] md:text-3xl">سحب الأرباح</h1><p className="mt-2 text-sm leading-6 text-slate-500">اختر Binance ID أو محفظة Web3 لاستلام أرباحك، ثم أرسل الطلب للمراجعة.</p></div>
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
         <section className="relative overflow-hidden rounded-[24px] bg-[#0e2452] p-6 text-white shadow-[0_15px_34px_rgba(14,36,82,.16)] md:p-8"><div className="flex items-center justify-between"><span className="text-xs font-bold text-blue-100">الرصيد المتاح</span><WalletArtwork method="balance" size="sm" className="h-12 w-12" /></div><div className="mt-7 text-4xl font-bold tracking-tight">{formatUsd(viewerBalance)}</div><p className="mt-2 text-xs leading-5 text-blue-100/65">{minimumLoaded ? `الحد الأدنى للسحب عبر ${method === 'binance' ? 'Binance' : 'Web3'} هو ${minimum} USDT.` : (language === 'ar' ? 'جارٍ تحميل الحد الأدنى للسحب من الخادم…' : 'Loading the withdrawal minimum from the server…')} يتم خصم الرصيد عند إرسال الطلب للمراجعة.</p><div className="mt-8 border-t border-white/10 pt-5"><div className="flex items-center gap-2 text-xs font-bold text-cyan-300"><ShieldCheck className="h-4 w-4" /> تحويل آمن</div><p className="mt-2 text-[11px] leading-5 text-blue-100/60">{method === 'binance' ? 'أرسل الأرباح إلى Binance ID مباشرة دون استخدام عنوان محفظة.' : 'استخدم عنوانًا صحيحًا على شبكة Polygon (USDT).'}</p></div><div className="mt-5 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[10px] font-bold text-blue-100/75"><WalletArtwork method="binance" size="xs" className="h-7 w-7" />تحويلات Binance سريعة وواضحة</div></section>
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] md:p-8"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eafbf8] text-[#159b89]"><ArrowUpLeft className="h-5 w-5" /></div><div><h2 className="font-display text-lg font-bold text-[#12234b]">بيانات الاستلام</h2><p className="mt-1 text-xs text-slate-400">يتم حفظ الطلب في سجل السحب بحالة قيد المعالجة.</p></div></div>
           <div className="mt-7 grid grid-cols-2 gap-2">
             {([
              { value: 'binance', title: 'Binance ID' },
               { value: 'web3', title: t('Web3') },
             ] as Array<{ value: WithdrawMethod; title: string }>).map(({ value, title }) => (
               <Button type="button" key={value} data-testid={`button-withdraw-method-${value}`} data-selected={method === value} onClick={() => setMethod(value)} variant="unstyled" size="fit" className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-right transition ${method === value ? 'border-[#1557ee] bg-[#eff4ff] text-[#1557ee]' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white"><WalletArtwork method={value} size="sm" className="h-[26px] w-[26px]" /></span><span className="truncate whitespace-nowrap text-[11px] font-bold">{title}</span>{method === value && <CheckCircle2 className="mr-auto h-4 w-4" />}</Button>
            ))}
          </div>
          <label className="mt-6 block text-xs font-bold text-slate-700">{method === 'binance' ? 'معرّف Binance الرقمي' : 'عنوان محفظة USDT (Polygon)'}<div className="relative mt-2"><Clipboard className="absolute right-4 top-3.5 h-4 w-4 text-slate-400" /><input value={destination} onChange={(event) => setDestination(method === 'binance' ? event.target.value.replace(/\D/g, '') : event.target.value)} inputMode={method === 'binance' ? 'numeric' : 'text'} pattern={method === 'binance' ? '[0-9]*' : undefined} dir="ltr" placeholder={method === 'binance' ? 'مثال: 782946315' : '0x...'} data-testid={method === 'binance' ? 'input-withdraw-binance-id' : 'input-withdraw-address'} className="w-full rounded-xl border border-slate-200 bg-[#fbfcff] py-3 pl-4 pr-11 text-left text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /></div>{destination && !validDestination && <span className="mt-2 block text-[10px] font-medium text-rose-500">{method === 'binance' ? 'أدخل Binance ID رقميًا فقط (3 إلى 20 رقمًا).' : 'أدخل عنوان Polygon صحيحاً مكوناً من 42 رمزاً.'}</span>}</label>
          <label className="mt-5 block text-xs font-bold text-slate-700">المبلغ (USDT)<div className="relative mt-2"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min={minimum} max={viewerBalance} step="0.0001" placeholder={`الحد الأدنى: ${minimum} · المتاح: ${viewerBalance.toFixed(4)}`} data-testid="input-withdraw-amount" className="w-full rounded-xl border border-slate-200 bg-[#fbfcff] px-4 py-3 pl-16 text-sm outline-none transition placeholder:text-slate-300 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50" /><span className="absolute left-4 top-3 rounded-md bg-[#eafbf8] px-2 py-1 text-[10px] font-bold text-[#159b89]">USDT</span></div></label>
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-[11px] leading-5 text-amber-800"><div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> راجع البيانات قبل الإرسال</div><p className="mt-1">ستظهر العملية في سجل السحب بحالة قيد المعالجة، ولا يمكن إلغاؤها بعد بدء التحويل.</p></div><Button type="button" data-testid="button-submit-withdraw" onClick={() => void submit()} disabled={!valid || submitting} variant="primary" size="lg" className="mt-6 flex w-full items-center justify-center gap-2 text-sm font-bold disabled:bg-slate-200 disabled:text-slate-400"><ArrowUpLeft className="h-4 w-4" /> {submitting ? (language === 'ar' ? 'جارٍ الإرسال…' : 'Submitting…') : 'إرسال طلب السحب'}</Button>{message && <div role={messageIsError ? 'alert' : 'status'} className={`mt-4 rounded-xl p-3 text-center text-xs font-bold leading-5 ${messageIsError ? 'bg-rose-50 text-rose-700' : 'bg-[#eafbf8] text-[#159b89]'}`}>{message}</div>}</section>
      </div>
    </main>
  );
}
