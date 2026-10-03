import { Children, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Activity, AlertTriangle, Check, CircleDollarSign, Code2, Copy, Eye, ImagePlus, Megaphone, Music2, Pencil, Search, Send, Settings2, ShieldCheck, Trash2, Users, Wallet, X, Youtube } from 'lucide-react';

type User = { id: number; name: string; username: string; avatar: string; advertiserBalance: number; earnedBalance: number; status: 'نشط' | 'محظور'; bannedBySystem?: boolean; joinedAt: string; lastLogin: string; lastActive: string; invitedBy: string };
type Row = { id: string; userId?: number; amount?: number; createdAt?: string; status?: string; [key: string]: any };
type State = { users: User[]; deposits: Row[]; withdrawals: Row[]; campaigns: Row[]; proofs: Row[]; ads: Row[]; suspicious: Row[]; settings: Record<string, any>; reports: Row[] };
type PricingPlatform = 'youtube' | 'tiktok' | 'telegram';
type PricingOption = { id: string; platform: PricingPlatform; quantity: number; price: number };
const pricingSeed: PricingOption[] = [
 { id:'yt-10', platform:'youtube', quantity:10, price:1.5 },
 { id:'yt-20', platform:'youtube', quantity:20, price:2 },
 { id:'yt-40', platform:'youtube', quantity:40, price:2.8 },
 { id:'yt-80', platform:'youtube', quantity:80, price:3.2 },
 { id:'tt-100', platform:'tiktok', quantity:100, price:2 },
 { id:'tt-200', platform:'tiktok', quantity:200, price:3.9 },
 { id:'tt-350', platform:'tiktok', quantity:350, price:5.5 },
 { id:'tt-500', platform:'tiktok', quantity:500, price:7 },
 { id:'tg-100', platform:'telegram', quantity:100, price:0.7 },
 { id:'tg-300', platform:'telegram', quantity:300, price:1.9 },
 { id:'tg-500', platform:'telegram', quantity:500, price:2.6 },
 { id:'tg-700', platform:'telegram', quantity:700, price:3 },
];
const KEY = 'vidreward.admin.preview.v1';
const proofMock = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="100%" height="100%" fill="#e9eef8"/><rect x="120" y="72" width="560" height="356" rx="28" fill="#fff"/><rect x="155" y="112" width="84" height="84" rx="24" fill="#edf3ff"/><path d="M179 154h36M197 136v36" stroke="#1557ee" stroke-width="8" stroke-linecap="round"/><rect x="268" y="118" width="340" height="16" rx="8" fill="#d8e1f2"/><rect x="268" y="150" width="240" height="12" rx="6" fill="#e9eef8"/><rect x="155" y="238" width="450" height="20" rx="10" fill="#e9eef8"/><rect x="155" y="276" width="390" height="20" rx="10" fill="#e9eef8"/><rect x="155" y="344" width="156" height="42" rx="12" fill="#1557ee"/><text x="333" y="371" font-family="sans-serif" font-size="17" fill="#52627e">DEMO PROOF IMAGE</text></svg>')}`;
const seed: State = {
 users: [
  { id: 610241, name: 'ليان السالمي', username: 'layan_demo', avatar: 'لس', advertiserBalance: 18.5, earnedBalance: 2.38, status: 'نشط', joinedAt: '2025-02-11', lastLogin: '2025-03-08 09:42', lastActive: 'قبل 4 دقائق', invitedBy: '—' },
  { id: 610258, name: 'عمر الراشد', username: 'omar_sample', avatar: 'عر', advertiserBalance: 0, earnedBalance: 0.74, status: 'نشط', joinedAt: '2025-02-18', lastLogin: '2025-03-08 08:16', lastActive: 'قبل 22 دقيقة', invitedBy: '610241' },
  { id: 610309, name: 'نور حمدان', username: 'nour_demo', avatar: 'نح', advertiserBalance: 43, earnedBalance: 5.12, status: 'نشط', joinedAt: '2025-02-26', lastLogin: '2025-03-07 19:30', lastActive: 'أمس', invitedBy: '610258' },
  { id: 610411, name: 'سامي فؤاد', username: 'sami_preview', avatar: 'سف', advertiserBalance: 2.2, earnedBalance: 0.16, status: 'محظور', bannedBySystem: true, joinedAt: '2025-03-01', lastLogin: '2025-03-06 12:01', lastActive: 'منذ يومين', invitedBy: '—' },
 ],
 deposits: [
  { id: 'DEP-4821', userId: 610241, method: 'Stars', amount: 12, createdAt: '2025-03-08 09:14', memoTag: 'VR-610241-A', txId: 'TG-ST-89021', status: 'ناجح' },
  { id: 'DEP-4818', userId: 610309, method: 'USDT', amount: 31, createdAt: '2025-03-07 17:05', memoTag: 'VR-610309-B', wallet: '0x81…b029', txId: '0xa21f…', status: 'فاشل', reason: 'لم يصل التحويل إلى الشبكة المحددة', balanceBefore: 43 },
 ],
 withdrawals: [
  { id: 'WDR-2064', userId: 610258, amount: 1.24, method: 'Binance', destination: '684291037', memoTag: 'vr-omar', createdAt: '2025-03-08 08:50', status: 'قيد المراجعة' },
  { id: 'WDR-2059', userId: 610309, amount: 3.5, method: 'Web3', destination: '0x901c...7d4e', memoTag: 'Polygon', createdAt: '2025-03-07 11:34', status: 'قيد المراجعة' },
 ],
 campaigns: [
  { id: 'CMP-094', userId: 610241, title: 'أدوات العمل عن بعد', platform: 'YouTube', videoUrl: 'https://www.youtube.com/embed/aqz-KE-bpKQ', duration: 40, budget: 32, views: 840, status: 'بانتظار المراجعة' },
  { id: 'CMP-091', userId: 610309, title: 'مراجعة تطبيقات السفر', platform: 'TikTok', videoUrl: 'https://www.youtube.com/embed/ScMzIvxBSi4', duration: 20, budget: 18, views: 1260, status: 'نشطة' },
  { id: 'CMP-088', userId: 610258, title: 'دليل التطبيقات اليومية', platform: 'YouTube', videoUrl: 'https://www.youtube.com/embed/aqz-KE-bpKQ', duration: 40, budget: 7, views: 350, status: 'أوقفتها الميزانية', spent: 7 },
 ],
 proofs: [
  { id: 'PRF-318', userId: 610258, taskId: 'TASK-TG-41', taskType: 'اشتراك قناة', image: proofMock, reward: 0.003, status: 'قيد المراجعة' },
  { id: 'PRF-312', userId: 610411, taskId: 'TASK-TT-09', taskType: 'متابعة TikTok', image: proofMock, reward: 0.003, status: 'قيد المراجعة' },
 ],
 ads: [{ id: 'AD-01', format: 'social', code: '<div class="vr-social">Social placement · demo</div>', enabled: true, updatedAt: '2025-03-06' }, { id: 'AD-02', format: '320x50', code: '<div class="vr-banner">320 × 50 · demo placement</div>', enabled: false, updatedAt: '2025-03-04' }],
 suspicious: [{ id: 'SIG-118', userId: 610411, attempt: 'رصد أدوات المطور + مشاهدة أسرع من المدة المطلوبة', createdAt: '2025-03-08 08:20', status: 'مفتوح' }, { id: 'SIG-112', userId: 610258, attempt: 'عدة حسابات على الجهاز نفسه', createdAt: '2025-03-07 15:10', status: 'مفتوح' }, { id: 'SIG-107', userId: 610309, attempt: 'تلاعب في DOM', createdAt: '2025-03-06 10:22', status: 'تمت المراجعة' }],
 settings: { binanceWithdrawMin: 1, web3WithdrawMin: 2, starsDepositMin: 1, web3DepositMin: 5, userShare: 20, platformShare: 10, durationMin: 10, durationMax: 80, cpmMin: 1.5, cpmMax: 4, telegramCpm: 2.2, tiktokCpm: 2.8, taskReward: 0.003, tiktokTaskReward: 0.003, web3Address: '0x0000...preview', maintenance: false },
 reports: [],
};
const labels: Record<string, string> = { overview:'نظرة عامة', users:'مستخدمو Telegram', deposits:'الإيداعات', withdrawals:'السحوبات', campaigns:'الحملات', proofs:'إثباتات المهام', ads:'مخزون Adstera', settings:'الإعدادات', notifications:'الإشعارات', suspicious:'مستخدمون مشبوهون' };
const cx = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(' ');
const cell = 'px-3 py-3 text-right align-middle';
const btn = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1557ee]/35 disabled:opacity-40';
const primary = `${btn} bg-[#1557ee] text-white`;
const soft = `${btn} border border-[#dfe5ee] bg-white text-slate-700 hover:bg-[#f7f9fc]`;
function getState(): State { try { const s = localStorage.getItem(KEY); if (!s) return seed; const stored=JSON.parse(s) as Partial<State>; const campaigns=stored.campaigns??seed.campaigns; return { ...seed, ...stored, campaigns:[...campaigns,...seed.campaigns.filter(c=>!campaigns.some(existing=>existing.id===c.id))], settings:{...seed.settings,...stored.settings} }; } catch { return seed; } }
function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className="grid min-w-0 gap-1.5 text-xs font-bold text-[#46546b]">{label}<input {...props} className={cx('min-h-11 w-full min-w-0 rounded-xl border border-[#dce3ed] bg-[#fbfcfe] px-3 py-2.5 text-sm font-medium text-[#12234b] outline-none transition-shadow placeholder:text-slate-400 focus:border-[#1557ee] focus:ring-4 focus:ring-[#1557ee]/10', props.className)} /></label>; }
function Badge({ children }: { children: React.ReactNode }) { const good = ['نشط','ناجح','معتمد','مفعّل','تمت المراجعة'].includes(String(children)); const bad = ['محظور','فاشل','مرفوض','موقوف'].includes(String(children)); return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${good?'bg-emerald-50 text-emerald-700':bad?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700'}`}>{children}</span>; }

export function AdminConsole({ activeScreen, onPageChange }: { activeScreen: string; onPageChange: (page: string) => void }) {
 const [data, setData] = useState<State>(getState);
 const [page, setPage] = useState(() => activeScreen.startsWith('admin-') ? activeScreen.slice(6) : 'overview');
 const [query, setQuery] = useState('');
 const [pageNo, setPageNo] = useState(1);
 const [dialog, setDialog] = useState<{kind:string; id?:string|number}|null>(null);
 const [pendingAction, setPendingAction] = useState<(()=>void)|null>(null);
 const [filter, setFilter] = useState('الكل');
 const [toast, setToast] = useState('');
 const [pricing, setPricing] = useState<PricingOption[]>(() => pricingSeed.map(option => ({...option})));
 const [pricingEditor, setPricingEditor] = useState<PricingOption | null>(null);
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
 useEffect(() => {
  const nextPage = activeScreen.startsWith('admin-') ? activeScreen.slice(6) : 'overview';
  if (nextPage in labels) {
   setPage(nextPage);
    setSelectedDepositId(null);
   setQuery('');
   setFilter('الكل');
   setPageNo(1);
  }
 }, [activeScreen]);
 useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }, [data]);
 const navigateToPage = (nextPage: string) => {
  setPage(nextPage);
   setSelectedDepositId(null);
  setQuery('');
  setFilter('الكل');
  setPageNo(1);
  onPageChange(nextPage);
 };
 const updateRows = (key: keyof State, id: string|number, patch: Record<string, any>) => setData(d => ({...d, [key]: (d[key] as any[]).map(x => x.id===id ? {...x,...patch}:x)}));
 const userBy = (id:number|undefined) => data.users.find(u=>u.id===id);
 const announce = (s:string) => { setToast(s); window.setTimeout(()=>setToast(''),2300); };
 const title = labels[page] || 'نظرة عامة';
 const filteredUsers = data.users.filter(u => !query || [u.id,u.name,u.username].some(v=>String(v).toLowerCase().includes(query.toLowerCase())));
 const pageSize = 100;
 const visibleUsers = filteredUsers.slice((pageNo-1)*pageSize,pageNo*pageSize);
 const rowData = (key: 'deposits'|'withdrawals'|'campaigns'|'proofs'|'suspicious') => data[key].filter(r=>(filter==='الكل'||r.status===filter)&&(!query||[r.id,r.memoTag,r.txId,r.destination,r.title,r.taskId,r.attempt,userBy(r.userId)?.name,userBy(r.userId)?.username].some(x=>String(x??'').toLowerCase().includes(query.toLowerCase()))));
  const search = <div className="relative min-w-[180px] flex-1"><Search className="absolute right-3 top-3.5 h-4 w-4 text-slate-400"/><input aria-label="بحث في السجلات" value={query} onChange={e=>{setQuery(e.target.value);setPageNo(1)}} placeholder="ابحث بالمعرّف أو الاسم أو الوسم…" className="min-h-11 w-full rounded-xl border border-[#dce3ed] bg-[#fbfcfe] py-2.5 pe-10 ps-3 text-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#1557ee] focus:ring-4 focus:ring-[#1557ee]/10" /></div>;
  const statusSelect = (statuses:string[]) => <select aria-label="تصفية حسب الحالة" value={filter} onChange={e=>setFilter(e.target.value)} className="min-h-11 max-w-full rounded-xl border border-[#dce3ed] bg-white px-3 py-2.5 text-xs font-bold text-[#34435d] outline-none focus:border-[#1557ee] focus:ring-4 focus:ring-[#1557ee]/10"><option>الكل</option>{statuses.map(x=><option key={x}>{x}</option>)}</select>;
  const header = <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#e5eaf2] pb-3 sm:mb-5 sm:pb-4"><div className="min-w-0"><div className="mb-0.5 text-[10px] font-bold tracking-[.12em] text-[#1557ee]">VIDREWARD / OPERATIONS</div><h1 className="text-xl font-extrabold tracking-tight text-[#12234b] sm:text-2xl">{title}</h1></div><span className="inline-flex min-h-8 items-center rounded-lg border border-[#eadfbf] bg-[#fffaf0] px-2.5 py-1 text-[10px] font-bold text-[#765c2a]">معاينة محلية · لا اتصال بالخادم</span></div>;
  const panel = (children:ReactNode, cls='') => <section className={`min-w-0 rounded-2xl border border-[#e3e8f0] bg-white p-4 shadow-[0_3px_14px_rgba(18,35,75,.035)] md:p-5 ${cls}`}>{children}</section>;
  const table = (head:string[], rows:ReactNode[]) => panel(<>
   <div className="hidden min-w-0 overflow-x-auto md:block"><table className="w-full min-w-[680px] border-collapse text-sm"><thead><tr className="border-b border-[#e8edf4] bg-[#f8faff] text-[11px] text-slate-500">{head.map((x,i)=><th className={cell} key={`${x}-${i}`}>{x}</th>)}</tr></thead><tbody>{rows}</tbody></table></div>
   <div className="admin-mobile-table divide-y divide-[#e8edf4] md:hidden">{rows.map((row,index)=>{
    if(!isValidElement(row)) return null;
    const cells=Children.toArray((row as ReactElement<{children?:ReactNode}>).props.children);
    return <article key={row.key??index} className="space-y-2.5 py-3 first:pt-0 last:pb-0">
     {cells.map((item,cellIndex)=>{
      if(!isValidElement(item)) return null;
      const value=(item as ReactElement<{children?:ReactNode}>).props.children;
      const label=head[cellIndex]||'الإجراء';
      return <div key={`${index}-${cellIndex}`} className="grid min-w-0 grid-cols-[minmax(70px,30%)_minmax(0,1fr)] items-start gap-2.5 text-right">
       <span className="pt-1 text-[10px] font-semibold leading-4 text-slate-500">{label}</span>
       <div className="min-w-0 break-words text-xs leading-5 text-[#263653]">{value}</div>
      </div>;
     })}
    </article>;
   })}</div>
  </>);
 const confirm = (message:string, onConfirm:()=>void) => { setPendingAction(()=>onConfirm); setDialog({kind:'confirm', id:message}); };
 const action = (text:string, cb:()=>void, danger=false) => <button onClick={cb} className={`${btn} ${danger?'bg-rose-50 text-rose-700':'bg-slate-100 text-slate-700'}`}>{text}</button>;

 const content = () => {
  if(page==='overview') return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
    ['مستخدمون مسجلون',data.users.length,Users],
    ['حملات نشطة',data.campaigns.filter(x=>x.status==='نشطة').length,Megaphone],
    ['حملات أوقفتها الميزانية',data.campaigns.filter(x=>x.status==='أوقفتها الميزانية').length,Activity],
    ['إيداعات ناجحة · USDT',data.deposits.filter(x=>x.status==='ناجح').reduce((sum,x)=>sum+(x.method==='Stars'?Number(x.amount??0)*0.01:Number(x.amount??0)),0).toFixed(2),CircleDollarSign],
    ['إجمالي أرباح الفيديو',data.users.reduce((sum,u)=>sum+u.earnedBalance,0).toFixed(3),Wallet],
    ['مستخدمون حظرهم النظام',data.users.filter(x=>x.bannedBySystem).length,ShieldCheck]
    ].map(([l,v,I]:any)=><div key={l} className="min-w-0 rounded-xl border border-[#e3e8f0] bg-white p-4 shadow-[0_2px_10px_rgba(18,35,75,.025)]"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold leading-5 text-slate-500">{l}</span><I className="h-[18px] w-[18px] shrink-0 text-[#1557ee]"/></div><div className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-[#12234b]">{v}</div><div className="mt-2 text-[10px] text-slate-400">بيانات نموذجية على هذا الجهاز</div></div>)}</div>
   {panel(<><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><ShieldCheck size={20}/></span><div><h2 className="font-extrabold">مركز العمليات</h2><p className="mt-1 text-sm leading-6 text-slate-500">راجع النشاط التجريبي، وطبّق التغييرات محليًا. لا تؤثر أي عملية هنا في حسابات أو أرصدة حقيقية.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{[['طلبات السحب',data.withdrawals.filter(x=>x.status==='قيد المراجعة').length,'withdrawals'],['إثباتات المهام',data.proofs.filter(x=>x.status==='قيد المراجعة').length,'proofs'],['إشارات المخاطر',data.suspicious.filter(x=>x.status==='مفتوح').length,'suspicious'],['تقارير الإرسال',data.reports.length,'notifications']].map(([a,b,c])=><button key={c} onClick={()=>navigateToPage(String(c))} className="flex items-center justify-between rounded-xl bg-[#f7f9fc] p-4 text-right"><span className="text-sm font-bold">{a}</span><span className="font-mono text-lg font-bold text-[#1557ee]">{b}</span></button>)}</div></>)}
  </div>;
  if(page==='users') return <div className="space-y-4">{panel(<div className="flex flex-wrap gap-3">{search}<span className="self-center text-xs text-slate-400">حد أقصى 100 مستخدم في الصفحة</span></div>)}{table(['المستخدم','Telegram ID','رصيد المعلن','الأرباح','الحالة','آخر نشاط',''],visibleUsers.map(u=><tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/70"><td className={cell}><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf3ff] text-xs font-extrabold text-[#1557ee]">{u.avatar}</span><div><b>{u.name}</b><div className="text-xs text-slate-400">@{u.username}</div></div></div></td><td className={`${cell} font-mono`}>{u.id}</td><td className={`${cell} font-mono`}>{u.advertiserBalance.toFixed(2)} $</td><td className={`${cell} font-mono`}>{u.earnedBalance.toFixed(3)} $</td><td className={cell}><Badge>{u.status}</Badge></td><td className={cell}>{u.lastActive}</td><td className={cell}><button className={soft} onClick={()=>setDialog({kind:'user',id:u.id})}>التفاصيل</button></td></tr>))}{panel(<div className="flex items-center justify-between text-xs text-slate-500"><span>{filteredUsers.length} مستخدم</span><div className="flex gap-2"><button className={soft} disabled={pageNo<=1} onClick={()=>setPageNo(n=>n-1)}>السابق</button><span className="px-2 py-2">صفحة {pageNo} / {Math.max(1,Math.ceil(filteredUsers.length/pageSize))}</span><button className={soft} disabled={pageNo>=Math.ceil(filteredUsers.length/pageSize)} onClick={()=>setPageNo(n=>n+1)}>التالي</button></div></div>)}</div>;
  if(page==='deposits') {
   const selectedDeposit=data.deposits.find(r=>r.id===selectedDepositId);
   if(selectedDeposit) {
    const depositUser=userBy(selectedDeposit.userId);
    const currentBalance=depositUser?.advertiserBalance;
    const balanceBefore=selectedDeposit.balanceBefore ?? currentBalance;
    return <div className="space-y-4">
     <button type="button" className={soft} onClick={()=>setSelectedDepositId(null)}>العودة إلى الإيداعات</button>
     {panel(<div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold text-[#1557ee]">تفاصيل العملية</p><h2 className="mt-1 text-lg font-extrabold text-[#12234b]">{selectedDeposit.id}</h2></div><Badge>{selectedDeposit.status}</Badge></div>
      <dl className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
       {[
        ['المستخدم',depositUser?`${depositUser.name} · ${depositUser.id}`:'—'],
        ['طريقة الإيداع',selectedDeposit.method??'—'],
        ['المبلغ',`${Number(selectedDeposit.amount??0).toFixed(2)} ${selectedDeposit.method==='Stars'?'XTR':'USDT'}`],
        ['Memo / Tag',selectedDeposit.memoTag??'—'],
        ['TXID',selectedDeposit.txId??'—'],
        ['المحفظة',selectedDeposit.wallet??'—'],
        ['التاريخ',selectedDeposit.createdAt??'—'],
       ].map(([label,value])=><div key={label} className="min-w-0 rounded-xl border border-[#e9edf3] bg-[#f8faff] p-3"><dt className="text-[10px] font-semibold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-[#12234b]" dir={label==='Memo / Tag'||label==='TXID'||label==='المحفظة'?'ltr':undefined}>{value}</dd></div>)}
      </dl>
      {selectedDeposit.reason&&<p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700">{selectedDeposit.reason}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={!depositUser} onClick={()=>{if(!selectedDeposit.userId)return;const userId=selectedDeposit.userId;setSelectedDepositId(null);navigateToPage('users');setDialog({kind:'user',id:userId})}}>فتح ملف المستخدم</button></div>
     </div>)}
     {selectedDeposit.status==='فاشل'&&panel(<div>
      <header className="mb-3"><h3 className="text-sm font-extrabold text-[#12234b]">رصيد المستخدم</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">لأن العملية فاشلة، لم يُضف مبلغها إلى الحساب.</p></header>
      <div className="grid gap-3 sm:grid-cols-2">
       <div className="rounded-xl border border-[#e9edf3] bg-[#f8faff] p-3"><div className="text-[10px] font-semibold text-slate-500">الرصيد قبل الإيداع</div><div className="mt-1 font-mono text-lg font-extrabold text-[#12234b]" dir="ltr">{typeof balanceBefore==='number'?`${balanceBefore.toFixed(2)} USDT`:'—'}</div></div>
       <div className="rounded-xl border border-[#e9edf3] bg-[#f8faff] p-3"><div className="text-[10px] font-semibold text-slate-500">الرصيد الآن</div><div className="mt-1 font-mono text-lg font-extrabold text-[#12234b]" dir="ltr">{typeof currentBalance==='number'?`${currentBalance.toFixed(2)} USDT`:'—'}</div></div>
      </div>
     </div>)}
    </div>;
   }
   return <div className="space-y-4">{panel(<div className="flex flex-wrap gap-3">{search}{statusSelect(['ناجح','فاشل'])}</div>)}{table(['العملية / المعاملة','المستخدم','الطريقة','المبلغ','Memo / Tag','المحفظة','الحالة / الوقت'],rowData('deposits').map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}><button type="button" className="text-right font-mono font-bold text-[#1557ee] underline decoration-[#1557ee]/30 underline-offset-2" aria-label={`عرض تفاصيل الإيداع ${r.id}`} onClick={()=>setSelectedDepositId(r.id)}>{r.id}</button><div className="text-[11px] text-slate-400">{r.txId}</div></td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.method}</td><td className={`${cell} font-mono`}>{r.amount} {r.method==='Stars'?'XTR':'USDT'}</td><td className={`${cell} font-mono`}>{r.memoTag}</td><td className={`${cell} font-mono`}>{r.wallet||'—'}</td><td className={cell}><Badge>{r.status}</Badge><div className="mt-1 text-[10px] text-slate-400">{r.createdAt}</div>{r.reason&&<div className="mt-1 max-w-40 text-[10px] text-rose-600">{r.reason}</div>}</td></tr>))}</div>;
  }
   if(page==='withdrawals') return <div className="space-y-4">{panel(<div className="flex flex-wrap items-center gap-3">{search}{statusSelect(['قيد المراجعة','معتمد','مرفوض'])}</div>)}{table(['الطلب','المستخدم','القناة','المبلغ','الوجهة','Memo / Tag','التاريخ','الإجراء'],rowData('withdrawals').map(r=><tr key={r.id} className="border-b border-slate-50 hover:bg-[#f9fbfe]"><td className={cell}><b>{r.id}</b></td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.method}</td><td className={cell}><button className="inline-flex min-h-9 items-center gap-1 font-mono" aria-label="نسخ المبلغ" onClick={()=>{navigator.clipboard?.writeText(`${r.amount} USDT`);announce('تم نسخ المبلغ')}}>{r.amount} USDT<Copy size={13}/></button></td><td className={cell}><div className="flex items-center gap-1 font-mono"><span dir="ltr">{r.destination}</span><button aria-label="نسخ الوجهة" onClick={()=>{navigator.clipboard?.writeText(r.destination);announce('تم النسخ')}}><Copy size={14}/></button></div></td><td className={cell}><button aria-label="نسخ Memo Tag" onClick={()=>{navigator.clipboard?.writeText(r.memoTag);announce('تم نسخ Memo Tag')}} className="flex min-h-9 items-center gap-1 font-mono">{r.memoTag}<Copy size={13}/></button></td><td className={cell}>{r.createdAt}</td><td className={cell}>{r.status==='قيد المراجعة'?<div className="flex flex-wrap gap-1">{action('اعتماد',()=>{updateRows('withdrawals',r.id,{status:'معتمد'});announce('تم اعتماد الطلب محليًا')})}{action('رفض',()=>confirm('رفض طلب السحب؟',()=>{updateRows('withdrawals',r.id,{status:'مرفوض'});setDialog(null)}),true)}</div>:<Badge>{r.status}</Badge>}</td></tr>))}</div>;
  if(page==='campaigns') return <div className="space-y-4">{panel(<div className="flex flex-wrap items-center gap-3">{search}{statusSelect(['بانتظار المراجعة','نشطة','موقوفة','مرفوضة','أوقفتها الميزانية'])}</div>)}{table(['الحملة','المستخدم','المنصة','المدة','الميزانية','المشاهدات','الحالة','مراجعة'],rowData('campaigns').map(r=><tr key={r.id} className="border-b border-slate-50 hover:bg-[#f9fbfe]"><td className={cell}><b>{r.title}</b><div className="text-xs text-slate-400">{r.id}</div></td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.platform}</td><td className={cell}>{r.duration} ث</td><td className={cell}>{r.budget} USDT</td><td className={cell}>{r.views.toLocaleString()}</td><td className={cell}><Badge>{r.status}</Badge></td><td className={cell}><button className={soft} onClick={()=>setDialog({kind:'campaign',id:r.id})}>فيديو وإجراءات</button></td></tr>))}</div>;
  if(page==='proofs') return <div className="space-y-4">{panel(<div className="flex flex-wrap items-center gap-3">{search}{statusSelect(['قيد المراجعة','معتمد','مرفوض'])}</div>)}{table(['الإثبات','المستخدم','المهمة','المكافأة','الحالة','المرفق','الإجراء'],rowData('proofs').map(r=><tr key={r.id} className="border-b border-slate-50 hover:bg-[#f9fbfe]"><td className={cell}>{r.id}</td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.taskId}<div className="text-xs text-slate-400">{r.taskType}</div></td><td className={cell}>{r.reward} USDT</td><td className={cell}><Badge>{r.status}</Badge></td><td className={cell}><button className={soft} onClick={()=>setDialog({kind:'proof',id:r.id})}>عرض الصورة</button></td><td className={cell}>{r.status==='قيد المراجعة'?<div className="flex flex-wrap gap-1">{action('اعتماد المكافأة',()=>{setData(d=>{const p=d.proofs.find(x=>x.id===r.id);if(!p||p.status!=='قيد المراجعة')return d;return {...d,proofs:d.proofs.map(x=>x.id===r.id?{...x,status:'معتمد'}:x),users:d.users.map(u=>u.id===p.userId?{...u,earnedBalance:Number((u.earnedBalance+p.reward).toFixed(6))}:u)}});announce('تم اعتماد الإثبات وإضافة المكافأة محليًا')})}{action('رفض',()=>setDialog({kind:'reject-proof',id:r.id}),true)}</div>:r.rejectionReason||<Badge>{r.status}</Badge>}</td></tr>))}</div>;
  if(page==='ads') return <div className="space-y-4">{panel(<div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">أكواد Adstera</h2><p className="mt-1 text-xs text-slate-500">كل الأكواد في جدول واحد؛ معاينة الشيفرة لا تنفّذها.</p></div><button className={primary} onClick={()=>setDialog({kind:'ad-new'})}>إضافة كود</button></div>)}{table(['النوع','المعرّف','الشيفرة','الحالة','آخر تحديث','الإجراءات'],data.ads.map(ad=><tr key={ad.id} className="border-b border-slate-50 hover:bg-[#f9fbfe]"><td className={cell}>{ad.format==='social'?'Social':'320 × 50'}</td><td className={`${cell} font-mono`}>{ad.id}</td><td className={cell}><details className="max-w-md"><summary className="cursor-pointer font-semibold text-[#1557ee]">عرض الكود</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#101b32] p-3 text-[10px] leading-5 text-emerald-100">{ad.code}</pre></details></td><td className={cell}><button type="button" aria-label={`${ad.enabled?'تعطيل':'تفعيل'} ${ad.id}`} onClick={()=>updateRows('ads',ad.id,{enabled:!ad.enabled})}><Badge>{ad.enabled?'مفعّل':'معطّل'}</Badge></button></td><td className={cell}>{ad.updatedAt}</td><td className={cell}><button type="button" className={soft} onClick={()=>setDialog({kind:'ad-edit',id:ad.id})}>تعديل ومعاينة</button></td></tr>))}</div>;
   if(page==='settings') return <div className="space-y-7"><SettingsPanel values={data.settings} onSave={v=>{setData(d=>({...d,settings:v}));announce('تم حفظ الإعدادات محليًا')}}/><PricingPanel options={pricing} onEdit={setPricingEditor}/></div>;
  if(page==='notifications') return <NotificationPanel reports={data.reports} onSend={r=>{setData(d=>({...d,reports:[{...r,id:`NTF-${Date.now()}`,createdAt:new Date().toLocaleString('ar'),status:'مسودة محلية'},...d.reports]}));announce('حُفظ التقرير محليًا؛ الإرسال المباشر غير متصل')}}/>;
   return <div className="space-y-4">{panel(<div className="flex flex-wrap items-center gap-3">{search}{statusSelect(['مفتوح','تمت المراجعة'])}</div>)}{table(['الإشارة','المستخدم','نوع الإشارة','الوقت','الحالة','الإجراء'],rowData('suspicious').map(r=><tr key={r.id} className="border-b border-slate-50 hover:bg-[#f9fbfe]"><td className={cell}>{r.id}</td><td className={cell}>{userBy(r.userId)?.name} · {r.userId}</td><td className={cell}>{r.attempt}</td><td className={cell}>{r.createdAt}</td><td className={cell}><Badge>{r.status}</Badge></td><td className={cell}>{action('حظر المستخدم',()=>confirm('حظر هذا المستخدم؟',()=>{setData(d=>({...d,users:d.users.map(u=>u.id===r.userId?{...u,status:'محظور'}:u),suspicious:d.suspicious.map(x=>x.id===r.id?{...x,status:'تمت المراجعة'}:x)}));setDialog(null)}),true)}</td></tr>))}</div>;
 };

  return <main dir="rtl" className="admin-console min-h-[100dvh] overflow-x-hidden bg-[#f7f9fc] px-3 pb-28 pt-4 text-[#12234b] sm:px-6 sm:pt-5 lg:px-8">
  <div className="mx-auto max-w-[1440px]">{header}
   <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-[#fff9eb] px-4 py-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><span><b>وضع المعاينة:</b> بيانات تجريبية خيالية محفوظة على هذا الجهاز. لا تؤثر العمليات على مستخدمين أو أموال أو Telegram أو مواضع إعلانية حقيقية.</span></div>
    <div className="mt-5">{content()}</div>
   <footer className="mt-5 text-center text-[10px] text-slate-400">VidReward Admin · نسخة تجريبية محلية · لا اتصال بخدمات الإنتاج</footer>
  </div>
  {toast&&<div role="status" className="fixed bottom-20 right-4 z-[110] rounded-xl bg-[#12234b] px-4 py-3 text-sm font-bold text-white shadow-xl">{toast}</div>}
   {pricingEditor&&<PricingEditor option={pricingEditor} onClose={()=>setPricingEditor(null)} onSave={(updated)=>{setPricing(current=>current.map(option=>option.id===updated.id?updated:option));setPricingEditor(null);announce('تم تحديث السعر محليًا')}}/>}
  {dialog&&<Dialog dialog={dialog} data={data} userBy={userBy} onClose={()=>setDialog(null)} onConfirmAction={()=>{pendingAction?.();setPendingAction(null);setDialog(null);announce('تم تطبيق الإجراء محليًا')}} onConfirm={(id,patch)=>{if(dialog.kind==='user-edit'||dialog.kind==='user'){setData(d=>({...d,users:d.users.map(u=>u.id===id?{...u,...patch}:u)}))}else if(dialog.kind==='ad-new'){setData(d=>({...d,ads:[{id:`AD-${Date.now()}`,format:patch.format,code:patch.code,enabled:false,updatedAt:new Date().toISOString().slice(0,10)},...d.ads]}))}else if(dialog.kind==='ad-edit'){updateRows('ads',id as string,patch)}else if(dialog.kind==='reject-proof'){updateRows('proofs',id as string,patch)}else if(dialog.kind==='campaign'){updateRows('campaigns',id as string,patch)}setDialog(null);announce('تم حفظ التغيير محليًا')}} onDelete={id=>{setData(d=>({...d,users:d.users.filter(u=>u.id!==id)}));setDialog(null)}} onAction={cb=>{confirm('تأكيد الإجراء؟',cb)}}/>}
 </main>;
}

function PricingPanel({options,onEdit}:{options:PricingOption[];onEdit:(option:PricingOption)=>void}) {
 const platformMeta:Record<PricingPlatform,{title:string;unit:string;unitShort:string;icon:typeof Youtube}> = {
  youtube:{title:'YouTube',unit:'مدة المشاهدة',unitShort:'ثانية',icon:Youtube},
  tiktok:{title:'TikTok',unit:'عدد المتابعين',unitShort:'متابع',icon:Music2},
  telegram:{title:'Telegram',unit:'عدد المشتركين',unitShort:'مشترك',icon:Send},
 };
 const order:PricingPlatform[]=['youtube','tiktok','telegram'];
 return <section aria-labelledby="pricing-title" className="overflow-hidden rounded-2xl border border-[#dfe5ef] bg-white shadow-[0_4px_18px_rgba(18,35,75,.035)]">
  <header className="flex flex-col gap-1 border-b border-[#e8edf4] px-4 py-4 sm:px-5">
   <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><CircleDollarSign size={18}/></span><div><h2 id="pricing-title" className="text-base font-extrabold text-[#12234b]">إدارة الأسعار</h2><p className="mt-0.5 text-xs text-slate-500">تسعير الخيارات الحالية · تغييرات محلية للمعاينة</p></div></div>
  </header>
  <div className="divide-y divide-[#e8edf4] px-4 sm:px-5">
   {order.map(platform=>{
    const meta=platformMeta[platform], Icon=meta.icon;
    return <section key={platform} aria-labelledby={`pricing-${platform}`} className="py-4 first:pt-4 last:pb-5">
     <div className="mb-2.5 flex items-center gap-2"><Icon size={16} className="text-[#1557ee]"/><h3 id={`pricing-${platform}`} className="text-sm font-extrabold text-[#12234b]">{meta.title}</h3><span className="text-[11px] text-slate-400">{meta.unit}</span></div>
     <div className="divide-y divide-[#f0f2f6]">
      {options.filter(option=>option.platform===platform).map(option=><div data-testid={`row-pricing-${option.id}`} key={option.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
       <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="font-mono text-sm font-bold text-[#12234b]" dir="ltr">{option.quantity} <span className="font-sans text-xs font-medium text-slate-500">{meta.unitShort}</span></div>
        <div className="flex items-center gap-2"><span className="text-[11px] font-semibold text-slate-500">{platform==='youtube'?'CPM':'سعر المعلن'}</span><span className="font-mono text-sm font-bold text-[#12234b]" dir="ltr">${option.price.toFixed(2)}</span></div>
       </div>
       <button type="button" data-testid={`button-edit-pricing-${option.id}`} onClick={()=>onEdit(option)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[#dce5f5] bg-[#f8faff] px-3 text-xs font-bold text-[#1557ee] transition-colors hover:border-[#b9cdf7] hover:bg-[#eff4ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1557ee]/30"><Pencil size={13}/><span>تعديل</span></button>
      </div>)}
     </div>
    </section>
   })}
  </div>
 </section>;
}

function PricingEditor({option,onClose,onSave}:{option:PricingOption;onClose:()=>void;onSave:(option:PricingOption)=>void}) {
 const [quantity,setQuantity]=useState(String(option.quantity));
 const [price,setPrice]=useState(String(option.price));
 const [error,setError]=useState('');
 const platformNames:Record<PricingPlatform,string>={youtube:'YouTube',tiktok:'TikTok',telegram:'Telegram'};
 const quantityLabel=option.platform==='youtube'?'المدة بالثواني':option.platform==='tiktok'?'عدد المتابعين':'عدد المشتركين';
 const priceLabel=option.platform==='youtube'?'CPM':'سعر المعلن';
 const quantityUnit=option.platform==='youtube'?'ثانية':option.platform==='tiktok'?'متابع':'مشترك';
 const submit=(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const numericQuantity=Number(quantity),numericPrice=Number(price);
  if(!quantity.trim()||!Number.isFinite(numericQuantity)||numericQuantity<=0||!Number.isInteger(numericQuantity)){setError('أدخل قيمة صحيحة أكبر من صفر.');return;}
  if(!price.trim()||!Number.isFinite(numericPrice)||numericPrice<0){setError('أدخل سعرًا صحيحًا، ويمكن استخدام الكسور العشرية.');return;}
  onSave({...option,quantity:numericQuantity,price:numericPrice});
 };
 return <div className="pricing-sheet-backdrop fixed inset-0 z-[120] flex items-end justify-center bg-[#061333]/40 px-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section role="dialog" aria-modal="true" aria-labelledby="pricing-editor-title" className="pricing-sheet w-full max-w-lg rounded-t-[26px] border border-[#e3e9f2] bg-[#fff] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_24px_70px_rgba(13,31,71,.2)] sm:rounded-3xl sm:p-6">
   <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden"/>
   <header className="mb-5 flex items-start justify-between gap-3">
    <div><p className="text-[11px] font-bold tracking-wide text-[#1557ee]">{platformNames[option.platform]} · تعديل خيار ثابت</p><h2 id="pricing-editor-title" className="mt-1 text-lg font-extrabold text-[#12234b]">تعديل السعر</h2></div>
    <button type="button" data-testid="button-close-pricing-editor" onClick={onClose} className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#12234b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1557ee]/30">إغلاق</button>
   </header>
   <form onSubmit={submit} className="space-y-4">
    <label className="grid gap-1.5 text-xs font-bold text-[#34435d]">{quantityLabel}<div className="relative"><input data-testid="input-pricing-quantity" aria-label={quantityLabel} type="number" inputMode="numeric" min="1" step="1" required value={quantity} onChange={event=>{setQuantity(event.target.value);setError('')}} className="min-h-12 w-full rounded-xl border border-[#d8e0eb] bg-[#fbfcfe] px-3 ps-14 text-base font-semibold text-[#12234b] outline-none transition-shadow focus:border-[#1557ee] focus:ring-4 focus:ring-[#1557ee]/10" /><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">{quantityUnit}</span></div></label>
    <label className="grid gap-1.5 text-xs font-bold text-[#34435d]">{priceLabel}<div className="relative"><input data-testid="input-pricing-price" aria-label={priceLabel} type="number" inputMode="decimal" min="0" step="any" required value={price} onChange={event=>{setPrice(event.target.value);setError('')}} className="min-h-12 w-full rounded-xl border border-[#d8e0eb] bg-[#fbfcfe] px-3 ps-12 text-base font-semibold text-[#12234b] outline-none transition-shadow focus:border-[#1557ee] focus:ring-4 focus:ring-[#1557ee]/10" /><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-400">$</span></div><span className="text-[11px] font-normal text-slate-400">يمكن إدخال قيمة عشرية مثل 1.50</span></label>
    {error&&<p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
    <button type="submit" data-testid="button-save-pricing" className="min-h-12 w-full rounded-xl bg-[#1557ee] px-4 text-sm font-bold text-white shadow-[0_4px_10px_rgba(21,87,238,.16)] transition-colors hover:bg-[#104bd4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1557ee]/25">حفظ التغييرات</button>
   </form>
  </section>
 </div>;
}

 function SettingsPanel({values,onSave}:{values:Record<string,any>;onSave:(v:Record<string,any>)=>void}) {
 const [v,setV]=useState(values); useEffect(()=>setV(values),[values]);
  const fields:[string,string][]=[['binanceWithdrawMin','الحد الأدنى للسحب عبر Binance (USDT)'],['web3WithdrawMin','الحد الأدنى للسحب عبر Web3 (USDT)'],['starsDepositMin','الحد الأدنى للإيداع عبر Stars'],['web3DepositMin','الحد الأدنى للإيداع عبر Web3 (USDT)'],['userShare','حصة المستخدم من الإيراد (%)'],['platformShare','حصة المنصة (%)'],['durationMin','أقصر مدة فيديو (ثانية)'],['durationMax','أطول مدة فيديو (ثانية)'],['cpmMin','أقل CPM'],['cpmMax','أعلى CPM'],['telegramCpm','CPM إعلانات Telegram'],['tiktokCpm','CPM إعلانات TikTok'],['taskReward','مكافأة مهمة Telegram الثابتة'],['tiktokTaskReward','مكافأة مهمة TikTok الثابتة'],['web3Address','عنوان Web3']];
 return <div className="space-y-3">{<section className="min-w-0 rounded-2xl border border-[#e3e8f0] bg-white p-4 shadow-[0_3px_14px_rgba(18,35,75,.035)] sm:p-5"><header className="mb-4 border-b border-[#edf0f5] pb-3"><h2 className="font-extrabold text-[#12234b]">ضوابط المنصة</h2><p className="mt-1 text-xs text-slate-500">إعدادات التشغيل والأرصدة</p></header><div className="grid min-w-0 gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{fields.map(([key,label])=><Field key={key} label={label} type={key==='web3Address'?'text':'number'} step="any" value={v[key]} onChange={e=>setV({...v,[key]:key==='web3Address'?e.target.value:Number(e.target.value)})}/>)}</div><label className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border border-[#f0e6cf] bg-[#fffaf0] p-3 text-sm font-bold text-[#55472d]"><input type="checkbox" checked={v.maintenance} onChange={e=>setV({...v,maintenance:e.target.checked})} className="h-4 w-4 accent-[#1557ee]"/> وضع الصيانة (محلي فقط)</label><button className={`${primary} mt-4 w-full sm:w-auto`} onClick={()=>onSave(v)}>حفظ الإعدادات</button></section>}<p className="px-1 text-xs text-slate-500">تغييرات المعاينة لا تصل إلى الخادم أو البوت.</p></div>;
}

function NotificationPanel({reports,onSend}:{reports:Row[];onSend:(r:Omit<Row,'id'>)=>void}) {
  const [title,setTitle]=useState('');const [body,setBody]=useState('');const [buttonTitle,setButtonTitle]=useState('');const [link,setLink]=useState('');
  const [image,setImage]=useState<{name:string;dataUrl:string}|null>(null);const [imageError,setImageError]=useState('');
  const selectImage=(file:File|null)=>{setImageError('');setImage(null);if(!file)return;if(!file.type.startsWith('image/')){setImageError('اختر ملف صورة صالحًا.');return}if(file.size>2*1024*1024){setImageError('يجب ألا يتجاوز حجم الصورة 2 ميغابايت.');return}const reader=new FileReader();reader.onerror=()=>setImageError('تعذّر قراءة الصورة. حاول اختيارها مرة أخرى.');reader.onload=()=>setImage({name:file.name,dataUrl:String(reader.result??'')});reader.readAsDataURL(file)};
  return <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]"><section className="min-w-0 rounded-2xl border border-[#e3e8f0] bg-white p-4 shadow-[0_3px_14px_rgba(18,35,75,.035)] sm:p-5"><header className="mb-4 border-b border-[#edf0f5] pb-3"><h2 className="font-extrabold text-[#12234b]">إنشاء إشعار</h2></header><div className="grid min-w-0 gap-4"><Field label="العنوان العريض" value={title} onChange={e=>setTitle(e.target.value)} placeholder="عنوان الإشعار"/><label className="grid min-w-0 gap-1.5 text-xs font-bold text-[#46546b]">النص<textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} className="min-h-28 w-full min-w-0 rounded-xl border border-[#dce3ed] bg-[#fbfcfe] p-3 text-sm outline-none transition-shadow focus:border-[#1557ee] focus:ring-4 focus:ring-[#1557ee]/10"/></label><div className="grid min-w-0 gap-3 sm:grid-cols-2"><Field label="عنوان الزر (اختياري)" value={buttonTitle} onChange={e=>setButtonTitle(e.target.value)}/><Field label="رابط الزر (اختياري)" value={link} onChange={e=>setLink(e.target.value)}/></div>
   <div className="grid gap-2"><label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-xl border border-[#dce3ed] bg-white px-3 text-xs font-bold text-[#34435d] transition hover:bg-[#f7f9fc]"><ImagePlus size={16} className="text-[#1557ee]"/>إضافة صورة<input type="file" accept="image/*" className="sr-only" aria-label="إضافة صورة للإشعار" onChange={e=>{selectImage(e.target.files?.[0]??null);e.currentTarget.value=''}}/></label>
    {image&&<div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e9edf3] bg-[#f8faff] p-2"><img src={image.dataUrl} alt="معاينة صورة الإشعار" className="h-14 w-14 shrink-0 rounded-lg object-cover"/><span className="min-w-0 flex-1 truncate text-xs text-slate-600">{image.name}</span><button type="button" className="min-h-9 rounded-lg px-2 text-xs font-bold text-rose-700 hover:bg-rose-50" onClick={()=>setImage(null)}>إزالة الصورة</button></div>}
    {imageError&&<p role="alert" className="text-xs font-semibold text-rose-700">{imageError}</p>}
   </div>
   <div className="rounded-xl border border-[#eadfbf] bg-[#fffaf0] p-3 text-xs leading-5 text-[#765c2a]">لا يوجد اتصال بالخادم، لذلك لا يمكن إرسال الإشعارات فعليًا. زر الإرسال الجماعي معطل بوضوح؛ يمكنك حفظ نسخة محلية للمعاينة فقط.</div><button type="button" disabled title="يتطلب اتصال خادم غير متاح" className={`${btn} w-full cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400`}>إرسال إلى جميع المستخدمين · غير متاح</button><button className={`${primary} w-full sm:w-auto`} disabled={!title.trim()||!body.trim()} onClick={()=>{onSend({title,body,buttonTitle,link,imageDataUrl:image?.dataUrl??'',imageName:image?.name??''});setTitle('');setBody('');setImage(null);setImageError('')}}>حفظ كتقرير معاينة</button></div></section><section className="min-w-0 rounded-2xl border border-[#e3e8f0] bg-white p-4 shadow-[0_3px_14px_rgba(18,35,75,.035)] sm:p-5"><header className="mb-4 border-b border-[#edf0f5] pb-3"><h2 className="font-extrabold text-[#12234b]">سجل التسليم المحلي</h2></header><div className="space-y-3">{reports.length?reports.map(r=><div key={r.id} className="rounded-xl border border-[#e9edf3] bg-[#f8faff] p-3"><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{r.title}</b><Badge>{r.status}</Badge></div>{r.imageDataUrl&&<img src={r.imageDataUrl} alt={r.imageName||'صورة الإشعار'} className="mt-2 max-h-48 w-full rounded-lg object-cover"/>}<p className="mt-2 break-words text-xs text-slate-600">{r.body}</p><div className="mt-2 text-[10px] text-slate-500">{r.createdAt} · لم يتم الإرسال إلى Telegram</div></div>):<p className="rounded-xl bg-[#f8faff] p-5 text-center text-sm text-slate-500">لا توجد تقارير محفوظة</p>}</div></section></div>;
}

function Dialog({dialog,data,userBy,onClose,onConfirm,onConfirmAction,onDelete,onAction}:{dialog:{kind:string;id?:string|number};data:State;userBy:(id:number|undefined)=>User|undefined;onClose:()=>void;onConfirm:(id:any,patch:any)=>void;onConfirmAction:()=>void;onDelete:(id:number)=>void;onAction:(cb:()=>void)=>void}) {
 const [values,setValues]=useState<Record<string,any>>({}); const [adPreview,setAdPreview]=useState<{format:string;code:string}|null>(null); const user=dialog.kind==='user'||dialog.kind==='user-edit'?userBy(Number(dialog.id)):undefined;
 const campaign=data.campaigns.find(x=>x.id===dialog.id);const proof=data.proofs.find(x=>x.id===dialog.id);const ad=data.ads.find(x=>x.id===dialog.id);
  useEffect(()=>{const initialValues=user?{...user}:ad?{...ad}:{};setValues(initialValues);setAdPreview(dialog.kind==='ad-new'?{format:'social',code:''}:ad?{format:ad.format,code:ad.code}:null)},[dialog.kind,dialog.id]);
 const field=(key:string,label:string,type='text')=><Field label={label} type={type} value={values[key]??''} onChange={e=>setValues(v=>({...v,[key]:type==='number'?Number(e.target.value):e.target.value}))}/>;
  const save=(patch=values)=>onConfirm(dialog.id,dialog.kind==='ad-edit'?{...patch,updatedAt:new Date().toISOString().slice(0,10)}:patch);
 let content:React.ReactNode=null;let heading='تفاصيل';
 if(dialog.kind==='user'||dialog.kind==='user-edit'){heading='ملف المستخدم';content=user&&<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><small>معرّف Telegram</small><div className="font-mono font-bold">{user.id}</div></div><div className="rounded-xl bg-slate-50 p-3"><small>الحالة</small><div><Badge>{user.status}</Badge></div></div></div><div className="grid gap-3 sm:grid-cols-2">{field('name','الاسم')}{field('username','اسم المستخدم')}{field('advertiserBalance','رصيد المعلن','number')}{field('earnedBalance','الأرباح','number')}</div><div className="grid grid-cols-2 gap-3 text-xs"><p>تاريخ التسجيل<br/><b>{user.joinedAt}</b></p><p>آخر تسجيل دخول<br/><b>{user.lastLogin}</b></p><p>آخر نشاط<br/><b>{user.lastActive}</b></p><p>دُعي بواسطة<br/><b>{user.invitedBy}</b></p></div><div className="flex flex-wrap gap-2"><button className={primary} onClick={()=>save()}>حفظ التعديلات والأرصدة</button><button className={soft} onClick={()=>onAction(()=>save({status:user.status==='نشط'?'محظور':'نشط'}))}>{user.status==='نشط'?'حظر':'إلغاء الحظر'}</button><button className={`${btn} bg-rose-50 text-rose-700`} onClick={()=>onAction(()=>onDelete(user.id))}><Trash2 size={14}/> حذف</button></div></div>}
 else if(dialog.kind==='campaign'){heading='مراجعة الفيديو';content=campaign&&<div className="space-y-3"><div className="aspect-video overflow-hidden rounded-xl bg-slate-900"><iframe title="معاينة فيديو الحملة" className="h-full w-full" src={campaign.videoUrl} allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"/></div><h3 className="font-bold">{campaign.title}</h3><div className="grid grid-cols-2 gap-2 text-xs text-slate-500"><span>النوع: {campaign.platform}</span><span>المدة: {campaign.duration} ثانية</span><span>الميزانية: {campaign.budget} USDT</span><span>المشاهدات: {campaign.views}</span></div><div className="flex flex-wrap gap-2">{['نشطة','مرفوضة','موقوفة'].map(status=><button key={status} className={status==='مرفوضة'?`${btn} bg-rose-50 text-rose-700`:soft} onClick={()=>status==='مرفوضة'?onAction(()=>save({status})):save({status})}>{status==='نشطة'?'اعتماد':status==='مرفوضة'?'رفض':'إيقاف مؤقت'}</button>)}</div></div>}
 else if(dialog.kind==='proof'){heading='صورة إثبات المهمة';content=proof&&<div><img src={proof.image} alt="صورة الإثبات" className="max-h-[60vh] w-full rounded-xl object-contain"/><p className="mt-3 text-xs text-slate-500">{userBy(proof.userId)?.name} · {proof.taskId}</p></div>}
 else if(dialog.kind==='reject-proof'){heading='رفض الإثبات';content=<div className="space-y-3"><label className="grid gap-1.5 text-xs font-bold">سبب الرفض<textarea value={values.reason??''} onChange={e=>setValues({...values,reason:e.target.value})} rows={3} className="rounded-xl border border-slate-200 p-3"/></label><button className={`${btn} bg-rose-600 text-white`} onClick={()=>onAction(()=>save({status:'مرفوض',rejectionReason:values.reason||'لم يطابق الإثبات المتطلبات'}))}>رفض الإثبات</button></div>}
  else if(dialog.kind==='ad-new'||dialog.kind==='ad-edit'){heading=dialog.kind==='ad-new'?'إضافة كود Adstera':'تعديل كود Adstera';content=<div className="space-y-4">
    <label className="grid gap-1.5 text-xs font-bold text-[#46546b]">نوع الإعلان<select value={values.format??'social'} onChange={e=>{const format=e.target.value;setValues({...values,format});setAdPreview({format,code:String(values.code??'')})}} className="min-h-11 rounded-xl border border-[#dce3ed] bg-[#fbfcfe] px-3 py-2.5 text-sm"><option value="social">Social</option><option value="320x50">320 × 50</option></select></label>
   <label className="grid gap-1.5 text-xs font-bold text-[#46546b]">كود الإعلان<textarea value={values.code??''} onChange={e=>setValues({...values,code:e.target.value})} rows={6} className="w-full rounded-xl bg-[#101b32] p-3 font-mono text-xs text-emerald-100 outline-none focus:ring-4 focus:ring-[#1557ee]/10"/></label>
   <div className="rounded-xl border border-[#e3e8f0] bg-[#f8faff] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xs font-extrabold text-[#12234b]">معاينة النوع المحدد</h3><p className="mt-1 text-[10px] text-slate-500">{values.format==='320x50'?'مساحة بانر 320 × 50':'إعلان Social يُضاف على مستوى body'}</p></div><button type="button" className={soft} onClick={()=>setAdPreview({format:values.format??'social',code:String(values.code??'')})}>تحديث المعاينة</button></div>
    {adPreview&&<div className={`mt-3 overflow-hidden rounded-lg border border-[#e3e8f0] bg-white ${adPreview.format==='320x50'?'mx-auto min-h-[50px] max-w-[320px]':'min-h-20 w-full'}`}><div className="p-3"><div className="text-[10px] font-bold text-[#1557ee]">{adPreview.format==='320x50'?'معاينة بانر 320 × 50':'معاينة Social'}</div><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#101b32] p-2 font-mono text-[10px] leading-4 text-emerald-100">{adPreview.code||'لا يوجد كود بعد'}</pre></div></div>}
    <p className="mt-2 text-[10px] leading-4 text-slate-500">المعاينة تعرض المصدر كنص ولا تشغّل JavaScript.</p>
   </div>
   <button className={`${primary} w-full sm:w-auto`} onClick={()=>save()}>حفظ الكود</button>
  </div>}
 else {heading='تأكيد الإجراء';content=<div className="space-y-4"><p className="text-sm">{dialog.id}</p><p className="text-xs text-slate-500">سيُطبّق هذا الإجراء على بيانات المعاينة المحلية فقط.</p><div className="flex gap-2"><button className={`${btn} bg-rose-600 text-white`} onClick={onConfirmAction}>تأكيد</button><button className={soft} onClick={onClose}>إلغاء</button></div></div>}
 const userFullPage=dialog.kind==='user'||dialog.kind==='user-edit';
  return <div className={`fixed inset-0 z-[100] flex justify-center bg-[#061333]/38 backdrop-blur-[2px] ${userFullPage?'items-stretch p-0 sm:items-center sm:p-4':'items-end p-0 sm:items-center sm:p-4'}`} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" className={`${userFullPage?'h-[100dvh] w-full max-w-none rounded-none sm:h-auto sm:max-h-[92dvh] sm:max-w-xl sm:rounded-3xl':'max-h-[92dvh] w-full max-w-xl rounded-t-[26px] sm:rounded-3xl'} min-w-0 overflow-y-auto bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_18px_55px_rgba(13,31,71,.16)] sm:p-6`}><header className="mb-4 flex items-center justify-between gap-3 border-b border-[#edf0f5] pb-3"><h2 className="min-w-0 text-base font-extrabold text-[#12234b]">{heading}</h2><button type="button" aria-label="إغلاق" onClick={onClose} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#12234b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1557ee]/35"><X size={18}/></button></header>{content}</section></div>;
}