import { ArrowDownLeft } from 'lucide-react';
import { useLanguage } from '@/i18n';
import {
  CompactHistoryRow, HistoryStat, WalletArtwork,
  type DepositRecord,
} from '@/legacy/shared';

export function DepositHistoryPage({ records }: { records: DepositRecord[] }) {
  const { dir } = useLanguage();
  const completedTotal = records.filter((record) => record.status === 'تم').reduce((total, record) => total + record.amount, 0);
  const pendingCount = records.filter((record) => record.status === 'قيد المعالجة').length;

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pb-28 pt-7 md:px-8 md:pt-10 lg:px-10 lg:pb-12" dir={dir}>
      <div className="mb-6"><div className="text-[10px] font-bold tracking-wide text-[#1557ee]">إدارة الإعلانات / سجل الإيداع</div><h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#12234b] md:text-3xl">سجل الإيداع</h1><p className="mt-1.5 text-xs leading-5 text-slate-500">تابع عمليات تمويل الإعلانات بسرعة ووضوح.</p></div>
      <div className="mb-4 grid gap-2.5 sm:grid-cols-3"><HistoryStat label="إجمالي العمليات" value={String(records.length)} /><HistoryStat label="الإيداعات المكتملة" value={`$${completedTotal.toFixed(2)}`} tone="text-[#159b89]" /><HistoryStat label="قيد المراجعة" value={String(pendingCount)} tone="text-amber-600" /></div>
      <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]">
        <div className="flex h-[60px] items-center justify-between border-b border-slate-100 px-5 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#edf3ff] text-[#1557ee]"><ArrowDownLeft className="h-3.5 w-3.5" /></span><div className="min-w-0"><h2 className="truncate text-sm font-bold text-[#12234b]">عمليات الإيداع</h2><p className="mt-0.5 truncate text-[9px] text-slate-400">المبلغ · الطريقة · الوجهة · الحالة</p></div></div>
          <span className="rounded-lg bg-[#f4f8ff] px-2 py-1 text-[9px] font-bold text-[#1557ee]">{records.length} عمليات</span>
        </div>
        {records.length > 0 ? records.map((record) => <CompactHistoryRow key={record.id} record={record} kind="deposit" />) : <div className="flex flex-col items-center justify-center px-6 py-12 text-center"><WalletArtwork method="stars" size="md" /><div className="mt-2 text-sm font-bold text-[#12234b]">لا توجد عمليات إيداع بعد</div><p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-400">ستظهر هنا كل فاتورة تمويل مع طريقة الدفع وحالة التحقق.</p></div>}
      </section>
    </main>
  );
}