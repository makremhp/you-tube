// يُحمَّل قبل أي اختبار: يضبط بيئة اختبار معزولة ويستبدل عميل Neon بقاعدة PGlite داخل الذاكرة.
// لا يتصل أي اختبار بقاعدة الإنتاج ولا بـ Telegram ولا بمزوّد الإعلانات؛ كل الطلبات الخارجية تُعترض في helpers.mjs.
import { register } from 'node:module';

process.env.NODE_ENV = 'test';
process.env.VERCEL = '1';
process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN_NOT_REAL';
process.env.NEON_DATABASE_URL = 'postgres://stub-for-tests';
process.env.ADMIN_TELEGRAM_IDS = '9001';
process.env.SECURITY_HASH_SECRET = 'test-only-security-secret';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.DEPOSIT_WALLET_ADDRESS = 'TTestWalletAddressForTestsOnly000000000';
process.env.VPN_PROTECTION = 'off';

register('./loader.mjs', import.meta.url);
