import { Children, cloneElement, isValidElement, useEffect, useState, type ReactElement } from 'react';
import { Activity, CircleDollarSign, Copy, Eye, Megaphone, Search, ShieldCheck, Trash2, Users, Wallet, X, Plus, Code2, RefreshCw, Pencil, Check, Monitor, Layers } from 'lucide-react';
import { saveLocalPricing, useLocalPricing, type LocalPricing, type PricingPlatform } from '@/legacy/pricing';
import { buildAdsteraDocument, useAdsteraAds, type AdsteraAd, type AdsteraFormat } from '@/lib/adsteraAds';

type User = { id: number; name: string; username: string; avatar: string; advertiserBalance: number; earnedBalance: number; status: 'نشط' | 'محظور'; bannedBySystem?: boolean; joinedAt: string; lastLogin: string; lastActive: string; invitedBy: string };
type Row = { id: string; userId?: number; amount?: number; createdAt?: string; status?: string; [key: string]: any };
type State = { users: User[]; deposits: Row[]; withdrawals: Row[]; campaigns: Row[]; proofs: Row[]; ads: Row[]; suspicious: Row[]; settings: Record<string, any>; reports: Row[] };
const KEY = 'vidreward.admin.preview.v1';
const proofMock = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="100%" height="100%" fill="#e9eef8"/><rect x="120" y="72" width="560" height="356" rx="28" fill="#fff"/><rect x="155" y="112" width="84" height="84" rx="24" fill="#edf3ff"/><path d="M179 154h36M197 136v36" stroke="#1557ee" stroke-width="8" stroke-linecap="round"/><rect x="268" y="118" width="340" height="16" rx="8" fill="#d8e1f2"/><rect x="268" y="150" width="240" height="12" rx="6" fill="#e9eef8"/><rect x="155" y="238" width="450" height="20" rx="10" fill="#e9eef8"/><rect x="155" y="276" width="390" height="20" rx="10" fill="#e9eef8"/><rect x="155" y="344" width="156" height="42" rx="12" fill="#1557ee"/><text x="333" y="371" font-family="sans-serif" font-size="17" fill="#52627e">TASK PROOF IMAGE</text></svg>')}`;
const seed: State = {
 users: [
   { id: 610241, name: 'ليان السالمي', username: 'layan_s', avatar: 'لس', advertiserBalance: 18.5, earnedBalance: 2.38, status: 'نشط', joinedAt: '2025-02-11', lastLogin: '2025-03-08 09:42', lastActive: 'قبل 4 دقائق', invitedBy: '—' },
   { id: 610258, name: 'عمر الراشد', username: 'omar_r', avatar: 'عر', advertiserBalance: 0, earnedBalance: 0.74, status: 'نشط', joinedAt: '2025-02-18', lastLogin: '2025-03-08 08:16', lastActive: 'قبل 22 دقيقة', invitedBy: '610241' },
   { id: 610309, name: 'نور حمدان', username: 'nour_h', avatar: 'نح', advertiserBalance: 43, earnedBalance: 5.12, status: 'نشط', joinedAt: '2025-02-26', lastLogin: '2025-03-07 19:30', lastActive: 'أمس', invitedBy: '610258' },
   { id: 610411, name: 'سامي فؤاد', username: 'sami_f', avatar: 'سف', advertiserBalance: 2.2, earnedBalance: 0.16, status: 'محظور', bannedBySystem: true, joinedAt: '2025-03-01', lastLogin: '2025-03-06 12:01', lastActive: 'منذ يومين', invitedBy: '—' },
 ],
 deposits: [
  { id: 'DEP-4821', userId: 610241, method: 'Stars', amount: 12, createdAt: '2025-03-08 09:14', memoTag: 'VR-610241-A', txId: 'TG-ST-89021', status: 'ناجح', credited: true, balanceBefore: 6.5, balanceAfter: 18.5 },
  { id: 'DEP-4818', userId: 610309, method: 'USDT', amount: 31, createdAt: '2025-03-07 17:05', memoTag: 'VR-610309-B', wallet: '0x81…b029', txId: '0xa21f…', status: 'فاشل', reason: 'لم يصل التحويل إلى الشبكة المحددة', credited: false, balanceBefore: 43, balanceAfter: 43 },
 ],
 withdrawals: [
  { id: 'WDR-2064', userId: 610258, amount: 1.24, method: 'Binance', destination: '684291037', createdAt: '2025-03-08 08:50', status: 'قيد المراجعة' },
  { id: 'WDR-2059', userId: 610309, amount: 3.5, method: 'Web3', destination: '0x901c...7d4e', createdAt: '2025-03-07 11:34', status: 'قيد المراجعة' },
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
 ads: [],
 suspicious: [{ id: 'SIG-118', userId: 610411, attempt: 'رصد أدوات المطور + مشاهدة أسرع من المدة المطلوبة', createdAt: '2025-03-08 08:20', status: 'مفتوح' }, { id: 'SIG-112', userId: 610258, attempt: 'عدة حسابات على الجهاز نفسه', createdAt: '2025-03-07 15:10', status: 'مفتوح' }, { id: 'SIG-107', userId: 610309, attempt: 'تلاعب في DOM', createdAt: '2025-03-06 10:22', status: 'تمت المراجعة' }],
  settings: { binanceWithdrawMin: 1, web3WithdrawMin: 2, starsDepositMin: 1, web3DepositMin: 5, userShare: 20, platformShare: 10, durationMin: 10, durationMax: 80, cpmMin: 1.5, cpmMax: 4, telegramCpm: 2.2, tiktokCpm: 2.8, taskReward: 0.02, telegramTaskReward: 0.02, tiktokTaskReward: 0.01, web3Address: '0x0000...9a31', maintenance: false },
 reports: [],
};
const labels: Record<string, string> = { overview:'نظرة عامة', users:'مستخدمو Telegram', deposits:'الإيداعات', 'deposit-detail':'تفاصيل المعاملة', withdrawals:'السحوبات', campaigns:'الحملات', proofs:'إثباتات المهام', ads:'مخزون Adstera', settings:'الإعدادات', notifications:'الإشعارات', suspicious:'مستخدمون مشبوهون' };
const cx = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(' ');
const cell = 'px-4 py-1.5 text-right align-middle';
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition hover:-translate-y-px disabled:opacity-40';
const primary = `${btn} bg-[#1557ee] text-white`;
const soft = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
function getState(): State { try { const s = localStorage.getItem(KEY); if (!s) return seed; const stored=JSON.parse(s) as Partial<State>; const campaigns=stored.campaigns??seed.campaigns; const deposits=(stored.deposits??seed.deposits).map(row=>{const baseline=seed.deposits.find(item=>item.id===row.id);return {...baseline,...row,credited:row.credited??baseline?.credited??row.status==='ناجح',balanceBefore:row.balanceBefore??baseline?.balanceBefore,balanceAfter:row.balanceAfter??baseline?.balanceAfter}}); return { ...seed, ...stored, ads: [], deposits, campaigns:[...campaigns,...seed.campaigns.filter(c=>!campaigns.some(existing=>existing.id===c.id))], settings:{...seed.settings,...stored.settings} }; } catch { return seed; } }
function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className="grid gap-1.5 text-xs font-bold text-slate-600">{label}<input {...props} className={cx('w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100', props.className)} /></label>; }
function Badge({ children }: { children: React.ReactNode }) { const good = ['نشط','ناجح','معتمد','مفعّل','تمت المراجعة'].includes(String(children)); const bad = ['محظور','فاشل','مرفوض','موقوف'].includes(String(children)); return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${good?'bg-emerald-50 text-emerald-700':bad?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700'}`}>{children}</span>; }

export function AdminConsole({ activeScreen, onPageChange }: { activeScreen: string; onPageChange: (page: string) => void }) {
 const [data, setData] = useState<State>(getState);
 const pricing = useLocalPricing();
 const [page, setPage] = useState(() => activeScreen.startsWith('admin-') ? activeScreen.slice(6) : 'overview');
 const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
  const adstera = useAdsteraAds();
  const [adDraft, setAdDraft] = useState<AdsteraAd | null>(null);
  const [adPreview, setAdPreview] = useState<AdsteraAd | null>(null);
  const [adPreviewKey, setAdPreviewKey] = useState(0);
  const [adQuery, setAdQuery] = useState('');
  const [adStatus, setAdStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
 const [query, setQuery] = useState('');
 const [pageNo, setPageNo] = useState(1);
 const [dialog, setDialog] = useState<{kind:string; id?:string|number}|null>(null);
 const [pendingAction, setPendingAction] = useState<(()=>void)|null>(null);
 const [filter, setFilter] = useState('الكل');
 const [toast, setToast] = useState('');
 useEffect(() => {
  const nextPage = activeScreen.startsWith('admin-') ? activeScreen.slice(6) : 'overview';
  if (nextPage in labels) {
   setPage(nextPage);
   setQuery('');
   setFilter('الكل');
   setPageNo(1);
  }
 }, [activeScreen]);
 useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }, [data]);
 const navigateToPage = (nextPage: string) => {
  setPage(nextPage);
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
  const rowData = (key: 'deposits'|'withdrawals'|'campaigns'|'proofs'|'suspicious') => data[key].filter(r=>(filter==='الكل'||r.status===filter)&&(!query||[r.id,...(key==='deposits'?[r.memoTag,r.txId]:[]),r.destination,r.title,r.taskId,r.attempt,userBy(r.userId)?.name,userBy(r.userId)?.username].some(x=>String(x??'').toLowerCase().includes(query.toLowerCase()))));
  const search = <div className="relative min-w-0 flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>{setQuery(e.target.value);setPageNo(1)}} placeholder={page==='withdrawals'?'ابحث بالمعرّف أو الاسم أو الوجهة…':'ابحث بالمعرّف أو الاسم أو الوسم…'} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pe-10 ps-3 text-sm outline-none focus:border-blue-400" /></div>;
 const statusSelect = (statuses:string[]) => <select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"><option>الكل</option>{statuses.map(x=><option key={x}>{x}</option>)}</select>;
   const header = <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><div className="mb-0.5 text-[10px] font-bold tracking-wide text-[#1557ee]">VIDREWARD / OPERATIONS</div><h1 className="text-xl font-extrabold tracking-tight text-[#12234b] sm:text-2xl">{title}</h1></div></div>;
  const panel = (children:React.ReactNode, cls='') => <section className={`rounded-2xl bg-white/90 p-4 md:p-5 ${cls}`}>{children}</section>;
  const table = (head:string[], rows:React.ReactNode[]) => {
   const labeledRows=rows.map((row,rowIndex)=>{if(!isValidElement(row))return row;const element=row as ReactElement<{children?:React.ReactNode}>;const cells=Children.toArray(element.props.children).map((child,index)=>isValidElement(child)?cloneElement(child as ReactElement<Record<string,unknown>>,{ 'data-label':head[index] }):child);return cloneElement(element,{key:element.key??rowIndex},...cells);});
   return panel(<div className="admin-table-wrap"><table className="admin-table w-full border-collapse text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] text-slate-500">{head.map(x=><th className={cell} key={x}>{x}</th>)}</tr></thead><tbody>{labeledRows}</tbody></table></div>);
  };
 const confirm = (message:string, onConfirm:()=>void) => { setPendingAction(()=>onConfirm); setDialog({kind:'confirm', id:message}); };
 const action = (text:string, cb:()=>void, danger=false) => <button onClick={cb} className={`${btn} ${danger?'bg-rose-50 text-rose-700':'bg-slate-100 text-slate-700'}`}>{text}</button>;

 const content = () => {
   if(page==='overview') return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-x-4 rounded-2xl bg-white px-4 sm:grid-cols-3">{[
    ['مستخدمون مسجلون',data.users.length,Users],
    ['حملات نشطة',data.campaigns.filter(x=>x.status==='نشطة').length,Megaphone],
    ['حملات أوقفتها الميزانية',data.campaigns.filter(x=>x.status==='أوقفتها الميزانية').length,Activity],
    ['إيداعات ناجحة · USDT',data.deposits.filter(x=>x.status==='ناجح').reduce((sum,x)=>sum+(x.method==='Stars'?Number(x.amount??0)*0.01:Number(x.amount??0)),0).toFixed(2),CircleDollarSign],
    ['إجمالي أرباح الفيديو',data.users.reduce((sum,u)=>sum+u.earnedBalance,0).toFixed(3),Wallet],
    ['مستخدمون حظرهم النظام',data.users.filter(x=>x.bannedBySystem).length,ShieldCheck]
     ].map(([l,v,I]:any)=><div key={l} className="flex min-h-[74px] items-center justify-between gap-2 border-b border-slate-100 py-2.5"><div className="min-w-0"><div className="text-[10px] font-bold leading-4 text-slate-500">{l}</div><div className="mt-0.5 flex flex-wrap items-baseline gap-x-2"><span className="text-xl font-extrabold text-[#12234b]">{v}</span></div></div><I className="h-4 w-4 shrink-0 text-[#1557ee]"/></div>)}</div>
    {panel(<><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><ShieldCheck size={20}/></span><div><h2 className="font-extrabold">مركز العمليات</h2><p className="mt-1 text-sm leading-6 text-slate-500">تابع الطلبات والإثباتات وإشارات المخاطر من مساحة واحدة.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{[['طلبات السحب',data.withdrawals.filter(x=>x.status==='قيد المراجعة').length,'withdrawals'],['إثباتات المهام',data.proofs.filter(x=>x.status==='قيد المراجعة').length,'proofs'],['إشارات المخاطر',data.suspicious.filter(x=>x.status==='مفتوح').length,'suspicious'],['تقارير الإرسال',data.reports.length,'notifications']].map(([a,b,c])=><button key={c} onClick={()=>navigateToPage(String(c))} className="flex items-center justify-between rounded-xl bg-[#f7f9fc] p-4 text-right"><span className="text-sm font-bold">{a}</span><span className="font-mono text-lg font-bold text-[#1557ee]">{b}</span></button>)}</div></>)}
  </div>;
  if(page==='users') return <div className="space-y-4">{panel(<div className="flex flex-wrap gap-3">{search}<span className="self-center text-xs text-slate-400">حد أقصى 100 مستخدم في الصفحة</span></div>)}{table(['المستخدم','Telegram ID','رصيد المعلن','الأرباح','الحالة','آخر نشاط',''],visibleUsers.map(u=><tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/70"><td className={cell}><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf3ff] text-xs font-extrabold text-[#1557ee]">{u.avatar}</span><div><b>{u.name}</b><div className="text-xs text-slate-400">@{u.username}</div></div></div></td><td className={`${cell} font-mono`}>{u.id}</td><td className={`${cell} font-mono`}>{u.advertiserBalance.toFixed(2)} $</td><td className={`${cell} font-mono`}>{u.earnedBalance.toFixed(3)} $</td><td className={cell}><Badge>{u.status}</Badge></td><td className={cell}>{u.lastActive}</td><td className={cell}><button className={soft} onClick={()=>setDialog({kind:'user',id:u.id})}>التفاصيل</button></td></tr>))}{panel(<div className="flex items-center justify-between text-xs text-slate-500"><span>{filteredUsers.length} مستخدم</span><div className="flex gap-2"><button className={soft} disabled={pageNo<=1} onClick={()=>setPageNo(n=>n-1)}>السابق</button><span className="px-2 py-2">صفحة {pageNo} / {Math.max(1,Math.ceil(filteredUsers.length/pageSize))}</span><button className={soft} disabled={pageNo>=Math.ceil(filteredUsers.length/pageSize)} onClick={()=>setPageNo(n=>n+1)}>التالي</button></div></div>)}</div>;
   if(page==='deposits') return <div className="space-y-4">{panel(<div className="flex flex-wrap gap-3">{search}{statusSelect(['ناجح','فاشل'])}</div>)}{table(['العملية / المعاملة','المستخدم','الطريقة','المبلغ','Memo / Tag','المحفظة','الحالة / الوقت'],rowData('deposits').map(r=><tr key={r.id} tabIndex={0} role="button" onClick={()=>{setSelectedDepositId(r.id);setPage('deposit-detail')}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedDepositId(r.id);setPage('deposit-detail')}}} className="cursor-pointer border-b border-slate-50 hover:bg-blue-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1557ee]"><td className={cell}><b>{r.id}</b><div className="text-[11px] text-slate-400">{r.txId}</div></td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.method}</td><td className={`${cell} font-mono`}>{r.amount} {r.method==='Stars'?'XTR':'USDT'}</td><td className={`${cell} font-mono`}>{r.memoTag}</td><td className={`${cell} font-mono`}>{r.wallet||'—'}</td><td className={cell}><Badge>{r.status}</Badge><div className="mt-1 text-[10px] text-slate-400">{r.createdAt}</div>{r.reason&&<div className="mt-1 max-w-40 text-[10px] text-rose-600">{r.reason}</div>}</td></tr>))}</div>;
   if(page==='deposit-detail') {
    const deposit=data.deposits.find(row=>row.id===selectedDepositId);
    const user=userBy(deposit?.userId);
    if(!deposit) return <div className="space-y-4">{panel(<><p className="font-bold">تعذر العثور على المعاملة.</p><button className={`${soft} mt-3`} onClick={()=>navigateToPage('deposits')}>العودة إلى الإيداعات</button></>)}</div>;
    const balanceBefore=Number(deposit.balanceBefore ?? (deposit.credited ? (user?.advertiserBalance ?? 0)-Number(deposit.amount??0) : user?.advertiserBalance ?? 0));
    const markFailed=()=>{setData(current=>({...current,deposits:current.deposits.map(row=>row.id===deposit.id?{...row,status:'فاشل',credited:false,reason:row.reason||'تم وضع علامة فاشل يدويًا'}:row),users:deposit.credited?current.users.map(item=>item.id===deposit.userId?{...item,advertiserBalance:Number(Math.max(0,item.advertiserBalance-Number(deposit.amount??0)).toFixed(2))}:item):current.users}));announce('تم وضع علامة فاشل وعكس الرصيد المضاف');};
    return <div className="space-y-4">{panel(<div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-slate-400">معاملة إيداع</p><h2 className="mt-1 font-mono text-xl font-extrabold">{deposit.id}</h2></div><button className={soft} onClick={()=>navigateToPage('deposits')}>العودة إلى الإيداعات</button></div>)}{panel(<div className="grid gap-4 sm:grid-cols-2"><div><div className="text-xs text-slate-400">المستخدم</div><div className="mt-1 font-bold">{user?.name ?? 'مستخدم غير معروف'} · {deposit.userId}</div></div><div><div className="text-xs text-slate-400">الطريقة والمبلغ</div><div className="mt-1 font-bold">{deposit.method} · {deposit.amount} {deposit.method==='Stars'?'XTR':'USDT'}</div></div><div><div className="text-xs text-slate-400">Memo / Tag</div><div className="mt-1 font-mono text-sm">{deposit.memoTag||'—'}</div></div><div><div className="text-xs text-slate-400">معرّف التحويل</div><div className="mt-1 font-mono text-sm">{deposit.txId||'—'}</div></div><div><div className="text-xs text-slate-400">المحفظة</div><div className="mt-1 font-mono text-sm" dir="ltr">{deposit.wallet||'—'}</div></div><div><div className="text-xs text-slate-400">التاريخ</div><div className="mt-1 text-sm">{deposit.createdAt||'—'}</div></div><div><div className="text-xs text-slate-400">الرصيد قبل الإيداع</div><div className="mt-1 font-mono text-lg font-bold">{balanceBefore.toFixed(2)} USDT</div></div><div><div className="text-xs text-slate-400">الرصيد الحالي</div><div className="mt-1 font-mono text-lg font-bold">{Number(user?.advertiserBalance??0).toFixed(2)} USDT</div></div><div><div className="text-xs text-slate-400">الحالة</div><div className="mt-1"><Badge>{deposit.status}</Badge></div></div>{deposit.reason&&<div className="sm:col-span-2 text-sm text-rose-600">{deposit.reason}</div>}</div>)}{panel(<div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs leading-5 text-slate-500">عكس الرصيد يحدث فقط إذا كان هذا الإيداع قد أضافه فعلًا.</div><div className="flex gap-2"><button className={soft} onClick={()=>{navigateToPage('users');setDialog({kind:'user',id:deposit.userId})}} disabled={!user}>فتح تفاصيل المستخدم</button>{deposit.status!=='فاشل'&&<button className={`${btn} bg-rose-50 text-rose-700`} onClick={markFailed}>وضع علامة فاشل</button>}</div></div>)}</div>;
   }
   if(page==='withdrawals') return <div className="space-y-4">{panel(<div className="flex gap-3">{search}{statusSelect(['قيد المراجعة','معتمد','مرفوض'])}</div>)}{table(['الطلب','المستخدم','القناة','المبلغ','الوجهة','التاريخ','الإجراء'],rowData('withdrawals').map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}><b>{r.id}</b></td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.method}</td><td className={cell}><button className="inline-flex items-center gap-1 font-mono" aria-label="نسخ المبلغ" onClick={()=>{navigator.clipboard?.writeText(`${r.amount} USDT`);announce('تم نسخ المبلغ')}}>{r.amount} USDT<Copy size={13}/></button></td><td className={cell}><div className="flex items-center gap-1 font-mono"><span dir="ltr">{r.destination}</span><button aria-label="نسخ الوجهة" onClick={()=>{navigator.clipboard?.writeText(r.destination);announce('تم النسخ')}}><Copy size={14}/></button></div></td><td className={cell}>{r.createdAt}</td><td className={cell}>{r.status==='قيد المراجعة'?<div className="flex gap-1">{action('اعتماد',()=>{updateRows('withdrawals',r.id,{status:'معتمد'});announce('تم اعتماد الطلب')})}{action('رفض',()=>confirm('رفض طلب السحب؟',()=>{updateRows('withdrawals',r.id,{status:'مرفوض'});setDialog(null)}),true)}</div>:<Badge>{r.status}</Badge>}</td></tr>))}</div>;
  if(page==='campaigns') return <div className="space-y-4">{panel(<div className="flex gap-3">{search}{statusSelect(['بانتظار المراجعة','نشطة','موقوفة','مرفوضة','أوقفتها الميزانية'])}</div>)}{table(['الحملة','المستخدم','المنصة','المدة','الميزانية','المشاهدات','الحالة','مراجعة'],rowData('campaigns').map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}><b>{r.title}</b><div className="text-xs text-slate-400">{r.id}</div></td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.platform}</td><td className={cell}>{r.duration} ث</td><td className={cell}>{r.budget} USDT</td><td className={cell}>{r.views.toLocaleString()}</td><td className={cell}><Badge>{r.status}</Badge></td><td className={cell}><button className={soft} onClick={()=>setDialog({kind:'campaign',id:r.id})}>فيديو وإجراءات</button></td></tr>))}</div>;
   if(page==='proofs') return <div className="space-y-4">{panel(<div className="flex gap-3">{search}{statusSelect(['قيد المراجعة','معتمد','مرفوض'])}</div>)}{table(['الإثبات','المستخدم','المهمة','المكافأة','الحالة','المرفق','الإجراء'],rowData('proofs').map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}>{r.id}</td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.taskId}<div className="text-xs text-slate-400">{r.taskType}</div></td><td className={cell}>{r.reward} USDT</td><td className={cell}><Badge>{r.status}</Badge></td><td className={cell}><button className={soft} onClick={()=>setDialog({kind:'proof',id:r.id})}>عرض الصورة</button></td><td className={cell}>{r.status==='قيد المراجعة'?<div className="flex gap-1">{action('اعتماد المكافأة',()=>{setData(d=>{const p=d.proofs.find(x=>x.id===r.id);if(!p||p.status!=='قيد المراجعة')return d;return {...d,proofs:d.proofs.map(x=>x.id===r.id?{...x,status:'معتمد'}:x),users:d.users.map(u=>u.id===p.userId?{...u,earnedBalance:Number((u.earnedBalance+p.reward).toFixed(6))}:u)}});announce('تم اعتماد الإثبات وإضافة المكافأة')})}{action('رفض',()=>setDialog({kind:'reject-proof',id:r.id}),true)}</div>:r.rejectionReason||<Badge>{r.status}</Badge>}</td></tr>))}</div>;
   if(page==='ads') {
      const filteredAds=adstera.ads.filter(ad=>
        (adStatus==='all'||(adStatus==='enabled'?ad.enabled:!ad.enabled))
        &&(!adQuery||`${ad.name} ${ad.id} ${ad.format}`.toLowerCase().includes(adQuery.trim().toLowerCase()))
      );
      const beginAdd=()=>{
        setAdDraft({id:`adstera-custom-${Date.now()}`,name:'',format:'social',code:'',enabled:false,updatedAt:new Date().toISOString().slice(0,10),builtIn:false});
        setAdPreview(null);
        window.scrollTo(0,0);
      };
      const startEdit=(ad:AdsteraAd)=>{
        setAdDraft({...ad});
        setAdPreview({...ad});
        window.scrollTo(0,0);
      };
      const refreshPreview=(ad:AdsteraAd)=>{
        setAdPreview({...ad});
        setAdPreviewKey(value=>value+1);
        window.scrollTo(0,0);
      };
      const saveDraft=()=>{
        if(!adDraft){return;}
        if(!adDraft.name.trim()){announce('أدخل اسمًا واضحًا للكود قبل الحفظ');return;}
        if(!adDraft.code.trim()){announce('أضف الشيفرة المطلوبة قبل الحفظ');return;}
        try{
          const nextAd={...adDraft,name:adDraft.name.trim(),updatedAt:new Date().toISOString().slice(0,10)};
          adstera.save(adstera.ads.some(ad=>ad.id===nextAd.id)?adstera.ads.map(ad=>ad.id===nextAd.id?nextAd:ad):[nextAd,...adstera.ads]);
           setAdDraft(null);
           setAdPreview(null);
          announce('تم حفظ كود Adstera بنجاح');
           window.scrollTo(0,0);
        }catch{announce('تعذر حفظ الكود. تحقق من مساحة التخزين ثم حاول مجددًا');}
      };
      const toggleAd=(ad:AdsteraAd)=>{
        try{adstera.save(adstera.ads.map(item=>item.id===ad.id?{...item,enabled:!item.enabled,updatedAt:new Date().toISOString().slice(0,10)}:item));announce(ad.enabled?'تم تعطيل الكود':'تم تفعيل الكود');}
        catch{announce('تعذر تحديث حالة الكود');}
      };
      const editorField='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-[#12234b] outline-none transition focus:border-[#1557ee] focus:ring-2 focus:ring-blue-100';
      const draftChange=(patch:Partial<AdsteraAd>)=>{
        setAdDraft(current=>current?{...current,...patch}:current);
        if(adPreview&&adDraft?.id===adPreview.id)setAdPreview(current=>current?{...current,...patch}:current);
      };
      const previewFrame=(ad:AdsteraAd)=>ad.code.trim()
        ? <iframe key={`${ad.id}-${adPreviewKey}`} title={`معاينة ${ad.name||'الكود الجديد'}`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={buildAdsteraDocument(ad)} className={`mx-auto block max-w-full rounded-lg border border-slate-200 bg-white ${ad.format==='320x50'?'h-[70px] w-[320px]':'h-[100px] w-[320px]'}`} data-testid="iframe-ad-code-preview"/>
        : <div data-testid="empty-ad-preview" className="grid min-h-[100px] place-items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 text-center text-[11px] leading-5 text-slate-400">أدخل الشيفرة لمعاينتها هنا.</div>;
      const previewAd=adPreview??adDraft;
      if(adDraft) return <div dir="rtl" data-testid="page-ad-code-editor" className="space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6ebf3] bg-white p-4 sm:p-5">
          <div><div className="text-[10px] font-extrabold tracking-[.12em] text-[#1557ee]">{adDraft.builtIn?'EDIT ADSTERRA CODE':'NEW ADSTERRA CODE'}</div><h2 className="mt-1 text-lg font-extrabold">{adDraft.builtIn?'تعديل الكود':'إضافة كود جديد'}</h2><p className="mt-1 text-xs text-slate-500">أدخل اسم الكود ونوعه والشيفرة كاملة، ثم راجع المعاينة قبل الحفظ.</p></div>
          <button type="button" data-testid="button-close-ad-editor" className={soft} onClick={()=>{setAdDraft(null);setAdPreview(null);window.scrollTo(0,0);}}>العودة إلى الأكواد</button>
        </section>
        <form data-testid="form-ad-code-editor" onSubmit={event=>{event.preventDefault();saveDraft();}} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
          <section className="space-y-4 rounded-2xl border border-[#dce5f3] bg-white p-4 shadow-[0_12px_30px_rgba(18,35,75,.06)] sm:p-5">
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">اسم الكود
              <input required data-testid="input-ad-code-name" aria-label="اسم الكود" value={adDraft.name} onChange={event=>draftChange({name:event.target.value})} placeholder="مثال: موضع Social للحملات" className={editorField}/>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">نوع الإعلان
              <select required data-testid="select-ad-code-format" aria-label="نوع الإعلان" value={adDraft.format} onChange={event=>draftChange({format:event.target.value as AdsteraFormat})} className={`${editorField} font-bold`}>
                <option value="social">Social</option><option value="320x50">Banner · 320 × 50</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">الشيفرة الإعلانية
              <textarea required data-testid="textarea-ad-code" aria-label="الشيفرة الإعلانية" value={adDraft.code} onChange={event=>draftChange({code:event.target.value})} rows={12} spellCheck={false} dir="ltr" placeholder="ألصق الشيفرة كاملة كما استلمتها من Adsterra…" className="w-full resize-y rounded-xl border border-[#243655] bg-[#111c32] p-3.5 font-mono text-xs leading-6 text-emerald-100 outline-none placeholder:text-slate-500 focus:border-[#7198ff] focus:ring-2 focus:ring-blue-100"/>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" data-testid="button-save-ad-code" className={primary}><Check size={15}/>حفظ الكود</button>
              <button type="button" data-testid="button-refresh-ad-preview" className={soft} onClick={()=>refreshPreview(adDraft)}><RefreshCw size={14}/>تحديث المعاينة</button>
            </div>
          </section>
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-[#f4f7fb] p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-2"><div><div className="flex items-center gap-2 text-sm font-extrabold text-[#17284d]"><Eye size={16} className="text-[#1557ee]"/>معاينة مباشرة</div><p className="mt-1 text-xs leading-5 text-slate-500">تتحدّث المعاينة مع تعديل الشيفرة؛ زر التحديث يعيد تحميلها يدويًا.</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">معزولة</span></div>
            <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-slate-200 bg-white p-3">{previewAd?previewFrame(previewAd):null}</div>
            <p className="mt-3 text-[10px] leading-5 text-slate-500">يعمل الكود داخل إطار معزول بصلاحية تشغيل النصوص فقط. ظهور إعلان Adsterra يعتمد أيضًا على استجابة مزوّد الإعلان.</p>
          </section>
        </form>
      </div>;
      if(adPreview) return <div dir="rtl" data-testid="page-ad-code-preview" className="space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6ebf3] bg-white p-4 sm:p-5">
          <div><div className="text-[10px] font-extrabold tracking-[.12em] text-[#1557ee]">ADSTERRA PREVIEW</div><h2 className="mt-1 text-lg font-extrabold">معاينة {adPreview.name}</h2><p className="mt-1 text-xs text-slate-500">هذه معاينة فعلية للشيفرة داخل إطار معزول.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="button-back-ad-preview" className={soft} onClick={()=>{setAdPreview(null);window.scrollTo(0,0);}}>العودة إلى الأكواد</button>
            <button type="button" data-testid="button-refresh-ad-preview" className={soft} onClick={()=>refreshPreview(adPreview)}><RefreshCw size={14}/>تحديث المعاينة</button>
            <button type="button" data-testid="button-edit-previewed-ad" className={primary} onClick={()=>startEdit(adPreview)}><Pencil size={14}/>تعديل</button>
          </div>
        </section>
        <section className="rounded-2xl border border-[#dce5f3] bg-white p-4 shadow-[0_8px_24px_rgba(18,35,75,.045)] sm:p-6">
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-slate-200 bg-[#f4f7fb] p-4">{previewFrame(adPreview)}</div>
          <p className="mt-4 text-xs leading-5 text-slate-500">إذا بقيت المساحة فارغة، تحقق من صلاحية الشيفرة واستجابة Adsterra. الإطار معزول عمدًا ولا يملك صلاحية الوصول إلى لوحة الإدارة.</p>
        </section>
      </div>;
      return <div dir="rtl" data-testid="page-adstera-management" className="space-y-4">
        <section className="relative overflow-hidden rounded-[1.35rem] bg-[#132449] p-5 text-white shadow-[0_16px_36px_rgba(18,35,75,.12)] sm:p-6">
          <div className="pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full border border-white/10"/><div className="pointer-events-none absolute -left-4 -top-8 h-36 w-36 rounded-full border border-white/10"/>
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold tracking-[.14em] text-[#f6c453]"><Code2 size={14}/> ADSTERRA / INVENTORY</div><h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">إدارة أكواد الإعلانات</h2><p className="mt-2 max-w-xl text-xs leading-6 text-blue-100/75 sm:text-sm">تحكّم في الأكواد التي تظهر ضمن حملات صناع المحتوى، وعاين كل موضع داخل بيئة معزولة قبل النشر.</p></div>
            <button type="button" data-testid="button-add-ad-code" className={`${primary} min-h-11 rounded-xl bg-[#f6c453] px-4 text-[#17213a] hover:bg-[#ffdc7e]`} onClick={beginAdd}><Plus size={16}/> إضافة كود</button>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-2 sm:flex sm:gap-2">
            <div className="min-w-[120px] rounded-xl border border-white/10 bg-white/[.06] px-3 py-2"><div className="text-[10px] font-bold text-blue-100/65">إجمالي الأكواد</div><div data-testid="text-ad-code-total" className="mt-1 font-mono text-lg font-bold">{adstera.ads.length}</div></div>
            <div className="min-w-[120px] rounded-xl border border-white/10 bg-white/[.06] px-3 py-2"><div className="text-[10px] font-bold text-blue-100/65">مفعّلة</div><div className="mt-1 font-mono text-lg font-bold text-emerald-300">{adstera.ads.filter(ad=>ad.enabled).length}</div></div>
            <div className="min-w-[120px] rounded-xl border border-white/10 bg-white/[.06] px-3 py-2"><div className="text-[10px] font-bold text-blue-100/65">معطّلة</div><div className="mt-1 font-mono text-lg font-bold text-amber-200">{adstera.ads.filter(ad=>!ad.enabled).length}</div></div>
          </div>
        </section>
        <section className="rounded-2xl border border-[#e6ebf3] bg-white p-3 shadow-[0_5px_18px_rgba(18,35,75,.035)] sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1"><span className="sr-only">البحث في الأكواد</span><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/><input data-testid="input-ad-code-search" aria-label="البحث في الأكواد" value={adQuery} onChange={e=>setAdQuery(e.target.value)} placeholder="ابحث بالاسم أو المعرّف…" className={`${editorField} pe-10`}/></label>
            <label className="sr-only" htmlFor="ad-code-status">تصفية الحالة</label><select id="ad-code-status" data-testid="select-ad-code-status" aria-label="تصفية الأكواد حسب الحالة" value={adStatus} onChange={e=>setAdStatus(e.target.value as 'all'|'enabled'|'disabled')} className={`${editorField} sm:w-44`}><option value="all">كل الحالات</option><option value="enabled">مفعّلة فقط</option><option value="disabled">معطّلة فقط</option></select>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500"><span data-testid="text-ad-code-count">عرض {filteredAds.length} من {adstera.ads.length} كود</span><span className="hidden items-center gap-1.5 sm:flex"><ShieldCheck size={13} className="text-emerald-600"/> معاينة ضمن sandbox بلا صلاحية الوصول للأصل</span></div>
        </section>
        {filteredAds.length===0
          ? <section data-testid="empty-ad-codes" className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#edf3ff] text-[#1557ee]"><Search size={19}/></span><h3 className="mt-3 font-extrabold text-[#12234b]">{adstera.ads.length?'لا توجد نتائج مطابقة':'لا توجد أكواد محفوظة'}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{adstera.ads.length?'جرّب تغيير عبارة البحث أو مرشح الحالة.':'أضف كودًا جديدًا لبدء إدارة مواضع Adstera.'}</p>{!adstera.ads.length&&<button type="button" className={`${primary} mt-4`} onClick={beginAdd}>إضافة أول كود</button>}</section>
          : table(['الكود','التنسيق','الحالة','آخر تحديث','الإجراءات'],filteredAds.map(ad=><tr data-testid={`row-ad-code-${ad.id}`} key={ad.id} className="border-b border-slate-50 transition hover:bg-[#f8faff]">
              <td className={cell}><div className="flex min-w-0 items-center gap-2.5"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ad.format==='social'?'bg-[#edf3ff] text-[#1557ee]':'bg-[#fff5dd] text-[#9a6b09]'}`}>{ad.format==='social'?<Layers size={16}/>:<Monitor size={16}/>}</span><div className="min-w-0"><div className="truncate font-extrabold text-[#17284d]">{ad.name||'كود بلا اسم'}</div><div className="truncate font-mono text-[10px] text-slate-400" dir="ltr">{ad.id}{ad.builtIn?' · مدمج':''}</div></div></div></td>
              <td className={cell}><span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-extrabold ${ad.format==='social'?'bg-blue-50 text-blue-700':'bg-amber-50 text-amber-800'}`} dir="ltr">{ad.format==='social'?'Social':'320 × 50'}</span></td>
              <td className={cell}><span data-testid={`status-ad-code-${ad.id}`}><Badge>{ad.enabled?'مفعّل':'معطّل'}</Badge></span></td>
              <td className={`${cell} text-xs text-slate-500`}>{ad.updatedAt||'—'}</td>
              <td className={cell}><div className="flex flex-wrap gap-1.5"><button type="button" data-testid={`button-preview-ad-${ad.id}`} aria-label={`معاينة ${ad.name}`} className={`${soft} min-h-9 px-2.5`} onClick={()=>refreshPreview(ad)}><Eye size={14}/>معاينة</button><button type="button" data-testid={`button-edit-ad-${ad.id}`} aria-label={`تعديل ${ad.name}`} className={`${soft} min-h-9 px-2.5`} onClick={()=>startEdit(ad)}><Pencil size={14}/>تعديل</button><button type="button" data-testid={`button-toggle-ad-${ad.id}`} aria-label={`${ad.enabled?'تعطيل':'تفعيل'} ${ad.name}`} className={`${btn} min-h-9 px-2.5 ${ad.enabled?'bg-amber-50 text-amber-800':'bg-emerald-50 text-emerald-800'}`} onClick={()=>toggleAd(ad)}>{ad.enabled?'تعطيل':'تفعيل'}</button></div></td>
            </tr>))}
      </div>;
   }
   if(page==='settings') return <SettingsPanel values={data.settings} pricing={pricing} onSave={v=>{setData(d=>({...d,settings:v}));announce('تم حفظ الإعدادات')}} onPricingSave={nextPricing=>{saveLocalPricing(nextPricing);announce('تم تحديث الأسعار')}}/>;
   if(page==='notifications') return <NotificationPanel reports={data.reports} onSend={r=>{setData(d=>({...d,reports:[{...r,id:`NTF-${Date.now()}`,createdAt:new Date().toLocaleString('ar'),status:'مسودة'},...d.reports]}));announce('تم حفظ التقرير')}}/>;
  return <div className="space-y-4">{panel(<div className="flex gap-3">{search}{statusSelect(['مفتوح','تمت المراجعة'])}</div>)}{table(['الإشارة','المستخدم','نوع الإشارة','الوقت','الحالة','الإجراء'],rowData('suspicious').map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}>{r.id}</td><td className={cell}>{userBy(r.userId)?.name} · {r.userId}</td><td className={cell}>{r.attempt}</td><td className={cell}>{r.createdAt}</td><td className={cell}><Badge>{r.status}</Badge></td><td className={cell}>{action('حظر المستخدم',()=>confirm('حظر هذا المستخدم؟',()=>{setData(d=>({...d,users:d.users.map(u=>u.id===r.userId?{...u,status:'محظور'}:u),suspicious:d.suspicious.map(x=>x.id===r.id?{...x,status:'تمت المراجعة'}:x)}));setDialog(null)}),true)}</td></tr>))}</div>;
 };

  return <main dir="rtl" className="admin-console min-h-[100dvh] bg-[#f7f9fc] px-3 pb-28 pt-4 text-[#12234b] sm:px-6 lg:px-8">
  <div className="mx-auto max-w-[1440px]">{header}
    <div className="mt-5">{content()}</div>
  </div>
  {toast&&<div role="status" className="fixed bottom-20 right-4 z-[110] rounded-xl bg-[#12234b] px-4 py-3 text-sm font-bold text-white shadow-xl">{toast}</div>}
  {dialog&&<Dialog dialog={dialog} data={data} userBy={userBy} onClose={()=>setDialog(null)} onConfirmAction={()=>{pendingAction?.();setPendingAction(null);setDialog(null);announce('تم تطبيق الإجراء')}} onConfirm={(id,patch)=>{if(dialog.kind==='user-edit'||dialog.kind==='user'){setData(d=>({...d,users:d.users.map(u=>u.id===id?{...u,...patch}:u)}))}else if(dialog.kind==='reject-proof'){updateRows('proofs',id as string,patch)}else if(dialog.kind==='campaign'){updateRows('campaigns',id as string,patch)}setDialog(null);announce('تم حفظ التغيير')}} onDelete={id=>{setData(d=>({...d,users:d.users.filter(u=>u.id!==id)}));setDialog(null)}} onAction={cb=>{confirm('تأكيد الإجراء؟',cb)}}/>}
 </main>;
}

function SettingsPanel({values,onSave,pricing,onPricingSave}:{values:Record<string,any>;onSave:(v:Record<string,any>)=>void;pricing:LocalPricing;onPricingSave:(pricing:LocalPricing)=>void}) {
 const [v,setV]=useState(values); useEffect(()=>setV(values),[values]);
 const [editing,setEditing]=useState<{platform:PricingPlatform;index:number}|null>(null);
 const [tierDraft,setTierDraft]=useState({value:'',price:''});
 const [pricingDraft,setPricingDraft]=useState(pricing); useEffect(()=>setPricingDraft(pricing),[pricing]);
 const pricingOptions:[PricingPlatform,string][]=[['youtube','YouTube'],['tiktok','TikTok'],['telegram','Telegram']];
 const fields:[string,string][]=[['binanceWithdrawMin','الحد الأدنى للسحب عبر Binance (USDT)'],['web3WithdrawMin','الحد الأدنى للسحب عبر Web3 (USDT)'],['starsDepositMin','الحد الأدنى للإيداع عبر Stars'],['web3DepositMin','الحد الأدنى للإيداع عبر Web3 (USDT)'],['userShare','حصة المستخدم من الإيراد (%)'],['platformShare','حصة المنصة (%)'],['durationMin','أقصر مدة فيديو (ثانية)'],['durationMax','أطول مدة فيديو (ثانية)'],['cpmMin','أقل CPM'],['cpmMax','أعلى CPM'],['telegramCpm','CPM إعلانات Telegram'],['tiktokCpm','CPM إعلانات TikTok'],['telegramTaskReward','مكافأة مهمة Telegram الثابتة (USDT)'],['tiktokTaskReward','مكافأة مهمة TikTok الثابتة (USDT)'],['web3Address','عنوان Web3']];
 const openTier=(platform:PricingPlatform,index:number)=>{const tier=pricingDraft[platform][index];setTierDraft({value:String(tier.value),price:String(tier.price)});setEditing({platform,index});};
 const saveTier=()=>{if(!editing)return;const value=Number(tierDraft.value),price=Number(tierDraft.price);if(!Number.isFinite(value)||value<=0||!Number.isFinite(price)||price<0)return;const next={...pricingDraft,[editing.platform]:pricingDraft[editing.platform].map((tier,index)=>index===editing.index?{value,price}:tier)};setPricingDraft(next);onPricingSave(next);setEditing(null);};
  return <div className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="mb-4 font-extrabold">ضوابط المنصة</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fields.map(([key,label])=><Field key={key} label={label} type={key==='web3Address'?'text':'number'} step="any" value={v[key]} onChange={e=>setV({...v,[key]:key==='web3Address'?e.target.value:Number(e.target.value)})}/>)}</div><label className="mt-4 flex min-h-11 items-center gap-3 rounded-xl bg-[#fff9eb] p-3 text-sm font-bold"><input type="checkbox" checked={v.maintenance} onChange={e=>setV({...v,maintenance:e.target.checked})}/> وضع الصيانة</label><button className={`${primary} mt-4 min-h-11`} onClick={()=>onSave(v)}>حفظ الإعدادات</button></section>
  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4"><h2 className="font-extrabold">أسعار المعلنين</h2><p className="mt-1 text-xs leading-5 text-slate-500">مكافآت مهام Telegram وTikTok الثابتة مستقلة عن هذه الأسعار.</p></div><div className="space-y-5">{pricingOptions.map(([platform,name])=><div key={platform}><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-extrabold">{name}</h3><span className="text-[10px] text-slate-400">٤ خيارات ثابتة</span></div><div className="divide-y divide-slate-100 rounded-xl bg-[#f8faff] px-3">{pricingDraft[platform].map((tier,index)=><div key={`${platform}-${index}`} className="flex min-h-14 items-center gap-2 py-2"><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{tier.value.toLocaleString('en-US')} {platform==='youtube'?'ثانية':platform==='tiktok'?'متابع':'مشترك'}</div><div className="mt-0.5 text-[11px] text-slate-500">{platform==='youtube'?<><b className="font-mono text-[#12234b]">${tier.price.toFixed(2)}</b> CPM</>:<>سعر المعلن <b className="font-mono text-[#12234b]">${tier.price.toFixed(2)}</b></>}</div></div><button type="button" data-testid={`button-edit-price-${platform}-${index}`} className={`${soft} min-h-10 min-w-[64px]`} onClick={()=>openTier(platform,index)}>تعديل</button></div>)}</div></div>)}</div></section>
  {editing&&<div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#061333]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event=>{if(event.target===event.currentTarget)setEditing(null)}}><section role="dialog" aria-modal="true" aria-labelledby="pricing-editor-title" className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"><div className="mb-4 flex items-center justify-between"><div><h2 id="pricing-editor-title" className="font-extrabold">تعديل سعر {pricingOptions.find(item=>item[0]===editing.platform)?.[1]}</h2></div><button type="button" aria-label="إغلاق" className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={()=>setEditing(null)}><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2"><Field label={editing.platform==='youtube'?'المدة (ثانية)':editing.platform==='tiktok'?'عدد المتابعين':'عدد المشتركين'} type="number" min="1" step="1" value={tierDraft.value} onChange={event=>setTierDraft({...tierDraft,value:event.target.value})}/><Field label={editing.platform==='youtube'?'سعر CPM ($)':'سعر المعلن ($)'} type="number" min="0" step="0.01" value={tierDraft.price} onChange={event=>setTierDraft({...tierDraft,price:event.target.value})}/></div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" className={`${soft} min-h-11`} onClick={()=>setEditing(null)}>إغلاق</button><button type="button" className={`${primary} min-h-11`} onClick={saveTier}>حفظ</button></div></section></div>}</div>;
}

function NotificationPanel({reports,onSend}:{reports:Row[];onSend:(r:Omit<Row,'id'>)=>void}) {
 const draftKey='vidreward.admin.notification-draft.v1';
 const [draft]=useState(()=>{try{return JSON.parse(localStorage.getItem(draftKey)??'{}')}catch{return {}}});
 const [title,setTitle]=useState(String(draft.title??''));const [body,setBody]=useState(String(draft.body??''));const [buttonTitle,setButtonTitle]=useState(String(draft.buttonTitle??''));const [link,setLink]=useState(String(draft.link??''));const [image,setImage]=useState(String(draft.image??''));const [imageError,setImageError]=useState('');
 useEffect(()=>{try{localStorage.setItem(draftKey,JSON.stringify({title,body,buttonTitle,link,image}))}catch{}},[title,body,buttonTitle,link,image]);
 const uploadImage=(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){setImageError('اختر ملف صورة صالحًا.');event.target.value='';return}if(file.size>2_000_000){setImageError('يجب ألا يتجاوز حجم الصورة 2 ميغابايت.');event.target.value='';return}const reader=new FileReader();reader.onload=()=>{setImage(String(reader.result??''));setImageError('')};reader.onerror=()=>setImageError('تعذر قراءة الصورة. حاول مرة أخرى.');reader.readAsDataURL(file);event.target.value=''};
 const reset=()=>{setTitle('');setBody('');setButtonTitle('');setLink('');setImage('');try{localStorage.removeItem(draftKey)}catch{}};
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-extrabold">إنشاء إشعار</h2><div className="grid gap-4"><Field label="العنوان العريض" value={title} onChange={e=>setTitle(e.target.value)} placeholder="عنوان الإشعار" data-testid="input-notification-title"/><label className="grid gap-1.5 text-xs font-bold text-slate-600">النص<textarea data-testid="textarea-notification-body" value={body} onChange={e=>setBody(e.target.value)} rows={5} className="rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-400"/></label><div className="grid gap-3 sm:grid-cols-2"><Field label="عنوان الزر (اختياري)" value={buttonTitle} onChange={e=>setButtonTitle(e.target.value)}/><Field label="رابط الزر (اختياري)" value={link} onChange={e=>setLink(e.target.value)}/></div><div className="grid gap-2"><label className="text-xs font-bold text-slate-600">صورة الإشعار<input type="file" accept="image/*" data-testid="input-notification-image" onChange={uploadImage} className="mt-2 block w-full rounded-xl border border-slate-200 bg-[#fbfcff] p-2 text-xs file:ml-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-bold file:text-[#1557ee]"/></label>{imageError&&<p role="alert" className="text-xs text-rose-600">{imageError}</p>}{image&&<div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2"><img src={image} alt="معاينة صورة الإشعار" className="h-16 w-24 rounded-lg object-cover"/><span className="flex-1 text-xs text-slate-500">صورة الإشعار</span><button type="button" data-testid="button-remove-notification-image" aria-label="إزالة صورة الإشعار" onClick={()=>setImage('')} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">إزالة</button></div>}</div><button type="button" disabled title="الإرسال غير متاح حاليًا" className={`${btn} w-full cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400`}>إرسال إلى جميع المستخدمين</button><div className="flex flex-wrap gap-2"><button data-testid="button-save-notification" className={primary} disabled={!title.trim()||!body.trim()} onClick={()=>{onSend({title,body,buttonTitle,link,image});reset()}}>حفظ التقرير</button><button type="button" data-testid="button-clear-notification" className={soft} onClick={reset}>مسح المسودة</button></div></div></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-extrabold">سجل الإشعارات</h2><div className="space-y-3">{reports.length?reports.map(r=><div key={r.id} className="rounded-xl bg-[#f7f9fc] p-3">{r.image&&<img src={r.image} alt={`صورة إشعار ${r.title}`} className="mb-3 max-h-40 w-full rounded-lg object-cover"/>}<div className="flex justify-between gap-2"><b className="text-sm">{r.title}</b><Badge>{r.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{r.body}</p>{r.buttonTitle&&<p className="mt-2 text-[11px] font-bold text-[#1557ee]">{r.buttonTitle}{r.link?` · ${r.link}`:''}</p>}<div className="mt-2 text-[10px] text-slate-400">{r.createdAt}</div></div>):<p className="rounded-xl bg-[#f7f9fc] p-5 text-center text-sm text-slate-400">لا توجد تقارير محفوظة</p>}</div></section></div>;
}

function Dialog({dialog,data,userBy,onClose,onConfirm,onConfirmAction,onDelete,onAction}:{dialog:{kind:string;id?:string|number};data:State;userBy:(id:number|undefined)=>User|undefined;onClose:()=>void;onConfirm:(id:any,patch:any)=>void;onConfirmAction:()=>void;onDelete:(id:number)=>void;onAction:(cb:()=>void)=>void}) {
 const [values,setValues]=useState<Record<string,any>>({}); const user=dialog.kind==='user'||dialog.kind==='user-edit'?userBy(Number(dialog.id)):undefined;
  const campaign=data.campaigns.find(x=>x.id===dialog.id);const proof=data.proofs.find(x=>x.id===dialog.id);
 useEffect(()=>{if(user)setValues({...user})},[dialog.id]);
 const field=(key:string,label:string,type='text')=><Field label={label} type={type} value={values[key]??''} onChange={e=>setValues(v=>({...v,[key]:type==='number'?Number(e.target.value):e.target.value}))}/>;
 const save=(patch=values)=>onConfirm(dialog.id,patch);
 let content:React.ReactNode=null;let heading='تفاصيل';
 if(dialog.kind==='user'||dialog.kind==='user-edit'){heading='ملف المستخدم';content=user&&<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><small>معرّف Telegram</small><div className="font-mono font-bold">{user.id}</div></div><div className="rounded-xl bg-slate-50 p-3"><small>الحالة</small><div><Badge>{user.status}</Badge></div></div></div><div className="grid gap-3 sm:grid-cols-2">{field('name','الاسم')}{field('username','اسم المستخدم')}{field('advertiserBalance','رصيد المعلن','number')}{field('earnedBalance','الأرباح','number')}</div><div className="grid grid-cols-2 gap-3 text-xs"><p>تاريخ التسجيل<br/><b>{user.joinedAt}</b></p><p>آخر تسجيل دخول<br/><b>{user.lastLogin}</b></p><p>آخر نشاط<br/><b>{user.lastActive}</b></p><p>دُعي بواسطة<br/><b>{user.invitedBy}</b></p></div><div className="flex flex-wrap gap-2"><button className={primary} onClick={()=>save()}>حفظ التعديلات والأرصدة</button><button className={soft} onClick={()=>onAction(()=>save({status:user.status==='نشط'?'محظور':'نشط'}))}>{user.status==='نشط'?'حظر':'إلغاء الحظر'}</button><button className={`${btn} bg-rose-50 text-rose-700`} onClick={()=>onAction(()=>onDelete(user.id))}><Trash2 size={14}/> حذف</button></div></div>}
 else if(dialog.kind==='campaign'){heading='مراجعة الفيديو';content=campaign&&<div className="space-y-3"><div className="aspect-video overflow-hidden rounded-xl bg-slate-900"><iframe title="معاينة فيديو الحملة" className="h-full w-full" src={campaign.videoUrl} allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"/></div><h3 className="font-bold">{campaign.title}</h3><div className="grid grid-cols-2 gap-2 text-xs text-slate-500"><span>النوع: {campaign.platform}</span><span>المدة: {campaign.duration} ثانية</span><span>الميزانية: {campaign.budget} USDT</span><span>المشاهدات: {campaign.views}</span></div><div className="flex flex-wrap gap-2">{['نشطة','مرفوضة','موقوفة'].map(status=><button key={status} className={status==='مرفوضة'?`${btn} bg-rose-50 text-rose-700`:soft} onClick={()=>status==='مرفوضة'?onAction(()=>save({status})):save({status})}>{status==='نشطة'?'اعتماد':status==='مرفوضة'?'رفض':'إيقاف مؤقت'}</button>)}</div></div>}
 else if(dialog.kind==='proof'){heading='صورة إثبات المهمة';content=proof&&<div><img src={proof.image} alt="صورة الإثبات" className="max-h-[60vh] w-full rounded-xl object-contain"/><p className="mt-3 text-xs text-slate-500">{userBy(proof.userId)?.name} · {proof.taskId}</p></div>}
 else if(dialog.kind==='reject-proof'){heading='رفض الإثبات';content=<div className="space-y-3"><label className="grid gap-1.5 text-xs font-bold">سبب الرفض<textarea value={values.reason??''} onChange={e=>setValues({...values,reason:e.target.value})} rows={3} className="rounded-xl border border-slate-200 p-3"/></label><button className={`${btn} bg-rose-600 text-white`} onClick={()=>onAction(()=>save({status:'مرفوض',rejectionReason:values.reason||'لم يطابق الإثبات المتطلبات'}))}>رفض الإثبات</button></div>}
  else {heading='تأكيد الإجراء';content=<div className="space-y-4"><p className="text-sm">{dialog.id}</p><div className="flex gap-2"><button className={`${btn} bg-rose-600 text-white`} onClick={onConfirmAction}>تأكيد</button><button className={soft} onClick={onClose}>إلغاء</button></div></div>}
 const userFullPage=dialog.kind==='user'||dialog.kind==='user-edit';
 return <div className={`fixed inset-0 z-[100] flex justify-center bg-[#061333]/45 backdrop-blur-sm ${userFullPage?'items-stretch p-0 sm:items-center sm:p-4':'items-end p-0 sm:items-center sm:p-4'}`} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" className={`${userFullPage?'h-[100dvh] w-full max-w-none rounded-none sm:h-auto sm:max-h-[92dvh] sm:max-w-xl sm:rounded-3xl':'max-h-[92dvh] w-full max-w-xl rounded-t-3xl sm:rounded-3xl'} overflow-y-auto bg-white p-5 shadow-2xl`}><header className="mb-4 flex items-center justify-between"><h2 className="font-extrabold">{heading}</h2><button aria-label="إغلاق" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></header>{content}</section></div>;
}