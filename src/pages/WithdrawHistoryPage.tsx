import type { WithdrawRecord } from '@/legacy/shared';
import { TransactionHistoryView } from '@/pages/TransactionHistoryView';

export function WithdrawHistoryPage({
  records,
  onWithdraw,
}: {
  records: WithdrawRecord[];
  onWithdraw: () => void;
}) {
  return <TransactionHistoryView kind="withdraw" records={records} onPrimaryAction={onWithdraw} />;
}