import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpLeft,
  CheckCircle2,
  Clock3,
  Plus,
  Search,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n';
import {
  CompactHistoryRow,
  type DepositRecord,
  type WithdrawRecord,
} from '@/legacy/shared';

type HistoryKind = 'deposit' | 'withdraw';
type HistoryRecord = DepositRecord | WithdrawRecord;
type HistoryFilter = 'all' | 'completed' | 'processing' | 'other';

const filters: HistoryFilter[] = ['all', 'completed', 'processing', 'other'];

export function TransactionHistoryView({
  kind,
  records,
  onPrimaryAction,
}: {
  kind: HistoryKind;
  records: HistoryRecord[];
  onPrimaryAction: () => void;
}) {
  const { t, dir, language } = useLanguage();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const isDeposit = kind === 'deposit';
  const completedRecords = records.filter((record) => record.status === 'تم');
  const processingRecords = records.filter((record) => record.status === 'قيد المعالجة');
  const otherRecords = records.filter((record) => record.status === 'تم الإلغاء' || record.status === 'مرفوض');
  const completedTotal = completedRecords.reduce((total, record) => total + record.amount, 0);
  const amountDigits = isDeposit ? 2 : 4;
  const amountFormatter = new Intl.NumberFormat(language === 'ar' ? 'ar' : 'en', {
    minimumFractionDigits: amountDigits,
    maximumFractionDigits: amountDigits,
  });
  const amountValue = `${amountFormatter.format(completedTotal)} USDT`;
  const pageTitle = t(isDeposit ? 'سجل الإيداع' : 'سجل السحب');
  const actionLabel = t(isDeposit ? 'إيداع جديد' : 'سحب الأرباح');
  const breadcrumb = t(isDeposit ? 'إدارة الإعلانات / سجل الإيداع' : 'مساحة الربح / سجل السحب');
  const subtitle = t(isDeposit
    ? 'تابع عمليات تمويل الإعلانات بسرعة ووضوح.'
    : 'كل طلبات سحب الأرباح في عرض سريع ومنظم.');

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return records.filter((record) => {
      const matchesFilter = filter === 'all'
        || (filter === 'completed' && record.status === 'تم')
        || (filter === 'processing' && record.status === 'قيد المعالجة')
        || (filter === 'other' && (record.status === 'تم الإلغاء' || record.status === 'مرفوض'));
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

      return [
        record.id,
        record.destination,
        ...(isDeposit ? [record.memoTag] : []),
        record.blockchainTxId ?? '',
        record.status,
        record.method,
        record.createdAt,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [filter, isDeposit, query, records]);

  const counts: Record<HistoryFilter, number> = {
    all: records.length,
    completed: completedRecords.length,
    processing: processingRecords.length,
    other: otherRecords.length,
  };

  const stats = [
    {
      label: t(isDeposit ? 'إجمالي العمليات' : 'إجمالي الطلبات'),
      value: String(records.length),
      helper: t(isDeposit ? 'كل عمليات التمويل المسجلة' : 'كل طلبات السحب المسجلة'),
      icon: WalletCards,
      iconTone: 'bg-blue-50 text-[#1557ee]',
    },
    {
      label: t(isDeposit ? 'الإيداعات المكتملة' : 'تم تحويله'),
      value: amountValue,
      helper: t('المجموع المكتمل'),
      icon: CheckCircle2,
      iconTone: 'bg-emerald-50 text-[#159b89]',
    },
    {
      label: t('قيد المعالجة'),
      value: String(processingRecords.length),
      helper: t('بانتظار تحديث الحالة'),
      icon: Clock3,
      iconTone: 'bg-amber-50 text-amber-600',
    },
  ];

  const filterLabels: Record<HistoryFilter, string> = {
    all: t('الكل'),
    completed: t('مكتملة'),
    processing: t('قيد المعالجة'),
    other: t('أخرى'),
  };

  return (
    <main
      className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:px-10 lg:pb-12"
      dir={dir}
    >
      <section className={`relative mb-6 overflow-hidden rounded-[26px] p-5 text-white shadow-[0_20px_50px_rgba(18,45,112,.16)] sm:p-7 ${isDeposit ? 'bg-gradient-to-br from-[#112658] via-[#1642a6] to-[#1983ad]' : 'bg-gradient-to-br from-[#102857] via-[#146c83] to-[#159b89]'}`}>
        <div aria-hidden="true" className="pointer-events-none absolute -end-10 -top-24 h-64 w-64 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -end-2 -top-16 h-48 w-48 rounded-full border border-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-blue-100/75">
              {isDeposit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpLeft className="h-4 w-4" />}
              <span>{breadcrumb}</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{pageTitle}</h1>
            <p className="mt-2 max-w-xl text-xs leading-6 text-blue-50/75 sm:text-sm">{subtitle}</p>
          </div>
          <Button
            type="button"
            data-testid={`button-new-${kind}`}
            onClick={onPrimaryAction}
            variant="secondary"
            size="fit"
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/25 bg-white px-4 text-xs font-bold text-[#17366e] shadow-sm transition hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Button>
        </div>
      </section>

      <section aria-label={t('ملخص السجل')} className="mb-6 grid gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, helper, icon: Icon, iconTone }) => (
          <article
            key={label}
            data-testid={`history-stat-${kind}-${label}`}
            className="flex min-h-[106px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
          >
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${iconTone}`}>
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-slate-500">{label}</div>
              <div className="mt-1 truncate text-lg font-bold tracking-tight text-[#12234b]" dir="ltr">{value}</div>
              <div className="mt-0.5 text-[9px] text-slate-400">{helper}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[var(--shadow-soft)]">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#12234b]">{t(isDeposit ? 'عمليات الإيداع' : 'طلبات السحب')}</h2>
              <p className="mt-1 text-[10px] text-slate-400">{t('رتّب سجلك وابحث عن أي عملية بسهولة.')}</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#f4f8ff] px-3 py-2 text-[10px] font-semibold text-[#1557ee]">
              <span className="grid h-6 min-w-6 place-items-center rounded-lg bg-white px-1.5 font-bold shadow-sm">{records.length}</span>
              <span>{t('سجل مالي')}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-[360px]">
              <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                data-testid={`input-search-${kind}-history`}
                aria-label={t('ابحث برقم العملية أو الوجهة')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('ابحث برقم العملية أو الوجهة')}
                className="h-10 w-full rounded-xl border border-slate-200 bg-[#fbfcff] ps-10 pe-3 text-xs text-[#12234b] outline-none transition placeholder:text-slate-400 focus:border-[#1557ee] focus:ring-4 focus:ring-blue-50"
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('فلترة حسب الحالة')}>
              {filters.map((value) => {
                const active = filter === value;
                return (
                  <Button
                    key={value}
                    type="button"
                    data-testid={`button-filter-${kind}-${value}`}
                    aria-pressed={active}
                    onClick={() => setFilter(value)}
                    variant="unstyled"
                    size="fit"
                    className={`flex h-9 items-center gap-2 rounded-lg px-3 text-[10px] font-bold transition ${active ? 'bg-[#1557ee] text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-[#1557ee]'}`}
                  >
                    <span>{filterLabels[value]}</span>
                    <span className={`min-w-5 rounded-md px-1 py-0.5 text-[9px] ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>{counts[value]}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {filteredRecords.length > 0 ? (
          <div className="space-y-3 bg-[#f8faff] p-3 sm:p-4">
            <div className="flex items-center justify-between px-1 text-[10px] text-slate-500">
              <span>{t('النتائج المعروضة')}</span>
              <span className="font-semibold text-[#12234b]">{filteredRecords.length} / {records.length}</span>
            </div>
            {filteredRecords.map((record) => (
              <CompactHistoryRow key={record.id} record={record} kind={kind} />
            ))}
          </div>
        ) : records.length > 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#1557ee]">
              <Search className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-sm font-bold text-[#12234b]">{t('لا توجد نتائج مطابقة')}</h3>
            <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-500">{t('جرّب البحث برقم مختلف أو اختر حالة أخرى.')}</p>
            <Button
              type="button"
              data-testid={`button-reset-${kind}-history`}
              onClick={() => { setQuery(''); setFilter('all'); }}
              variant="secondary"
              size="fit"
              className="mt-4 h-9 rounded-lg border-slate-200 bg-white px-3 text-[10px] font-bold text-[#1557ee]"
            >
              {t('عرض كل السجلات')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center px-5 py-12 text-center sm:py-16">
            <span className={`grid h-16 w-16 place-items-center rounded-[22px] ${isDeposit ? 'bg-blue-50 text-[#1557ee]' : 'bg-emerald-50 text-[#159b89]'}`}>
              {isDeposit ? <ArrowDownLeft className="h-7 w-7" /> : <ArrowUpLeft className="h-7 w-7" />}
            </span>
            <h3 className="mt-4 text-sm font-bold text-[#12234b]">{t(isDeposit ? 'لا توجد عمليات إيداع بعد' : 'لا توجد طلبات سحب بعد')}</h3>
            <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-500">
              {t(isDeposit
                ? 'ستظهر هنا فواتير التمويل مع طريقة الدفع وحالة التحقق.'
                : 'ستظهر طلباتك هنا مع المبلغ والوجهة وحالة التحويل.')}
            </p>
            <Button
              type="button"
              data-testid={`button-empty-action-${kind}-history`}
              onClick={onPrimaryAction}
              variant="primary"
              size="fit"
              className="mt-5 flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
            >
              <Plus className="h-4 w-4" />
              {actionLabel}
            </Button>
          </div>
        )}
      </section>

      <p className="mt-4 px-1 text-[9px] leading-5 text-slate-400">
        {t('قد يستغرق تحديث حالة التحويل بضع دقائق بعد تأكيد الشبكة.')}
      </p>
    </main>
  );
}