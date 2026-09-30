import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'ar' | 'en';

export function getBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const documentLanguage = typeof document === 'undefined' ? '' : document.documentElement.lang.toLowerCase();
  if (documentLanguage.startsWith('ar')) return 'ar';
  if (documentLanguage.startsWith('en')) return 'en';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  const preferredSupportedLanguage = languages.find((value) => {
    const normalized = value?.toLowerCase() ?? '';
    return normalized.startsWith('ar') || normalized.startsWith('en');
  });
  return preferredSupportedLanguage?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

const exactTranslations: Record<string, string> = {
  'حساب المستخدم': 'User account',
  'إغلاق القائمة': 'Close menu',
  'فتح القائمة': 'Open menu',
  'الرئيسية': 'Home',
  'نشر إعلان': 'Publish ad',
  'اربح': 'Earn',
  'إدارة الإعلانات': 'Ad management',
  'مساحة الربح': 'Earning space',
  'نظرة عامة': 'Overview',
  'إعلاناتي': 'My campaigns',
  'إيداع رصيد': 'Deposit funds',
  'سجل الإيداع': 'Deposit history',
  'شاهد واربح': 'Watch and earn',
  'سحب الأرباح': 'Withdraw earnings',
  'سجل السحب': 'Withdrawal history',
  'ميزة جديدة': 'New feature',
  'موّل إعلانك بسهولة': 'Fund your campaign with ease',
  'ابدأ بجمع أرباحك': 'Start collecting earnings',
  'أضف إعلان الآن': 'Add an ad now',
  'اذهب إلى المشاهدة': 'Go to watch',
  'حساب منشئ': 'Creator account',
  'إضافة إعلان': 'Add campaign',
  'إعلان جديد': 'New campaign',
  'إيداع': 'Deposit',
  'سحب': 'Withdrawal',
  'الطريقة': 'Method',
  'الوجهة': 'Destination',
  'نوع Memo': 'Memo type',
  'رقم العملية': 'Transaction ID',
  'المعرّف الداخلي': 'Internal ID',
  'بعد التأكيد': 'After confirmation',
  'سيظهر بعد التأكيد': 'Appears after confirmation',
  'قيد المعالجة': 'Processing',
  'تم': 'Completed',
  'تم الإلغاء': 'Cancelled',
  'مرفوض': 'Declined',
  'Stars': 'Stars',
  'Telegram Stars': 'Stars',
  'Web3 Wallet': 'Web3 wallet',
  'محفظة Web3': 'Web3 wallet',
  'Web3': 'Web3',
  'Binance ID': 'Binance ID',
  'إيداع رصيد الإعلانات': 'Deposit campaign funds',
  'بيانات الإيداع': 'Deposit details',
  'طريقة الدفع': 'Payment method',
  'المبلغ المطلوب (دولار)': 'Amount (USD)',
  'تنبيه قبل الدفع': 'Before you pay',
  'إنشاء فاتورة الإيداع': 'Create deposit invoice',
  'الرصيد الحالي': 'Current balance',
  'طرق الإيداع': 'Deposit methods',
  'الدفع السريع': 'Quick payment',
  'التحويل المباشر': 'Direct transfer',
  'فاتورة الإيداع': 'Deposit invoice',
  'عدد النجوم': 'Star amount',
  'الوقت المتبقي': 'Time remaining',
  'تمت العملية': 'Payment completed',
  'منتهية': 'Expired',
  'جاري المعالجة': 'Processing',
  'تم التأكيد تلقائيًا': 'Automatically confirmed',
  'انتهت صلاحية الفاتورة': 'Invoice expired',
  'إنشاء فاتورة جديدة': 'Create a new invoice',
  'ادفع بالنجوم': 'Pay with Stars',
  'اضغط لفتح رابط الدفع': 'Tap to open payment link',
  'اضغط لفتح رابط دفع Telegram وإكمال الدفع': 'Tap to open the Telegram payment link and complete payment',
  'تعذر إنشاء فاتورة Stars.': 'Unable to create a Stars invoice.',
  'أنشئ فاتورة، أرسل المبلغ، وسنتحقق من العملية تلقائيًا دون الحاجة إلى تأكيد يدوي.': 'Create an invoice, send the amount, and we will verify the payment automatically.',
  'اختر Stars أو محفظة Web3': 'Choose Stars or a Web3 wallet',
  'استخدم شبكة Polygon فقط، وأرسل المبلغ نفسه الموضح في الفاتورة.': 'Use the Polygon network only and send the exact amount shown on the invoice.',
  'تم تأكيد دفع Telegram Stars وإضافة الإيداع.': 'Stars payment confirmed and deposit added.',
  'تم تأكيد دفع Stars وإضافة الإيداع.': 'Stars payment confirmed and deposit added.',
  'فاتورة Telegram آمنة': 'Secure Telegram invoice',
  'اضغط زر الدفع أسفل الفاتورة لإكمال الدفع داخل Telegram.': 'Use the payment button below to complete payment in Telegram.',
  'استخدم شبكة Polygon وأرسل المبلغ المحدد.': 'Use the Polygon network and send the specified amount.',
  'الصق هذا الرمز في خانة الملاحظات عند إرسال الإيداع.': 'Paste this code into the memo field when sending your deposit.',
  'نسخ': 'Copy',
  'نسخ وجهة الإيداع': 'Copy deposit destination',
  'نسخ Memo Tag': 'Copy memo tag',
  'مبلغ': 'Amount',
  'المبلغ': 'Amount',
  'عنوان الإيداع (Polygon)': 'Deposit address (Polygon)',
  'Memo / Tag فريد لهذه العملية': 'Unique Memo / Tag for this payment',
  'عنوان محفظة USDT (Polygon)': 'USDT wallet address (Polygon)',
  'USDT عبر Polygon': 'USDT via Polygon',
  'معرّف Binance الرقمي': 'Binance numeric ID',
  'الرصيد المتاح': 'Available balance',
  'بيانات الاستلام': 'Receiving details',
  'إرسال طلب السحب': 'Submit withdrawal request',
  'راجع البيانات قبل الإرسال': 'Review before submitting',
  'عمليات الإيداع': 'Deposits',
  'طلبات السحب': 'Withdrawal requests',
  'لا توجد عمليات إيداع بعد': 'No deposits yet',
  'لا توجد طلبات سحب بعد': 'No withdrawal requests yet',
  'إجمالي العمليات': 'Total transactions',
  'الإيداعات المكتملة': 'Completed deposits',
  'قيد المراجعة': 'Under review',
  'إجمالي الطلبات': 'Total requests',
  'تم تحويله': 'Transferred',
  'مكافآت موثوقة': 'Trusted rewards',
  'مدة واضحة': 'Clear durations',
  'أكمل المدة المطلوبة': 'Complete the required time',
  'الفيديو جاهز للمشاهدة': 'Video ready to watch',
  'فتح الفيديو على YouTube': 'Open video on YouTube',
  'تحقق واستلم المكافأة': 'Verify and claim reward',
  'شاهد فيديو آخر': 'Watch another video',
  'تمت إضافة المكافأة': 'Reward added',
  'تم تأكيد الإيداع': 'Deposit confirmed',
  'تم إنشاء الفاتورة': 'Invoice created',
  'هذه لمحة سريعة عن أثر إعلاناتك اليوم.': 'Here is a quick look at your campaign impact today.',
  'ملخص أداء حملاتك ورصيدك في مكان واحد.': 'Your campaign performance and balance in one place.',
  'الأربعاء، ٢٣ سبتمبر ٢٠٢٦': 'Wednesday, September 23, 2026',
  'الثلاثاء، ٢٤ ديسمبر ٢٠٢٤': 'Tuesday, December 24, 2024',
  'رصيد المعلن': 'Advertiser balance',
  'جاهز للتحويل عبر Web3 · Polygon': 'Ready for Web3 transfer · Polygon',
  'إيداع رصيد جديد': 'Deposit new funds',
  'أداء هذا الشهر': 'This month’s performance',
  'إكمالات الفيديو': 'Video completions',
  'مقارنة بالأسبوع الماضي': 'Compared with last week',
  'خطواتك التالية': 'Your next steps',
  'أكمل هذه الخطوات لتحصل على أفضل نتيجة.': 'Complete these steps for the best result.',
  'موّل حملتك': 'Fund your campaign',
  'راجع الأداء': 'Review performance',
  'شارك فيديو يستحق وقت المشاهدين.': 'Share a video worth your viewers’ time.',
  'أنشئ فاتورة إيداع آمنة عبر Stars أو Web3.': 'Create a secure deposit invoice with Stars or Web3.',
  'تابع المشاهدات والإكمالات من صفحة الإعلانات.': 'Track views and completions from the campaigns page.',
  'ملخص الإنفاق': 'Spend summary',
  'آخر ٧ أيام': 'Last 7 days',
  'آخر ٣٠ يومًا': 'Last 30 days',
  'عن الأسبوع الماضي': 'from last week',
  'متاح لتمويل الحملات': 'Available for campaign funding',
  'متاح لتمويل الحملات القادمة': 'Available for upcoming campaigns',
  'الإنفاق على الإعلانات': 'Ad spend',
  'منذ بداية الشهر': 'Since the start of the month',
  'أحدث إعلاناتك': 'Your latest campaigns',
  'راقب أداء المحتوى المنشور مؤخراً': 'Track recently published content',
  'مقارنة المشاهدات المكتملة بالأسبوع السابق': 'Completed views compared with the previous week',
  'معدل التحويل': 'Conversion rate',
  'الرصيد الذي يمكنك استخدامه لتمويل إعلاناتك. ستظهر الإيداعات بعد التحقق التلقائي.': 'The balance available to fund your campaigns. Deposits appear after automatic verification.',
};

const dynamicTranslations: Array<[RegExp, (match: RegExpExecArray) => string]> = [
  [/^(\d+) ث$/, (match) => `${match[1]} sec`],
  [/^(\d+) ثانية$/, (match) => `${match[1]} seconds`],
  [/^فيديو (\d+)$/, (match) => `Video ${match[1]}`],
  [/^ادفع (.+) دولار عبر Telegram Stars$/, (match) => `Pay ${match[1]} USD with Stars`],
  [/^ادفع (.+) دولار عبر Stars$/, (match) => `Pay ${match[1]} USD with Stars`],
  [/^أرسل (.+) USDT إلى العنوان التالي$/, (match) => `Send ${match[1]} USDT to this address`],
  [/^في انتظار تأكيد الدفع · تنتهي خلال (.+)$/, (match) => `Awaiting payment confirmation · expires in ${match[1]}`],
  [/^تم تأكيد دفع Telegram Stars وإضافة الإيداع\.$/, () => 'Stars payment confirmed and deposit added.'],
  [/^انتهت الفاتورة قبل وصول الدفع\.$/, () => 'The invoice expired before payment arrived.'],
  [/^اضغط زر الدفع أسفل الفاتورة لإكمال الدفع داخل Telegram\.$/, () => 'Use the payment button below to complete payment in Telegram.'],
  [/^كل 1 دولار = 100 نجمة\. سيدفع المستخدم (.+) نجمة عبر Telegram\.$/, (match) => `1 USD = 100 Stars. You will pay ${match[1]} Stars through Telegram.`],
  [/^المعرّف الداخلي (.+) · Memo \/ Tag (.+)$/, (match) => `Internal ID ${match[1]} · Memo / Tag ${match[2]}`],
  [/^تمت إضافة (.+) USDT إلى رصيد المعلن\.$/, (match) => `${match[1]} USDT was added to the advertiser balance.`],
  [/^تم إنشاء طلب السحب بقيمة (.+) USDT\. الحالة: قيد المعالجة\.$/, (match) => `Withdrawal request for ${match[1]} USDT created. Status: processing.`],
  [/^تم إرسال طلب السحب$/, () => 'Withdrawal request sent'],
  [/^جاري إنشاء الفاتورة\.\.\.$/, () => 'Creating invoice...'],
  [/^المتاح: (.+)$/, (match) => `Available: ${match[1]}`],
  [/^(\d+) فيديو متاح$/, (match) => `${match[1]} video available`],
  [/^(\d+) فيديو متاح الآن$/, (match) => `${match[1]} videos available now`],
  [/^عرض (\d+) من (\d+) فيديوهات$/, (match) => `Showing ${match[1]} of ${match[2]} videos`],
  [/^(\d+) عمليات$/, (match) => `${match[1]} transactions`],
  [/^(\d+) طلبات$/, (match) => `${match[1]} requests`],
  [/^حساب (.+)$/, (match) => `Account ${match[1]}`],
  [/^صورة إثبات (\d+)$/, (match) => `Proof image ${match[1]}`],
  [/^حذف صورة إثبات (\d+)$/, (match) => `Delete proof image ${match[1]}`],
  [/^أضيف الطلب (.+) إلى سجل السحب بحالة قيد المعالجة\.$/, (match) => `Withdrawal request ${match[1]} was added to history with a processing status.`],
  [/^أضيفت (.+) إلى رصيدك بعد إكمال المدة المطلوبة\.$/, (match) => `${match[1]} was added to your balance after completing the required duration.`],
  [/^تمت إضافة (.+) USDT إلى رصيد المعلن\.$/, (match) => `${match[1]} USDT was added to the advertiser balance.`],
  [/^توقفت المشاهدة قبل إكمال المدة المطلوبة، ولم تُحتسب المكافأة\.$/, () => 'Viewing stopped before the required duration was completed, so the reward was not counted.'],
  [/^تمت استعادة تقدم المشاهدة دون مكافأة\. أكمل المدة المطلوبة ثم تحقق\.$/, () => 'Viewing progress was restored without a reward. Complete the required duration, then verify.'],
  [/^لم يصل تحويل مؤكد قبل انتهاء مدة الفاتورة\.$/, () => 'No confirmed transfer arrived before the invoice expired.'],
];

const fragmentTranslations: Record<string, string> = {
  'إدارة الإعلانات': 'Ad management',
  'صباح الخير': 'Good morning',
  'زائر': 'Guest',
  'محمد': 'Mohammed',
  'محمد العتيبي': 'Mohammed Alotaibi',
  'سارة العتيبي': 'Sarah Alotaibi',
  'محمود ناصر': 'Mahmoud Nasser',
  'نوف الحربي': 'Nouf Alharbi',
  'ستوديو عدسة': 'Lens Studio',
  'كيف صنعت أول منتج رقمي لي؟': 'How I built my first digital product',
  'جولة صباحية في استوديو التصميم': 'A morning tour of a design studio',
  'ثلاث أفكار لتطوير عاداتك': 'Three ideas for better habits',
  'دليل المبتدئين إلى التصوير بالهاتف': 'A beginner guide to phone photography',
  'منذ يومين': '2 days ago',
  'منذ 4 أيام': '4 days ago',
  'منذ أسبوع': '1 week ago',
  'منذ 9 أيام': '9 days ago',
  'الآن': 'Now',
  'اليوم، 10:12 ص': 'Today, 10:12 AM',
  'أمس، 08:20 م': 'Yesterday, 08:20 PM',
  '18 سبتمبر، 04:36 م': 'Sep 18, 04:36 PM',
  '14 سبتمبر، 01:05 م': 'Sep 14, 01:05 PM',
  '10 سبتمبر، 11:40 ص': 'Sep 10, 11:40 AM',
  '10 ثوانٍ': '10 seconds',
  '20 ثانية': '20 seconds',
  '40 ثانية': '40 seconds',
  '80 ثانية': '80 seconds',
  'مساحة الربح': 'Earning space',
  'إرشادات المشاهدة': 'Watch guidance',
  'إغلاق التنبيه': 'Dismiss notification',
  'إغلاق المشاهدة': 'Close watch session',
  'إغلاق خلفية القائمة': 'Close menu backdrop',
  'إعلاناتي': 'My campaigns',
  'إعلان جديد': 'New campaign',
  'إضافة إعلان جديد': 'Add new campaign',
  'أضف إعلان جديد': 'Add new campaign',
  'أضف إعلاناً جديداً وحدد ميزانيته.': 'Add a new campaign and set its budget.',
  'أضف إعلانك الأول': 'Add your first campaign',
  'أضف إعلان الآن': 'Add campaign now',
  'إجمالي المشاهدات': 'Total views',
  'إجمالي الإنفاق الإعلاني': 'Total ad spend',
  'إجمالي الإنفاق': 'Total spend',
  'مشاهدون جدد': 'New viewers',
  'متوسط الإكمال': 'Average completion',
  'رصيد المعلن': 'Advertiser balance',
  'رصيد الإعلانات': 'Campaign balance',
  'متاح لتمويل الحملات': 'Available for campaign funding',
  'متاح لتمويل الحملات القادمة': 'Available for upcoming campaigns',
  'الإنفاق على الإعلانات': 'Ad spend',
  'منذ بداية الشهر': 'Since the start of the month',
  'أحدث إعلاناتك': 'Your latest campaigns',
  'راقب أداء المحتوى المنشور مؤخراً': 'Track recently published content',
  'الأداء هذا الشهر': 'Performance this month',
  'أداء هذا الشهر': 'This month’s performance',
  'خطواتك التالية': 'Your next steps',
  'أكمل هذه الخطوات لتحصل على أفضل نتيجة.': 'Complete these steps for the best result.',
  'ملخص الإنفاق': 'Spend summary',
  'إكمالات الفيديو': 'Video completions',
  'معدل التحويل': 'Conversion rate',
  'عرض الكل': 'View all',
  'الكل': 'All',
  'نشطة': 'Active',
  'مسودات': 'Drafts',
  'نشط': 'Active',
  'مسودة': 'Draft',
  'مكتمل': 'Completed',
  'فيديوهات متاحة': 'Available videos',
  'إجمالي المكافآت': 'Total rewards',
  'رصيدك القابل للسحب': 'Withdrawable balance',
  'اربح من وقتك': 'Earn from your time',
  'شاهد ما تحب،': 'Watch what you love,',
  'واكسب مقابل وقتك.': 'and earn for your time.',
  'أكمل المدة المطلوبة، واحصل على رصيدك مباشرة. لا تعقيد، فقط محتوى يستحق وقتك.': 'Complete the required time and receive your balance directly. No complexity, just content worth your time.',
  'أرباح موثوقة': 'Trusted rewards',
  'مدد واضحة': 'Clear durations',
  'الفيديوهات المتاحة': 'Available videos',
  'كل مشاهدة مكتملة تضيف إلى رصيدك': 'Every completed view adds to your balance',
  'فيديو متاح الآن': 'video available now',
  'لا توجد فيديوهات جديدة الآن': 'No new videos right now',
  'ستظهر هنا الفيديوهات التي لم تشاهدها بعد.': 'Videos you have not watched yet will appear here.',
  'الفيديوهات الجديدة للمشاهدة حاليًا.': 'new videos available to watch.',
  'أنت في صفحة المشاهدة': 'You are on the watch page',
  'اختر فيديو لبدء جلسة مشاهدة موثقة': 'Choose a video to start a verified watch session',
  'آمنة': 'Secure',
  'شاهد واربح من المتصفح': 'Watch and earn in your browser',
  'مشغلات YouTube لا تظهر داخل Telegram. افتح صفحة المشاهدة في المتصفح لمشاهدة الفيديوهات مباشرةً دون قوائم التطبيق.': 'YouTube players are not shown inside Telegram. Open the watch page in your browser to watch videos directly.',
  'اذهب للمتصفح للمشاهدة والربح': 'Open browser to watch and earn',
  'لا توجد فيديوهات جديدة للمشاهدة حاليًا.': 'No new videos are available right now.',
  'ستفتح صفحة مشاهدة مستقلة تعرض الفيديو المختار فقط.': 'A dedicated watch page will open with only the selected video.',
  'سحب الأرباح': 'Withdraw earnings',
  'اختر Binance ID أو محفظة Web3 لاستلام أرباحك، ثم أرسل الطلب للمراجعة.': 'Choose a Binance ID or Web3 wallet for your earnings, then submit the request for review.',
  'الحد الأدنى للسحب 1 USDT. يتم خصم الرصيد عند إرسال الطلب للمراجعة.': 'The minimum withdrawal is 1 USDT. Your balance is deducted when the request is submitted.',
  'تحويل آمن': 'Secure transfer',
  'تحويلات Binance سريعة وواضحة': 'Fast, clear Binance transfers',
  'يتم حفظ الطلب في سجل السحب بحالة قيد المعالجة.': 'The request is saved in withdrawal history as processing.',
  'ستظهر العملية في سجل السحب بحالة قيد المعالجة، ولا يمكن إلغاؤها بعد بدء التحويل.': 'The transaction will appear in withdrawal history as processing and cannot be cancelled once transfer begins.',
  'سجل الإيداع': 'Deposit history',
  'سجل السحب': 'Withdrawal history',
  'تابع عمليات تمويل الإعلانات بسرعة ووضوح.': 'Track campaign funding quickly and clearly.',
  'كل طلبات سحب الأرباح في عرض سريع ومنظم.': 'All earnings withdrawal requests in one organized view.',
  'المبلغ · الطريقة · الوجهة · الحالة': 'Amount · method · destination · status',
  'طلبات السحب': 'Withdrawal requests',
  'ستظهر هنا كل فاتورة تمويل مع طريقة الدفع وحالة التحقق.': 'Every funding invoice appears here with its method and verification status.',
  'ستظهر هنا طلبات السحب مع وجهتها وحالة التحويل.': 'Withdrawal requests appear here with their destination and transfer status.',
  'نشر إعلان / إعلان جديد': 'Publish ad / New campaign',
  'انشر إعلانك': 'Publish your campaign',
  'تفاصيل الفيديو': 'Video details',
  'أخبر المشاهدين لماذا يستحق هذا الفيديو وقتهم.': 'Tell viewers why this video is worth their time.',
  'عنوان الفيديو': 'Video title',
  '12 حرفًا كحد أقصى': '12 characters maximum',
  'رابط الفيديو': 'Video link',
  'المدة الإلزامية للمشاهدة': 'Required watch duration',
  'اختر الوقت الذي سيكمله المشاهد قبل احتساب المكافأة.': 'Choose the time viewers must complete before the reward is counted.',
  'تكلفة الألف مشاهدة (CPM)': 'Cost per thousand views (CPM)',
  'كلما زادت المدة،': 'The longer the duration,',
  'زادت جودة التفاعل': 'the stronger the engagement',
  'نشر الإعلان': 'Publish campaign',
  'المعاينة المباشرة': 'Live preview',
  'هكذا سيظهر الفيديو للمشاهدين.': 'This is how the video will appear to viewers.',
  'مباشر': 'Live',
  'ستظهر المعاينة هنا': 'Preview will appear here',
  'عنوان الفيديو سيظهر هنا': 'Video title will appear here',
  'روابط مدعومة': 'Supported links',
  'يمكنك استخدام روابط YouTube أو أي رابط فيديو مباشر قابل للتشغيل.': 'You can use YouTube links or any playable direct video link.',
  'تم النشر بنجاح': 'Published successfully',
  'فيديوك جاهز للوصول إلى جمهور جديد': 'Your video is ready to reach a new audience',
  'أصبح الفيديو نشطاً الآن. سيظهر للمشاهدين الذين يبحثون عن محتوى جديد مع مكافآت عادلة.': 'Your video is active now and will appear to viewers looking for fresh content with fair rewards.',
  'العودة إلى لوحة التحكم': 'Back to dashboard',
  'إضافة إعلان آخر': 'Add another campaign',
  'المكافأة المتوقعة': 'Expected reward',
  'حالة المشاهدة': 'Watch status',
  'افتح الفيديو أولاً': 'Open the video first',
  'الفيديو مفتوح — الوقت يُحتسب': 'Video open — time is counting',
  'اكتملت المدة — جاهز للتحقق': 'Duration complete — ready to verify',
  'المدة غير مكتملة': 'Duration incomplete',
  'تحقق بعد إكمال مدة المشاهدة': 'Verify after completing the watch duration',
  'لم تكتمل المدة بعد. ارجع إلى الفيديو وأكمل الوقت المطلوب؛ لن تُصرف المكافأة قبل إكماله.': 'The duration is not complete. Return to the video and finish the required time; the reward is not released before completion.',
  'يُحتسب الوقت أثناء وجود التطبيق بالخلفية، وتُصرف المكافأة بعد العودة والتحقق.': 'Time counts while the app is in the background; the reward is released after you return and verify.',
  'أحسنت، تمت المشاهدة': 'Great, viewing completed',
  'أضيفت الأرباح إلى رصيدك بنجاح.': 'The reward was added to your balance.',
  'معاينة الفيديو': 'Video preview',
  'المدة المطلوبة': 'Required duration',
  'سيتم احتساب المكافأة بعد إكمال المشاهدة دون تخطي.': 'The reward is counted after completing the view without skipping.',
  'إجمالي العمليات': 'Total transactions',
  'الإيداعات المكتملة': 'Completed deposits',
  'قيد المراجعة': 'Under review',
  'تم تحويله': 'Transferred',
  'تم إرسال طلب السحب': 'Withdrawal request sent',
  'تم نشر الإعلان': 'Campaign published',
  'إعلان غير مكتمل': 'Campaign incomplete',
  'لا توجد إعلانات هنا بعد': 'No campaigns here yet',
  'ابدأ بإضافة إعلان جديد وامنح المشاهدين تجربة تستحق وقتهم.': 'Add a campaign and give viewers an experience worth their time.',
  'إضافة أول إعلان': 'Add first campaign',
  'عرض': 'Showing',
  'فيديوهات': 'videos',
  'فيديو': 'Video',
  'لكل إكمال': 'per completion',
  'المتاح:': 'Available:',
  'مثال: كيف تبدأ مشروعك من الصفر؟': 'Example: How do you start a business from scratch?',
  'مثال: 782946315': 'Example: 782946315',
  'أدخل Binance ID رقميًا فقط (3 إلى 20 رقمًا).': 'Enter a numeric Binance ID only (3 to 20 digits).',
  'أدخل عنوان Polygon صحيحاً مكوناً من 42 رمزاً.': 'Enter a valid 42-character Polygon address.',
  'نسخ وجهة الإيداع': 'Copy deposit destination',
  'نسخ Memo Tag': 'Copy memo tag',
  'نسخ ': 'Copy ',
  'الوجهة · Binance ID': 'Destination · Binance ID',
  'نوع Memo': 'Memo type',
  'TXID الشبكة': 'Network TXID',
  'بعد التأكيد': 'After confirmation',
  'مشاهدة الفيديو': 'Watch video',
  'صفحة فيديو مستقلة للمتصفح': 'Standalone browser video page',
  'تعذّر العثور على فيديو YouTube': 'Could not find the YouTube video',
  'ارجع إلى VidReward واختر فيديو YouTube نشطًا ثم افتحه في المتصفح.': 'Return to VidReward, choose an active YouTube video, and open it in the browser.',
  'المكافأة المعروضة:': 'Displayed reward:',
  'فتح في YouTube': 'Open in YouTube',
  'يمكنك مشاهدة هذا الفيديو هنا مباشرةً. بيانات Telegram المعروضة في الصفحة للتعريف فقط، ولا تُستخدم لتأكيد الهوية أو صرف الأرباح.': 'You can watch this video here directly. Telegram details are shown for identification only and are not used to verify identity or release rewards.',
  'محفظة Binance': 'Binance wallet',
  'رصيد بالدولار': 'Dollar balance',
  'نظام النشر': 'Publishing system',
  'أكمل المشاهدة وأضف الأرباح إلى رصيدك.': 'Complete the viewing and add the rewards to your balance.',
  'خيارات الإعلان': 'Campaign options',
  'هذه لمحة سريعة عن أثر إعلاناتك اليوم.': 'Here is a quick look at your campaign impact today.',
  'ملخص أرباح المشاهدة': 'Viewing rewards summary',
  'بصراحة تجربة VidReward عجبتني 😄 بدأت أشاهد فيديوهات قصيرة في وقت فراغي، وكل مشاهدة مكتملة تضيف لي مكافأة على رصيدي 💸': 'Honestly, I have been enjoying VidReward 😄 I started watching short videos in my free time, and every completed view adds a reward to my balance 💸',
  'والأجمل أنني أربح 20% من أرباح أي شخص يدخل عن طريق رابط الإحالة الخاص بي. إذا تحب تجربها وتربح من وقتك، ادخل من هنا 👇': 'Even better, I earn 20% of the rewards of anyone who joins through my referral link. If you want to try it and earn from your time, join here 👇',
  'بانتظار مراجعة فريق الإدارة': 'Waiting for the admin team review',
  'تمت الموافقة': 'Approved',
  'تم اعتماد المهمة وإضافة المكافأة': 'Task approved and reward added',
  'تحتاج إلى تعديل': 'Needs changes',
  'راجع الإثبات وأرسله مرة أخرى': 'Review the proof and submit it again',
  'مساحة المشاركة': 'Sharing space',
  'انشر تجربتك، استخدم رابطك الشخصي، واحصل على مكافأتك اليومية بالإضافة إلى 20% من أرباح المستخدمين الذين دعوتهم.': 'Share your experience, use your personal link, and earn your daily reward plus 20% of the rewards earned by users you invited.',
  'المكافأة اليومية': 'Daily reward',
  'متاحة اليوم': 'Available today',
  'مهمتك اليوم': 'Your task today',
  'أكمل خطوات بسيطة لاستلام المكافأة': 'Complete a few simple steps to claim the reward',
  'إثباتات النشر اليوم': 'Today’s publishing proofs',
  'ارفع صورًا من أي منصة نشرت فيها، حتى 5 صور في طلب واحد.': 'Upload images from any platform where you published, up to 5 images in one request.',
  'دليل سريع': 'Quick guide',
  'كيف تحصل على المكافأة؟': 'How do you get the reward?',
  'انسخ المنشور والرابط، انشرهما في مكان مناسب، ثم أرفق صورًا واضحة من النشر ليتم التحقق من المهمة.': 'Copy the post and link, share them in a suitable place, then attach clear proof images so the task can be verified.',
  'انسخ': 'Copy',
  'المنشور والرابط': 'the post and link',
  'انشر': 'Share',
  'في مجتمع مناسب': 'in a suitable community',
  'أثبت': 'Prove it',
  'وأرسل للمراجعة': 'and submit for review',
  'برنامج الإحالة': 'Referral program',
  'اربح من كل مستخدم يدخل من رابطك': 'Earn from every user who joins through your link',
  'كل مستخدم جديد يسجل عبر رابط الإحالة الخاص بك يمنحك 20% من أرباحه وفق نظام VidReward. شارك الرابط مع أصدقائك ومجتمعاتك وتابع نتيجتك هنا.': 'Every new user who registers through your referral link gives you 20% of their rewards through VidReward. Share the link with friends and communities and track your results here.',
  'نسبة الإحالة': 'Referral rate',
  'المستخدمون المدعوون': 'Invited users',
  'ربح الإحالات': 'Referral earnings',
  'رابط الإحالة الخاص بك': 'Your referral link',
  'تم نسخ الرابط': 'Link copied',
  'نسخ الرابط': 'Copy link',
  'منشور ترويجي جاهز': 'Ready promotional post',
  'نص بسيط وطبيعي للمشاركة مع رابطك المباشر': 'A simple, natural post to share with your direct link',
  'تم النسخ': 'Copied',
  'نسخ المنشور': 'Copy post',
  'صور إثباتات': 'Proof images',
  'اجمع صور Telegram وFacebook وأي منصة أخرى في طلب واحد': 'Collect Telegram, Facebook, and any other platform images in one request',
  'أضف صور إثباتات النشر': 'Add publishing proof images',
  'يمكنك إضافة حتى 5 صور واضحة من نفس المهمة.': 'You can add up to 5 clear images from the same task.',
  'إضافة صورة': 'Add image',
  'صور الإثبات المضافة': 'Added proof images',
  'لم تتم إضافة صور بعد — ارفع لقطة شاشة يظهر فيها المنشور بوضوح.': 'No images added yet — upload a screenshot that clearly shows the post.',
  'إرسال للمراجعة': 'Submit for review',
  'حالة المهمة الحالية': 'Current task status',
  'سجل المهام': 'Task history',
  'آخر عمليات النشر التجريبية': 'Latest test publishing activity',
  'نشر تجريبي': 'Test publishing',
  'جلسة مشاهدة موثقة': 'Verified viewing session',
  'افتح الفيديو على YouTube ثم عد إلى هنا لإكمال التحقق.': 'Open the video on YouTube, then return here to complete verification.',
  'مشاهدة فيديو آخر': 'Watch another video',
  'تقدم المشاهدة': 'Viewing progress',
  'العودة': 'Back',
  'الرصيد الذي يمكنك استخدامه لتمويل إعلاناتك. ستظهر الإيداعات بعد التحقق التلقائي.': 'The balance available to fund your campaigns. Deposits appear after automatic verification.',
  'مساحة الربح / السحب': 'Earning space / Withdrawal',
  'الرصيد المتاح': 'Available balance',
  'أرسل الأرباح إلى Binance ID مباشرة دون استخدام عنوان محفظة.': 'Send earnings directly to a Binance ID without using a wallet address.',
  'استخدم عنوانًا صحيحًا على شبكة Polygon (USDT).': 'Use a valid address on the Polygon network (USDT).',
  'بيانات الاستلام': 'Receiving details',
  'المبلغ (USDT)': 'Amount (USDT)',
  'راجع البيانات قبل الإرسال': 'Review the details before submitting',
  'إرسال طلب السحب': 'Submit withdrawal request',
  'عمليات الإيداع': 'Deposit transactions',
  'لا توجد عمليات إيداع بعد': 'No deposit transactions yet',
  'مساحة الربح / سجل السحب': 'Earning space / Withdrawal history',
  'لا توجد طلبات سحب بعد': 'No withdrawal requests yet',
  'توقفت المشاهدة قبل إكمال المدة المطلوبة، ولم تُحتسب المكافأة.': 'Viewing stopped before the required duration was completed, so the reward was not counted.',
  'تمت استعادة تقدم المشاهدة دون مكافأة. أكمل المدة المطلوبة ثم تحقق.': 'Viewing progress was restored without a reward. Complete the required duration, then verify.',
  'أصبح الفيديو نشطًا ويمكن للمشاهدين اكتشافه الآن.': 'The video is active and viewers can discover it now.',
};

export function translateText(value: string, language: Language): string {
  if (language === 'ar' || !value.trim()) return value;
  const trimmed = value.trim();
  if (exactTranslations[trimmed]) {
    return value.replace(trimmed, exactTranslations[trimmed]);
  }
  for (const [pattern, translate] of dynamicTranslations) {
    const match = pattern.exec(trimmed);
    if (match) return value.replace(trimmed, translate(match));
  }
  let translated = value
    .replaceAll('Telegram Stars', 'Stars')
    .replaceAll(' عبر Telegram', ' through Telegram')
    .replaceAll('نجمة', 'Stars')
    .replaceAll('نجوم', 'Stars');
  Object.entries(fragmentTranslations)
    .sort(([left], [right]) => right.length - left.length)
    .forEach(([arabic, english]) => {
      translated = translated.replaceAll(arabic, english);
    });
  return translated;
}

type LanguageContextValue = {
  language: Language;
  dir: 'rtl' | 'ltr';
  isArabic: boolean;
  t: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => getBrowserLanguage());
  const value = useMemo<LanguageContextValue>(() => ({
    language,
    dir: language === 'ar' ? 'rtl' : 'ltr',
    isArabic: language === 'ar',
    t: (text: string) => translateText(text, language),
  }), [language]);

  useEffect(() => {
    const syncBrowserLanguage = () => {
      const nextLanguage = getBrowserLanguage();
      setLanguage((currentLanguage) => currentLanguage === nextLanguage ? currentLanguage : nextLanguage);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncBrowserLanguage();
    };

    window.addEventListener('languagechange', syncBrowserLanguage);
    window.addEventListener('focus', syncBrowserLanguage);
    window.addEventListener('pageshow', syncBrowserLanguage);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const languagePoll = window.setInterval(syncBrowserLanguage, 1000);

    return () => {
      window.removeEventListener('languagechange', syncBrowserLanguage);
      window.removeEventListener('focus', syncBrowserLanguage);
      window.removeEventListener('pageshow', syncBrowserLanguage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(languagePoll);
    };
  }, []);

  useEffect(() => {
    const originalText = new WeakMap<Text, string>();
    const lastRenderedText = new WeakMap<Text, string>();
    const originalAttributes = new WeakMap<HTMLElement, Map<string, string>>();
    const lastRenderedAttributes = new WeakMap<HTMLElement, Map<string, string>>();

    const applyLanguage = () => {
      document.documentElement.lang = language;
      document.documentElement.dir = value.dir;
      document.documentElement.style.direction = value.dir;
      document.documentElement.dataset.language = language;
      document.documentElement.classList.toggle('language-en', language === 'en');
      document.querySelectorAll<HTMLElement>('[dir]').forEach((element) => {
        const originalDir = element.dataset.vidrewardOriginalDir ?? element.getAttribute('dir');
        if (originalDir) element.dataset.vidrewardOriginalDir = originalDir;
        if (originalDir === 'rtl') element.dir = value.dir;
      });
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let node: Node | null = walker.nextNode();
      while (node) {
        if (node.parentElement && !['SCRIPT', 'STYLE', 'CODE'].includes(node.parentElement.tagName)) {
          nodes.push(node as Text);
        }
        node = walker.nextNode();
      }
      nodes.forEach((textNode) => {
        const current = textNode.nodeValue ?? '';
        const lastRendered = lastRenderedText.get(textNode);
        const source = lastRendered === undefined || current !== lastRendered
          ? current
          : originalText.get(textNode) ?? current;
        originalText.set(textNode, source);
        const translated = translateText(source, language);
        lastRenderedText.set(textNode, translated);
        if (translated !== current) textNode.nodeValue = translated;
      });
      document.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder],[alt]').forEach((element) => {
        const sourceAttributes = originalAttributes.get(element) ?? new Map<string, string>();
        const renderedAttributes = lastRenderedAttributes.get(element) ?? new Map<string, string>();
        ['aria-label', 'title', 'placeholder', 'alt'].forEach((attribute) => {
          const current = element.getAttribute(attribute);
          if (!current) return;
          const lastRendered = renderedAttributes.get(attribute);
          const source = lastRendered === undefined || current !== lastRendered
            ? current
            : sourceAttributes.get(attribute) ?? current;
          sourceAttributes.set(attribute, source);
          const translated = translateText(source, language);
          renderedAttributes.set(attribute, translated);
          if (translated !== current) element.setAttribute(attribute, translated);
        });
        originalAttributes.set(element, sourceAttributes);
        lastRenderedAttributes.set(element, renderedAttributes);
      });
    };
    applyLanguage();
    const observer = new MutationObserver(applyLanguage);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder', 'alt'] });
    return () => observer.disconnect();
  }, [language, value.dir]);

  return createElement(LanguageContext.Provider, { value }, children);
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}