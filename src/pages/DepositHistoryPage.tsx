import type { DepositRecord } from '@/legacy/shared';
import { TransactionHistoryView } from '@/pages/TransactionHistoryView';

export function DepositHistoryPage({
  records,
  onDeposit,
}: {
  records: DepositRecord[];
  onDeposit: () => void;
}) {
  return <TransactionHistoryView kind="deposit" records={records} onPrimaryAction={onDeposit} />;
}