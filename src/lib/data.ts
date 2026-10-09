import {
  createUniqueIdentifier,
  type DepositRecord,
  type WithdrawRecord,
} from '@/legacy/shared';

const createBlockchainTxId = () => createUniqueIdentifier('TX');
const depositAddress = 'يُحدَّد من إعدادات الخادم';

export const initialDepositHistory: DepositRecord[] = [
  {
    id: 'DEP-1042',
    amount: 120,
    method: 'stars',
    destination: 'Stars',
    memoTag: '62182212#1',
    blockchainTxId: createBlockchainTxId(),
    createdAt: 'اليوم، 10:12 ص',
    status: 'تم',
  },
  {
    id: 'DEP-1037',
    amount: 75,
    method: 'web3',
    destination: depositAddress,
    memoTag: '62182212#2',
    createdAt: '18 سبتمبر، 04:36 م',
    status: 'تم الإلغاء',
  },
];

export const initialWithdrawHistory: WithdrawRecord[] = [
  {
    id: 'WDR-2081',
    amount: 4.25,
    method: 'binance',
    destination: '563820147',
    memoTag: '62182212#3',
    createdAt: 'أمس، 08:20 م',
    status: 'قيد المعالجة',
  },
  {
    id: 'WDR-2054',
    amount: 2.8,
    method: 'web3',
    destination: '0x4a2F...9C10',
    memoTag: '62182212#4',
    blockchainTxId: createBlockchainTxId(),
    createdAt: '14 سبتمبر، 01:05 م',
    status: 'تم',
  },
  {
    id: 'WDR-2022',
    amount: 1.5,
    method: 'binance',
    destination: '417903628',
    memoTag: '62182212#5',
    createdAt: '10 سبتمبر، 11:40 ص',
    status: 'مرفوض',
  },
];