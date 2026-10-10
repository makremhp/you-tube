import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement } from 'react';
import { Activity, CircleDollarSign, Copy, Eye, Megaphone, Search, ShieldCheck, Trash2, Users, Wallet, X, Plus, Code2, RefreshCw, Pencil, Check, Monitor, Layers, ImagePlus } from 'lucide-react';
import { saveLocalPricing, useLocalPricing, type LocalPricing, type PricingPlatform } from '@/legacy/pricing';
import { ApiError, apiGet, apiPatch, apiPost } from '@/lib/api';
import { buildAdsteraDocument, deleteAdsteraAd, useAdsteraAds, type AdProvider, type AdsteraAd, type AdsteraFormat } from '@/lib/adsteraAds';

type User = { id: number; name: string; username: string; avatar: string; photoUrl?: string; advertiserBalance: number; earnedBalance: number; status: 'نشط' | 'محظور'; bannedBySystem?: boolean; joinedAt: string; lastLogin: string; lastActive: string; invitedBy: string };
type Row = { id: string; userId?: number; amount?: number; createdAt?: string; status?: string; [key: string]: any };
type State = { users: User[]; deposits: Row[]; withdrawals: Row[]; campaigns: Row[]; proofs: Row[]; ads: Row[]; suspicious: Row[]; adminAudit: Row[]; settings: Record<string, any>; reports: Row[] };
type NotifyResult = { targeted: number; sent: number; failed: number; skipped?: number; withImage?: boolean; errors?: Array<{ reason: string; count: number }> };
const SETTINGS_KEY = 'vidreward.admin.settings.v1';
const defaultSettings: Record<string, any> = { binanceWithdrawMin: 1, web3WithdrawMin: 1, starsDepositMin: 1, web3DepositMin: 5, userShare: 20, platformShare: 10, durationMin: 10, durationMax: 80, cpmMin: 1.5, cpmMax: 4, telegramCpm: 2.2, tiktokCpm: 2.8, taskReward: 0.02, telegramTaskReward: 0.003, tiktokTaskReward: 0.01, web3Address: '', maintenance: false };
const emptyState: State = { users: [], deposits: [], withdrawals: [], campaigns: [], proofs: [], ads: [], suspicious: [], adminAudit: [], settings: defaultSettings, reports: [] };
const labels: Record<string, string> = { overview:'نظرة عامة', users:'مستخدمو Telegram', banned:'المستخدمون المحظورون', deposits:'الإيداعات', 'deposit-detail':'تفاصيل المعاملة', withdrawals:'السحوبات', campaigns:'الحملات', proofs:'إثباتات المهام', ads:'مخزون Adstera', settings:'الإعدادات', maintenance:'الصيانة', notifications:'الإشعارات', suspicious:'مستخدمون مشبوهون', audit:'سجل إجراءات الإدارة' };
const cx = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(' ');
const cell = 'px-4 py-1.5 text-right align-middle';
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition hover:-translate-y-px disabled:opacity-40';
const primary = `${btn} bg-[#1557ee] text-white`;
const soft = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
function getState(): State {
 try {
  const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<State>;
  return { ...emptyState, settings: { ...defaultSettings, ...stored.settings }, reports: Array.isArray(stored.reports) ? stored.reports : [] };
 } catch {
  return emptyState;
 }
}
function platformEarnings(data: State) {
 const youtubeDeposits = data.campaigns
  .filter(campaign => String(campaign.platform ?? '').toLowerCase() === 'youtube' && campaign.status !== 'مرفوضة' && campaign.status !== 'مرفوض')
  .reduce((sum, campaign) => sum + Math.max(0, Number(campaign.spent ?? campaign.budget ?? campaign.price ?? 0) || 0), 0);

 const taskCampaigns = new Map<string, Row>();
 data.campaigns.forEach(campaign => {
  const platform = String(campaign.platform ?? '').toLowerCase();
  if ((platform === 'tiktok' || platform === 'telegram') && campaign.id !== undefined) {
   taskCampaigns.set(String(campaign.id), campaign);
  }
 });
 const proofs = data.proofs;
 const taskNet = { tiktok: 0, telegram: 0 };

 taskCampaigns.forEach(campaign => {
  const platform = String(campaign.platform).toLowerCase() as 'tiktok' | 'telegram';
  const budget = Math.max(0, Number(campaign.price ?? campaign.budget ?? 0) || 0);
  const target = Math.max(0, Number(campaign.targetCount ?? 0) || 0);
  if (budget <= 0 || target <= 0) return;

  const linkedProofs = proofs.filter(proof => String(proof.campaignId ?? '') === String(campaign.id));
  const recordedCompletions = Math.max(
   0,
   Number(campaign.completedCount ?? 0) || 0,
   Array.isArray(campaign.completedUserIds) ? campaign.completedUserIds.length : 0,
  );
  const approvedProofs = linkedProofs.filter(proof => proof.status === 'معتمد' || proof.status === 'approved').length;
  const completions = Math.min(target, linkedProofs.length > 0 ? approvedProofs : recordedCompletions);
  const userReward = platform === 'tiktok' ? 0.01 : 0.003;
  const marginPerTask = budget / target - userReward;
  taskNet[platform] += marginPerTask * completions;
 });

 return {
  youtube: youtubeDeposits * 0.7,
  tiktok: taskNet.tiktok,
  telegram: taskNet.telegram,
  total: youtubeDeposits * 0.7 + taskNet.tiktok + taskNet.telegram,
 };
}
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
 const [pendingAction, setPendingAction] = useState<(()=>Promise<boolean|void>|boolean|void)|null>(null);
 const [pendingSuccessMessage, setPendingSuccessMessage] = useState('تم تطبيق الإجراء');
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
 useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings: data.settings, reports: data.reports })); } catch {} }, [data.settings, data.reports]);
 const navigateToPage = (nextPage: string) => {
  setPage(nextPage);
  setQuery('');
  setFilter('الكل');
  setPageNo(1);
  onPageChange(nextPage);
 };
 const loadRemote = async (silent = false) => {
  try {
    const remote = await apiGet<Pick<State, 'users' | 'deposits' | 'withdrawals' | 'campaigns' | 'proofs' | 'suspicious' | 'adminAudit'> & { maintenance?: boolean; withdrawalSettings?: Pick<State['settings'], 'binanceWithdrawMin' | 'web3WithdrawMin'> }>('admin/state');
   setData(d => ({
    ...d,
     users: (remote.users ?? []).map(user => ({ ...user, avatar: String(user.name ?? '').trim().slice(0, 2) || '—' })),
     settings: { ...d.settings, ...remote.withdrawalSettings, maintenance: Boolean(remote.maintenance) },
    deposits: remote.deposits ?? [],
    withdrawals: remote.withdrawals ?? [],
    campaigns: remote.campaigns ?? [],
    proofs: remote.proofs ?? [],
    suspicious: remote.suspicious ?? [],
    adminAudit: remote.adminAudit ?? [],
   }));
  } catch {
   if (!silent) announce('تعذر تحديث البيانات من الخادم');
  }
 };
 useEffect(() => {
  void loadRemote();
  const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadRemote(true); }, 20_000);
  return () => window.clearInterval(timer);
 }, []);
 // يحفظ التعديل على الخادم أولًا؛ لا يُعتبر ناجحًا إلا بعد ردّ الخادم، ثم تُحدَّث الواجهة من القيم المحفوظة فعلًا.
 const updateRows = async (key: keyof State, id: string|number, patch: Record<string, any>): Promise<boolean> => {
  const remoteKey = key === 'users' || key === 'deposits' || key === 'withdrawals' || key === 'proofs' || key === 'campaigns' || key === 'suspicious';
  if (!remoteKey) {
   setData(d => ({...d, [key]: (d[key] as any[]).map(x => x.id===id ? {...x,...patch}:x)}));
   return true;
  }
  setData(d => ({...d, [key]: (d[key] as any[]).map(x => x.id===id ? {...x,...patch}:x)}));
  try {
   const saved = await apiPatch<Record<string, any> | null>(`admin/${key}/${id}`, patch);
   if (key === 'users' && saved && typeof saved === 'object' && typeof saved.id === 'number') {
    setData(d => ({...d, users: d.users.map(u => u.id === saved.id ? { ...u, ...(saved as Partial<User>), avatar: String(saved.name ?? u.name ?? '').trim().slice(0, 2) || '—' } : u)}));
   }
   void loadRemote(true);
   return true;
  } catch (error) {
   announce(error instanceof ApiError && error.message && error.message !== 'Request failed' ? `تعذر حفظ الإجراء: ${error.message}` : 'تعذر حفظ الإجراء على الخادم');
   await loadRemote(true);
   return false;
  }
 };
 const saveUserPatch = async (id: number, patch: Record<string, any>): Promise<boolean> => {
  const payload: Record<string, any> = {};
  if (patch.status !== undefined) payload.status = patch.status;
  for (const key of ['advertiserBalance', 'earnedBalance'] as const) {
   if (patch[key] === undefined) continue;
   const raw = String(patch[key]).trim();
   const value = raw === '' ? NaN : Number(raw);
   if (!Number.isFinite(value) || value < 0) { announce('أدخل رصيدًا صحيحًا (رقم صفر أو أكبر)'); return false; }
   payload[key] = value;
  }
  if (patch.name !== undefined) {
   const name = String(patch.name).trim();
   if (!name) { announce('الاسم لا يمكن أن يكون فارغًا'); return false; }
   payload.name = name;
  }
  if (patch.username !== undefined) payload.username = String(patch.username).trim().replace(/^@/, '');
  if (!Object.keys(payload).length) { announce('لا توجد تغييرات للحفظ'); return false; }
  return updateRows('users', id, payload);
 };
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
 const confirm = (message:string, onConfirm:()=>Promise<boolean|void>|boolean|void, successMessage='تم تطبيق الإجراء') => { setPendingAction(()=>onConfirm); setPendingSuccessMessage(successMessage); setDialog({kind:'confirm', id:message}); };
 const action = (text:string, cb:()=>void, danger=false) => <button onClick={cb} className={`${btn} ${danger?'bg-rose-50 text-rose-700':'bg-slate-100 text-slate-700'}`}>{text}</button>;

 const content = () => {
   if(page==='overview') {
    const net = platformEarnings(data);
    return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-x-4 rounded-2xl bg-white px-4 sm:grid-cols-3">{[
    ['مستخدمون مسجلون',data.users.length,Users],
    ['حملات نشطة',data.campaigns.filter(x=>x.status==='نشطة').length,Megaphone],
    ['حملات أوقفتها الميزانية',data.campaigns.filter(x=>x.status==='أوقفتها الميزانية').length,Activity],
    ['إيداعات ناجحة · USDT',data.deposits.filter(x=>x.status==='ناجح').reduce((sum,x)=>sum+(x.method==='Stars'?Number(x.amount??0)*0.01:Number(x.amount??0)),0).toFixed(2),CircleDollarSign],
    ['إجمالي أرباح المستخدمين',data.users.reduce((sum,u)=>sum+u.earnedBalance,0).toFixed(3),Wallet],
    ['صافي أرباح المنصة',`$${net.total.toFixed(3)}`,CircleDollarSign],
    ['مستخدمون حظرهم النظام',data.users.filter(x=>x.bannedBySystem).length,ShieldCheck]
     ].map(([l,v,I]:any)=><div key={l} className="flex min-h-[74px] items-center justify-between gap-2 border-b border-slate-100 py-2.5"><div className="min-w-0"><div className="text-[10px] font-bold leading-4 text-slate-500">{l}</div><div className="mt-0.5 flex flex-wrap items-baseline gap-x-2"><span className="text-xl font-extrabold text-[#12234b]">{v}</span></div></div><I className="h-4 w-4 shrink-0 text-[#1557ee]"/></div>)}</div>
    {panel(<div className="grid gap-3 sm:grid-cols-3" data-testid="platform-net-breakdown">
      {[['YouTube',net.youtube,'70% من ميزانية حملات الفيديو'],['TikTok',net.tiktok,'بعد مكافأة 0.01$ لكل مهمة مكتملة'],['Telegram',net.telegram,'بعد مكافأة 0.003$ لكل مهمة مكتملة']].map(([platform,amount,description])=><div key={String(platform)} className="rounded-xl bg-[#f7f9fc] p-3"><div className="text-xs font-extrabold">{platform}</div><div className="mt-1 font-mono text-lg font-bold text-[#1557ee]">${Number(amount).toFixed(3)}</div><p className="mt-1 text-[10px] leading-4 text-slate-500">{description}</p></div>)}
    </div>)}
    {panel(<><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf3ff] text-[#1557ee]"><ShieldCheck size={20}/></span><div><h2 className="font-extrabold">مركز العمليات</h2><p className="mt-1 text-sm leading-6 text-slate-500">تابع الطلبات والإثباتات وإشارات المخاطر من مساحة واحدة.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{[['طلبات السحب',data.withdrawals.filter(x=>x.status==='قيد المراجعة').length,'withdrawals'],['إثباتات المهام',data.proofs.filter(x=>x.status==='قيد المراجعة').length,'proofs'],['إشارات المخاطر',data.suspicious.filter(x=>x.status==='مفتوح').length,'suspicious'],['تقارير الإرسال',data.reports.length,'notifications']].map(([a,b,c])=><button key={c} onClick={()=>navigateToPage(String(c))} className="flex items-center justify-between rounded-xl bg-[#f7f9fc] p-4 text-right"><span className="text-sm font-bold">{a}</span><span className="font-mono text-lg font-bold text-[#1557ee]">{b}</span></button>)}</div></>)}
  </div>;
   }
  if(page==='users') return <div className="space-y-4">{panel(<div className="flex flex-wrap gap-3">{search}<span className="self-center text-xs text-slate-400">حد أقصى 100 مستخدم في الصفحة</span></div>)}{table(['المستخدم','Telegram ID','رصيد المعلن','الأرباح','الحالة','آخر نشاط',''],visibleUsers.map(u=><tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/70"><td className={cell}><div className="flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#edf3ff] text-xs font-extrabold text-[#1557ee] ring-1 ring-slate-200">{u.photoUrl ? <img src={u.photoUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover"/> : u.avatar}</span><div><b>{u.name}</b><div className="text-xs text-slate-400">@{u.username}</div></div></div></td><td className={`${cell} font-mono`}>{u.id}</td><td className={`${cell} font-mono`}>{u.advertiserBalance.toFixed(2)} $</td><td className={`${cell} font-mono`}>{u.earnedBalance.toFixed(3)} $</td><td className={cell}><Badge>{u.status}</Badge></td><td className={cell}>{u.lastActive}</td><td className={cell}><button className={soft} onClick={()=>setDialog({kind:'user',id:u.id})}>التفاصيل</button></td></tr>))}{panel(<div className="flex items-center justify-between text-xs text-slate-500"><span>{filteredUsers.length} مستخدم</span><div className="flex gap-2"><button className={soft} disabled={pageNo<=1} onClick={()=>setPageNo(n=>n-1)}>السابق</button><span className="px-2 py-2">صفحة {pageNo} / {Math.max(1,Math.ceil(filteredUsers.length/pageSize))}</span><button className={soft} disabled={pageNo>=Math.ceil(filteredUsers.length/pageSize)} onClick={()=>setPageNo(n=>n+1)}>التالي</button></div></div>)}</div>;
   if(page==='banned') {
    const blockedUsers = data.users.filter(user => user.status === 'محظور' && (!query || [user.id,user.name,user.username].some(value=>String(value).toLowerCase().includes(query.toLowerCase()))));
    return <div className="space-y-4">{panel(<div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-rose-600"/><p className="text-sm text-slate-600">إدارة الحسابات المحظورة. إلغاء الحظر يعيد للمستخدم إمكانية الدخول؛ تعديل الأرصدة متاح من ملفه.</p></div>)}{panel(<div className="flex gap-3">{search}<span className="self-center whitespace-nowrap text-xs text-slate-400">{blockedUsers.length} محظور</span></div>)}{table(['المستخدم','Telegram ID','الأرصدة','الحالة','آخر نشاط','الإجراء'],blockedUsers.map(user=><tr key={user.id} className="border-b border-slate-50"><td className={cell}><div className="flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-rose-50 text-xs font-bold text-rose-700">{user.photoUrl?<img src={user.photoUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover"/>:user.avatar}</span><span><b>{user.name}</b><small className="block text-slate-400">@{user.username}</small></span></div></td><td className={`${cell} font-mono`}>{user.id}</td><td className={`${cell} font-mono`}>{user.advertiserBalance.toFixed(2)} / {user.earnedBalance.toFixed(3)} $</td><td className={cell}><Badge>محظور</Badge></td><td className={cell}>{user.lastActive}</td><td className={cell}><button className={soft} onClick={()=>confirm('إلغاء حظر هذا المستخدم؟',()=>updateRows('users',user.id,{status:'نشط'}),'تم إلغاء الحظر')}>إلغاء الحظر</button></td></tr>))}</div>;
   }
   if(page==='deposits') return <div className="space-y-4">{panel(<div className="flex flex-wrap gap-3">{search}{statusSelect(['ناجح','فاشل'])}</div>)}{table(['العملية / المعاملة','المستخدم','الطريقة','المبلغ','Memo / Tag','المحفظة','الحالة / الوقت'],rowData('deposits').map(r=><tr key={r.id} tabIndex={0} role="button" onClick={()=>{setSelectedDepositId(r.id);setPage('deposit-detail')}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedDepositId(r.id);setPage('deposit-detail')}}} className="cursor-pointer border-b border-slate-50 hover:bg-blue-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1557ee]"><td className={cell}><b>{r.id}</b><div className="text-[11px] text-slate-400">{r.txId}</div></td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.method}</td><td className={`${cell} font-mono`}>{r.amount} {r.method==='Stars'?'XTR':'USDT'}</td><td className={`${cell} font-mono`}>{r.memoTag}</td><td className={`${cell} font-mono`}>{r.wallet||'—'}</td><td className={cell}><Badge>{r.status}</Badge><div className="mt-1 text-[10px] text-slate-400">{r.createdAt}</div>{r.reason&&<div className="mt-1 max-w-40 text-[10px] text-rose-600">{r.reason}</div>}</td></tr>))}</div>;
   if(page==='deposit-detail') {
    const deposit=data.deposits.find(row=>row.id===selectedDepositId);
    const user=userBy(deposit?.userId);
    if(!deposit) return <div className="space-y-4">{panel(<><p className="font-bold">تعذر العثور على المعاملة.</p><button className={`${soft} mt-3`} onClick={()=>navigateToPage('deposits')}>العودة إلى الإيداعات</button></>)}</div>;
    const balanceBefore=Number(deposit.balanceBefore ?? (deposit.credited ? (user?.advertiserBalance ?? 0)-Number(deposit.amount??0) : user?.advertiserBalance ?? 0));
    const markFailed=()=>{void updateRows('deposits',deposit.id,{status:'فاشل',reason:deposit.reason||'تم وضع علامة فاشل يدويًا'}).then(saved=>{if(saved)announce('تم وضع علامة فاشل وعكس الرصيد المضاف')});};
    return <div className="space-y-4">{panel(<div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-slate-400">معاملة إيداع</p><h2 className="mt-1 font-mono text-xl font-extrabold">{deposit.id}</h2></div><button className={soft} onClick={()=>navigateToPage('deposits')}>العودة إلى الإيداعات</button></div>)}{panel(<div className="grid gap-4 sm:grid-cols-2"><div><div className="text-xs text-slate-400">المستخدم</div><div className="mt-1 font-bold">{user?.name ?? 'مستخدم غير معروف'} · {deposit.userId}</div></div><div><div className="text-xs text-slate-400">الطريقة والمبلغ</div><div className="mt-1 font-bold">{deposit.method} · {deposit.amount} {deposit.method==='Stars'?'XTR':'USDT'}</div></div><div><div className="text-xs text-slate-400">Memo / Tag</div><div className="mt-1 font-mono text-sm">{deposit.memoTag||'—'}</div></div><div><div className="text-xs text-slate-400">معرّف التحويل</div><div className="mt-1 font-mono text-sm">{deposit.txId||'—'}</div></div><div><div className="text-xs text-slate-400">المحفظة</div><div className="mt-1 font-mono text-sm" dir="ltr">{deposit.wallet||'—'}</div></div><div><div className="text-xs text-slate-400">التاريخ</div><div className="mt-1 text-sm">{deposit.createdAt||'—'}</div></div><div><div className="text-xs text-slate-400">الرصيد قبل الإيداع</div><div className="mt-1 font-mono text-lg font-bold">{balanceBefore.toFixed(2)} USDT</div></div><div><div className="text-xs text-slate-400">الرصيد الحالي</div><div className="mt-1 font-mono text-lg font-bold">{Number(user?.advertiserBalance??0).toFixed(2)} USDT</div></div><div><div className="text-xs text-slate-400">الحالة</div><div className="mt-1"><Badge>{deposit.status}</Badge></div></div>{deposit.reason&&<div className="sm:col-span-2 text-sm text-rose-600">{deposit.reason}</div>}</div>)}{panel(<div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs leading-5 text-slate-500">عكس الرصيد يحدث فقط إذا كان هذا الإيداع قد أضافه فعلًا.</div><div className="flex gap-2"><button className={soft} onClick={()=>{navigateToPage('users');setDialog({kind:'user',id:deposit.userId})}} disabled={!user}>فتح تفاصيل المستخدم</button>{deposit.status!=='فاشل'&&<button className={`${btn} bg-rose-50 text-rose-700`} onClick={markFailed}>وضع علامة فاشل</button>}</div></div>)}</div>;
   }
   if(page==='withdrawals') return <div className="space-y-4">{panel(<div className="flex gap-3">{search}{statusSelect(['قيد المراجعة','معتمد','مرفوض'])}</div>)}{table(['الطلب','المستخدم','القناة','المبلغ','الوجهة','التاريخ','الإجراء'],rowData('withdrawals').map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}><b>{r.id}</b></td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.method}</td><td className={cell}><button className="inline-flex items-center gap-1 font-mono" aria-label="نسخ المبلغ" onClick={()=>{navigator.clipboard?.writeText(`${r.amount} USDT`);announce('تم نسخ المبلغ')}}>{r.amount} USDT<Copy size={13}/></button></td><td className={cell}><div className="flex items-center gap-1 font-mono"><span dir="ltr">{r.destination}</span><button aria-label="نسخ الوجهة" onClick={()=>{navigator.clipboard?.writeText(r.destination);announce('تم النسخ')}}><Copy size={14}/></button></div></td><td className={cell}>{r.createdAt}</td><td className={cell}>{r.status==='قيد المراجعة'?<div className="flex gap-1">{action('اعتماد',()=>{void updateRows('withdrawals',r.id,{status:'معتمد'}).then(saved=>{if(saved)announce('تم اعتماد الطلب')})})}{action('رفض',()=>confirm('رفض طلب السحب؟',()=>updateRows('withdrawals',r.id,{status:'مرفوض'}),'تم رفض الطلب'),true)}</div>:<Badge>{r.status}</Badge>}</td></tr>))}</div>;
  if(page==='campaigns') return <div className="space-y-4">{panel(<div className="flex gap-3">{search}{statusSelect(['بانتظار المراجعة','نشطة','موقوفة','مرفوضة','أوقفتها الميزانية'])}</div>)}{table(['الحملة','المستخدم','المنصة','المدة','الميزانية','المشاهدات','الحالة','مراجعة'],rowData('campaigns').map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}><b>{r.title}</b><div className="text-xs text-slate-400">{r.id}</div></td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.platform}</td><td className={cell}>{r.duration} ث</td><td className={cell}>{r.budget} USDT</td><td className={cell}>{r.views.toLocaleString()}</td><td className={cell}><Badge>{r.status}</Badge></td><td className={cell}><button className={soft} onClick={()=>setDialog({kind:'campaign',id:r.id})}>فيديو وإجراءات</button></td></tr>))}</div>;
   if(page==='proofs') return <div className="space-y-4">{panel(<div className="flex gap-3">{search}{statusSelect(['قيد المراجعة','معتمد','مرفوض'])}</div>)}{table(['الإثبات','المستخدم','المهمة','المكافأة','الحالة','المرفق','الإجراء'],rowData('proofs').map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}>{r.id}</td><td className={cell}>{userBy(r.userId)?.name}</td><td className={cell}>{r.taskId}<div className="text-xs text-slate-400">{r.taskType}</div></td><td className={cell}>{r.reward} USDT</td><td className={cell}><Badge>{r.status}</Badge></td><td className={cell}><button className={soft} onClick={()=>setDialog({kind:'proof',id:r.id})}>عرض الصورة</button></td><td className={cell}>{r.status==='قيد المراجعة'?<div className="flex gap-1">{action('اعتماد المكافأة',()=>{void updateRows('proofs',r.id,{status:'معتمد'}).then(saved=>{if(saved)announce('تم اعتماد الإثبات وإضافة المكافأة')})})}{action('رفض',()=>setDialog({kind:'reject-proof',id:r.id}),true)}</div>:r.rejectionReason||<Badge>{r.status}</Badge>}</td></tr>))}</div>;
   if(page==='ads') {
      const filteredAds=adstera.ads.filter(ad=>
        (adStatus==='all'||(adStatus==='enabled'?ad.enabled:!ad.enabled))
        &&(!adQuery||`${ad.name} ${ad.id} ${ad.format}`.toLowerCase().includes(adQuery.trim().toLowerCase()))
      );
      const beginAdd=()=>{
         setAdDraft({id:`adstera-custom-${Date.now()}`,name:'',provider:'adstera',format:'social',code:'',enabled:false,updatedAt:new Date().toISOString().slice(0,10),builtIn:false});
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
      const removeAd=(ad:AdsteraAd)=>{
        confirm(`حذف "${ad.name}" نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`,()=>{
          deleteAdsteraAd(ad.id);
          setAdDraft(current=>current?.id===ad.id?null:current);
          setAdPreview(current=>current?.id===ad.id?null:current);
          window.scrollTo(0,0);
        },'تم حذف الكود نهائيًا');
      };
      const editorField='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-[#12234b] outline-none transition focus:border-[#1557ee] focus:ring-2 focus:ring-blue-100';
      const draftChange=(patch:Partial<AdsteraAd>)=>{
        setAdDraft(current=>current?{...current,...patch}:current);
        if(adPreview&&adDraft?.id===adPreview.id)setAdPreview(current=>current?{...current,...patch}:current);
      };
       const previewFrame=(ad:AdsteraAd)=>ad.code.trim()
         ? <iframe key={`${ad.id}-${adPreviewKey}`} title={`معاينة ${ad.name||'الكود الجديد'}`} referrerPolicy="no-referrer-when-downgrade" srcDoc={buildAdsteraDocument(ad)} className={`mx-auto block max-w-full rounded-lg border border-slate-200 bg-white ${ad.format==='320x50'?'h-[50px] w-[320px]':'h-[100px] w-[320px]'}`} data-testid="iframe-ad-code-preview"/>
        : <div data-testid="empty-ad-preview" className="grid min-h-[100px] place-items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 text-center text-[11px] leading-5 text-slate-400">أدخل الشيفرة لمعاينتها هنا.</div>;
      const previewAd=adPreview??adDraft;
      const savedEditorAd=adDraft?adstera.ads.find(ad=>ad.id===adDraft.id):undefined;
      if(adDraft) return <div dir="rtl" data-testid="page-ad-code-editor" className="space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6ebf3] bg-white p-4 sm:p-5">
            <div><div className="text-[10px] font-extrabold tracking-[.12em] text-[#1557ee]">{adDraft.provider.toUpperCase()} / AD CODE</div><h2 className="mt-1 text-lg font-extrabold">{adDraft.builtIn?'تعديل الكود':'إضافة كود جديد'}</h2><p className="mt-1 text-xs text-slate-500">اختر الشبكة، ثم أضف شيفرة الإعلان التي زودك بها حسابك وراجع المعاينة قبل الحفظ.</p></div>
            <div className="flex flex-wrap gap-2">
              {savedEditorAd&&<button type="button" data-testid={`button-delete-ad-editor-${savedEditorAd.id}`} className={`${btn} min-h-10 bg-rose-50 text-rose-700 hover:bg-rose-100`} onClick={()=>removeAd(savedEditorAd)}><Trash2 size={14}/>حذف نهائي</button>}
              <button type="button" data-testid="button-close-ad-editor" className={soft} onClick={()=>{setAdDraft(null);setAdPreview(null);window.scrollTo(0,0);}}>العودة إلى الأكواد</button>
            </div>
        </section>
        <form data-testid="form-ad-code-editor" onSubmit={event=>{event.preventDefault();saveDraft();}} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
          <section className="space-y-4 rounded-2xl border border-[#dce5f3] bg-white p-4 shadow-[0_12px_30px_rgba(18,35,75,.06)] sm:p-5">
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">اسم الكود
              <input required data-testid="input-ad-code-name" aria-label="اسم الكود" value={adDraft.name} onChange={event=>draftChange({name:event.target.value})} placeholder="مثال: موضع Social للحملات" className={editorField}/>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">شبكة الإعلانات
              <select required aria-label="شبكة الإعلانات" value={adDraft.provider} onChange={event=>draftChange({provider:event.target.value as AdProvider})} className={`${editorField} font-bold`}>
                <option value="adstera">Adsterra</option><option value="monetag">Monetag</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">نوع الإعلان
              <select required data-testid="select-ad-code-format" aria-label="نوع الإعلان" value={adDraft.format} onChange={event=>draftChange({format:event.target.value as AdsteraFormat})} className={`${editorField} font-bold`}>
                <option value="social">Social</option><option value="320x50">Banner · 320 × 50</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-600">الشيفرة الإعلانية
              <textarea required data-testid="textarea-ad-code" aria-label="الشيفرة الإعلانية" value={adDraft.code} onChange={event=>draftChange({code:event.target.value})} rows={12} spellCheck={false} dir="ltr" placeholder={`ألصق الشيفرة كاملة كما استلمتها من ${adDraft.provider==='monetag'?'Monetag':'Adsterra'}…`} className="w-full resize-y rounded-xl border border-[#243655] bg-[#111c32] p-3.5 font-mono text-xs leading-6 text-emerald-100 outline-none placeholder:text-slate-500 focus:border-[#7198ff] focus:ring-2 focus:ring-blue-100"/>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" data-testid="button-save-ad-code" className={primary}><Check size={15}/>حفظ الكود</button>
              <button type="button" data-testid="button-refresh-ad-preview" className={soft} onClick={()=>refreshPreview(adDraft)}><RefreshCw size={14}/>تحديث المعاينة</button>
            </div>
          </section>
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-[#f4f7fb] p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-2"><div><div className="flex items-center gap-2 text-sm font-extrabold text-[#17284d]"><Eye size={16} className="text-[#1557ee]"/>معاينة مباشرة</div><p className="mt-1 text-xs leading-5 text-slate-500">تتحدّث المعاينة مع تعديل الشيفرة؛ زر التحديث يعيد تحميلها يدويًا.</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">معزولة</span></div>
            <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-slate-200 bg-white p-3">{previewAd?previewFrame(previewAd):null}</div>
              <p className="mt-3 text-[10px] leading-5 text-slate-500">تعمل المعاينة بالطريقة المستخدمة في مهمة التصفح. أضف فقط شيفرات موثوقة من شبكة الإعلانات التي اخترتها.</p>
          </section>
        </form>
      </div>;
      if(adPreview) return <div dir="rtl" data-testid="page-ad-code-preview" className="space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6ebf3] bg-white p-4 sm:p-5">
          <div><div className="text-[10px] font-extrabold tracking-[.12em] text-[#1557ee]">ADSTERRA PREVIEW</div><h2 className="mt-1 text-lg font-extrabold">معاينة {adPreview.name}</h2><p className="mt-1 text-xs text-slate-500">هذه معاينة فعلية للشيفرة داخل إطار منفصل.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="button-back-ad-preview" className={soft} onClick={()=>{setAdPreview(null);window.scrollTo(0,0);}}>العودة إلى الأكواد</button>
            <button type="button" data-testid="button-refresh-ad-preview" className={soft} onClick={()=>refreshPreview(adPreview)}><RefreshCw size={14}/>تحديث المعاينة</button>
            <button type="button" data-testid="button-edit-previewed-ad" className={primary} onClick={()=>startEdit(adPreview)}><Pencil size={14}/>تعديل</button>
          </div>
        </section>
        <section className="rounded-2xl border border-[#dce5f3] bg-white p-4 shadow-[0_8px_24px_rgba(18,35,75,.045)] sm:p-6">
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-slate-200 bg-[#f4f7fb] p-4">{previewFrame(adPreview)}</div>
          <p className="mt-4 text-xs leading-5 text-slate-500">إذا بقيت المساحة فارغة، تحقق من صلاحية الشيفرة واستجابة Adsterra. استخدم فقط شيفرات Adsterra التي تثق بها.</p>
        </section>
      </div>;
      return <div dir="rtl" data-testid="page-adstera-management" className="space-y-4">
        <section className="relative overflow-hidden rounded-[1.35rem] bg-[#132449] p-5 text-white shadow-[0_16px_36px_rgba(18,35,75,.12)] sm:p-6">
          <div className="pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full border border-white/10"/><div className="pointer-events-none absolute -left-4 -top-8 h-36 w-36 rounded-full border border-white/10"/>
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold tracking-[.14em] text-[#f6c453]"><Code2 size={14}/> ADSTERRA + MONETAG / INVENTORY</div><h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">إدارة أكواد الإعلانات</h2><p className="mt-2 max-w-xl text-xs leading-6 text-blue-100/75 sm:text-sm">أضف أكواد Adsterra أو Monetag التي يوفرها حسابك، وعاين موضعها قبل تفعيل بطاقة الشبكة في صفحة الإعلانات.</p></div>
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
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500"><span data-testid="text-ad-code-count">عرض {filteredAds.length} من {adstera.ads.length} كود</span><span className="hidden items-center gap-1.5 sm:flex"><ShieldCheck size={13} className="text-emerald-600"/> أكواد الإعلانات تعمل في صفحة المهمة</span></div>
        </section>
        {filteredAds.length===0
          ? <section data-testid="empty-ad-codes" className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#edf3ff] text-[#1557ee]"><Search size={19}/></span><h3 className="mt-3 font-extrabold text-[#12234b]">{adstera.ads.length?'لا توجد نتائج مطابقة':'لا توجد أكواد محفوظة'}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{adstera.ads.length?'جرّب تغيير عبارة البحث أو مرشح الحالة.':'أضف كودًا جديدًا لبدء إدارة مواضع Adstera.'}</p>{!adstera.ads.length&&<button type="button" className={`${primary} mt-4`} onClick={beginAdd}>إضافة أول كود</button>}</section>
           : table(['الكود','الشبكة','التنسيق','الحالة','آخر تحديث','الإجراءات'],filteredAds.map(ad=><tr data-testid={`row-ad-code-${ad.id}`} key={ad.id} className="border-b border-slate-50 transition hover:bg-[#f8faff]">
              <td className={cell}><div className="flex min-w-0 items-center gap-2.5"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ad.format==='social'?'bg-[#edf3ff] text-[#1557ee]':'bg-[#fff5dd] text-[#9a6b09]'}`}>{ad.format==='social'?<Layers size={16}/>:<Monitor size={16}/>}</span><div className="min-w-0"><div className="truncate font-extrabold text-[#17284d]">{ad.name||'كود بلا اسم'}</div><div className="truncate font-mono text-[10px] text-slate-400" dir="ltr">{ad.id}{ad.builtIn?' · مدمج':''}</div></div></div></td>
               <td className={cell}><Badge>{ad.provider==='monetag'?'Monetag':'Adsterra'}</Badge></td>
              <td className={cell}><span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-extrabold ${ad.format==='social'?'bg-blue-50 text-blue-700':'bg-amber-50 text-amber-800'}`} dir="ltr">{ad.format==='social'?'Social':'320 × 50'}</span></td>
              <td className={cell}><span data-testid={`status-ad-code-${ad.id}`}><Badge>{ad.enabled?'مفعّل':'معطّل'}</Badge></span></td>
              <td className={`${cell} text-xs text-slate-500`}>{ad.updatedAt||'—'}</td>
              <td className={cell}><div className="flex flex-wrap gap-1.5"><button type="button" data-testid={`button-preview-ad-${ad.id}`} aria-label={`معاينة ${ad.name}`} className={`${soft} min-h-9 px-2.5`} onClick={()=>refreshPreview(ad)}><Eye size={14}/>معاينة</button><button type="button" data-testid={`button-edit-ad-${ad.id}`} aria-label={`تعديل ${ad.name}`} className={`${soft} min-h-9 px-2.5`} onClick={()=>startEdit(ad)}><Pencil size={14}/>تعديل</button><button type="button" data-testid={`button-toggle-ad-${ad.id}`} aria-label={`${ad.enabled?'تعطيل':'تفعيل'} ${ad.name}`} className={`${btn} min-h-9 px-2.5 ${ad.enabled?'bg-amber-50 text-amber-800':'bg-emerald-50 text-emerald-800'}`} onClick={()=>toggleAd(ad)}>{ad.enabled?'تعطيل':'تفعيل'}</button><button type="button" data-testid={`button-delete-ad-${ad.id}`} aria-label={`حذف ${ad.name} نهائيًا`} className={`${btn} min-h-9 bg-rose-50 px-2.5 text-rose-700 hover:bg-rose-100`} onClick={()=>removeAd(ad)}><Trash2 size={14}/>حذف</button></div></td>
            </tr>))}
      </div>;
   }
    if(page==='settings') return <SettingsPanel values={data.settings} pricing={pricing} onSave={async v=>{
      try {
        const withdrawalSettings = await apiPatch<Pick<State['settings'], 'binanceWithdrawMin' | 'web3WithdrawMin'>>('admin/settings/withdrawal', {
          binanceWithdrawMin: Number(v.binanceWithdrawMin),
          web3WithdrawMin: Number(v.web3WithdrawMin),
        });
        if(Boolean(v.maintenance)!==Boolean(data.settings.maintenance)){
          await apiPatch('admin/settings/maintenance',{enabled:Boolean(v.maintenance)});
        }
        setData(d=>({...d,settings:{...d.settings,...v,...withdrawalSettings}}));
        await loadRemote(true);
        announce('تم حفظ الحد الأدنى للسحب على الخادم');
      } catch {
        announce('تعذر حفظ الإعدادات على الخادم');
        await loadRemote(true);
      }
    }} onPricingSave={nextPricing=>{saveLocalPricing(nextPricing);announce('تم تحديث الأسعار')}}/>;
    if(page==='maintenance') return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className={`p-5 sm:p-7 ${data.settings.maintenance?'bg-amber-50':'bg-emerald-50'}`}><span className={`grid h-12 w-12 place-items-center rounded-2xl ${data.settings.maintenance?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}><Activity size={22}/></span><h2 className="mt-4 text-xl font-extrabold">{data.settings.maintenance?'الصيانة مفعّلة':'الخدمة تعمل بشكل طبيعي'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{data.settings.maintenance?'الطلبات الجديدة للمستخدمين متوقفة مؤقتًا. يبقى دخول المشرف متاحًا حتى تنتهي الصيانة.':'فعّل الصيانة لإيقاف واجهات المستخدم مؤقتًا مع الإبقاء على وصول المشرف إلى لوحة الإدارة.'}</p><button className={`${btn} mt-5 min-h-11 ${data.settings.maintenance?'bg-emerald-600 text-white':'bg-amber-500 text-white'}`} onClick={()=>{const enabled=!Boolean(data.settings.maintenance);apiPatch<{maintenance:boolean}>('admin/settings/maintenance',{enabled}).then(result=>{setData(d=>({...d,settings:{...d.settings,maintenance:result.maintenance}}));announce(enabled?'تم تفعيل وضع الصيانة':'تم إنهاء الصيانة')}).catch(()=>announce('تعذر تغيير وضع الصيانة'))}}>{data.settings.maintenance?'إنهاء الصيانة':'بدء الصيانة'}</button></div><div className="p-5 text-xs leading-6 text-slate-500">يُحفظ هذا الخيار على قاعدة البيانات، ويُطبّق من الخادم على طلبات المستخدمين. يستطيع المشرف متابعة الإدارة أثناء الصيانة.</div></section>;
    if(page==='notifications') return <NotificationPanel reports={data.reports} onSend={async r=>{const {image,...reportFields}=r;const result=await apiPost<NotifyResult>('admin/notifications/send',{title:r.title,message:r.message,recipientMode:r.recipientMode,userIds:r.userIds,buttonText:r.buttonText,buttonUrl:r.buttonUrl,image:image??undefined});const report={...reportFields,hasImage:Boolean(image),id:`NTF-${Date.now()}`,createdAt:new Date().toLocaleString('ar'),status:result.sent>0?`أُرسل ${result.sent} من ${result.targeted}${result.failed?` · تعذّر ${result.failed}`:''}`:`فشل الإرسال (${result.failed})`};setData(d=>({...d,reports:[report,...d.reports].slice(0,50)}));announce(result.sent>0?`تم إرسال الإشعار إلى ${result.sent} مستخدم${result.failed?` · تعذّر ${result.failed}`:''}`:'فشل الإرسال إلى جميع المستلمين');return result}}/>;
   if(page==='audit') return <div className="space-y-4">{panel(<p className="text-xs leading-5 text-slate-500">آخر 500 تغيير حالة نفّذه مشرف محفوظة على الخادم، مع المسؤول والقسم والسجل والحالة الجديدة.</p>)}{table(['الوقت','المسؤول','القسم','معرّف السجل','الحالة الجديدة'],data.adminAudit.filter(r=>!query||[r.adminId,r.collection,r.recordId,r.newStatus].some(value=>String(value??'').toLowerCase().includes(query.toLowerCase()))).map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}>{r.createdAt}</td><td className={cell}>{userBy(Number(r.adminId))?.name || r.adminId}</td><td className={cell}>{({users:'المستخدمون',deposits:'الإيداعات',withdrawals:'السحوبات',campaigns:'الحملات',proofs:'الإثباتات',suspicious:'الإشارات المشبوهة'} as Record<string,string>)[String(r.collection)] || r.collection}</td><td className={cell}>{r.recordId}</td><td className={cell}><Badge>{r.newStatus}</Badge></td></tr>))}</div>;
  return <div className="space-y-4">{panel(<div className="flex gap-3">{search}{statusSelect(['مفتوح','تمت المراجعة'])}</div>)}{table(['الإشارة','المستخدم','نوع الإشارة','الوقت','الحالة','الإجراء'],rowData('suspicious').map(r=><tr key={r.id} className="border-b border-slate-50"><td className={cell}>{r.id}</td><td className={cell}>{userBy(r.userId)?.name} · {r.userId}</td><td className={cell}>{r.attempt}</td><td className={cell}>{r.createdAt}</td><td className={cell}><Badge>{r.status}</Badge></td><td className={cell}>{action('حظر المستخدم',()=>confirm('حظر هذا المستخدم؟',async()=>{const banned=await updateRows('users',r.userId as number,{status:'محظور'});if(banned)await updateRows('suspicious',r.id,{status:'تمت المراجعة'});return banned},'تم حظر المستخدم'),true)}</td></tr>))}</div>;
 };

  return <main dir="rtl" className="admin-console min-h-[100dvh] bg-[#f7f9fc] px-3 pb-28 pt-4 text-[#12234b] sm:px-6 lg:px-8">
  <div className="mx-auto max-w-[1440px]">{header}
    <div className="mt-5">{content()}</div>
  </div>
  {toast&&<div role="status" className="fixed bottom-20 right-4 z-[110] rounded-xl bg-[#12234b] px-4 py-3 text-sm font-bold text-white shadow-xl">{toast}</div>}
  {dialog&&<Dialog dialog={dialog} data={data} userBy={userBy} onClose={()=>setDialog(null)} onConfirmAction={async()=>{const run=pendingAction;const successMessage=pendingSuccessMessage;setPendingAction(null);setDialog(null);try{const result=await run?.();if(result!==false)announce(successMessage)}catch{announce('تعذر تنفيذ الإجراء')}}} onConfirm={async(id,patch,kind)=>{let saved=true;if(kind==='user-edit'||kind==='user'){saved=await saveUserPatch(id as number,patch)}else if(kind==='reject-proof'){saved=await updateRows('proofs',id as string,patch)}else if(kind==='campaign'){saved=await updateRows('campaigns',id as string,patch)}if(saved){setDialog(null);announce('تم حفظ التغيير')}return saved}} onDelete={async id=>updateRows('users',id,{status:'محظور'})} onAction={cb=>{confirm('تأكيد الإجراء؟',cb)}}/>}
 </main>;
}

function SettingsPanel({values,onSave,pricing,onPricingSave}:{values:Record<string,any>;onSave:(v:Record<string,any>)=>Promise<void>;pricing:LocalPricing;onPricingSave:(pricing:LocalPricing)=>void}) {
 const [v,setV]=useState(values); useEffect(()=>setV(values),[values]);
 const [saving,setSaving]=useState(false);
 const [editing,setEditing]=useState<{platform:PricingPlatform;index:number}|null>(null);
 const [tierDraft,setTierDraft]=useState({value:'',price:''});
 const [pricingDraft,setPricingDraft]=useState(pricing); useEffect(()=>setPricingDraft(pricing),[pricing]);
 const pricingOptions:[PricingPlatform,string][]=[['youtube','YouTube'],['tiktok','TikTok'],['telegram','Telegram']];
 const fields:[string,string][]=[['binanceWithdrawMin','الحد الأدنى للسحب عبر Binance (USDT)'],['web3WithdrawMin','الحد الأدنى للسحب عبر Web3 (USDT)'],['starsDepositMin','الحد الأدنى للإيداع عبر Stars'],['web3DepositMin','الحد الأدنى للإيداع عبر Web3 (USDT)'],['userShare','حصة المستخدم من الإيراد (%)'],['platformShare','حصة المنصة (%)'],['durationMin','أقصر مدة فيديو (ثانية)'],['durationMax','أطول مدة فيديو (ثانية)'],['cpmMin','أقل CPM'],['cpmMax','أعلى CPM'],['telegramCpm','CPM إعلانات Telegram'],['tiktokCpm','CPM إعلانات TikTok'],['telegramTaskReward','مكافأة مهمة Telegram الثابتة (USDT)'],['tiktokTaskReward','مكافأة مهمة TikTok الثابتة (USDT)'],['web3Address','عنوان Web3']];
 const openTier=(platform:PricingPlatform,index:number)=>{const tier=pricingDraft[platform][index];setTierDraft({value:String(tier.value),price:String(tier.price)});setEditing({platform,index});};
 const saveTier=()=>{if(!editing)return;const value=Number(tierDraft.value),price=Number(tierDraft.price);if(!Number.isFinite(value)||value<=0||!Number.isFinite(price)||price<0)return;const next={...pricingDraft,[editing.platform]:pricingDraft[editing.platform].map((tier,index)=>index===editing.index?{value,price}:tier)};setPricingDraft(next);onPricingSave(next);setEditing(null);};
  return <div className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="mb-4 font-extrabold">ضوابط المنصة</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fields.map(([key,label])=><Field key={key} label={label} type={key==='web3Address'?'text':'number'} min={key.endsWith('WithdrawMin')?'0.000001':undefined} step="any" value={v[key]} onChange={e=>setV({...v,[key]:key==='web3Address'?e.target.value:Number(e.target.value)})}/>)}</div><label className="mt-4 flex min-h-11 items-center gap-3 rounded-xl bg-[#fff9eb] p-3 text-sm font-bold"><input type="checkbox" checked={v.maintenance} onChange={e=>setV({...v,maintenance:e.target.checked})}/> وضع الصيانة</label><button disabled={saving} className={`${primary} mt-4 min-h-11`} onClick={async()=>{setSaving(true);try{await onSave(v)}finally{setSaving(false)}}}>{saving?'جارٍ الحفظ…':'حفظ الإعدادات'}</button></section>
  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4"><h2 className="font-extrabold">أسعار المعلنين</h2><p className="mt-1 text-xs leading-5 text-slate-500">مكافآت مهام Telegram وTikTok الثابتة مستقلة عن هذه الأسعار.</p></div><div className="space-y-5">{pricingOptions.map(([platform,name])=><div key={platform}><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-extrabold">{name}</h3><span className="text-[10px] text-slate-400">٤ خيارات ثابتة</span></div><div className="divide-y divide-slate-100 rounded-xl bg-[#f8faff] px-3">{pricingDraft[platform].map((tier,index)=><div key={`${platform}-${index}`} className="flex min-h-14 items-center gap-2 py-2"><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{tier.value.toLocaleString('en-US')} {platform==='youtube'?'ثانية':platform==='tiktok'?'متابع':'مشترك'}</div><div className="mt-0.5 text-[11px] text-slate-500">{platform==='youtube'?<><b className="font-mono text-[#12234b]">${tier.price.toFixed(2)}</b> CPM</>:<>سعر المعلن <b className="font-mono text-[#12234b]">${tier.price.toFixed(2)}</b></>}</div></div><button type="button" data-testid={`button-edit-price-${platform}-${index}`} className={`${soft} min-h-10 min-w-[64px]`} onClick={()=>openTier(platform,index)}>تعديل</button></div>)}</div></div>)}</div></section>
  {editing&&<div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#061333]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event=>{if(event.target===event.currentTarget)setEditing(null)}}><section role="dialog" aria-modal="true" aria-labelledby="pricing-editor-title" className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl"><div className="mb-4 flex items-center justify-between"><div><h2 id="pricing-editor-title" className="font-extrabold">تعديل سعر {pricingOptions.find(item=>item[0]===editing.platform)?.[1]}</h2></div><button type="button" aria-label="إغلاق" className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={()=>setEditing(null)}><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2"><Field label={editing.platform==='youtube'?'المدة (ثانية)':editing.platform==='tiktok'?'عدد المتابعين':'عدد المشتركين'} type="number" min="1" step="1" value={tierDraft.value} onChange={event=>setTierDraft({...tierDraft,value:event.target.value})}/><Field label={editing.platform==='youtube'?'سعر CPM ($)':'سعر المعلن ($)'} type="number" min="0" step="0.01" value={tierDraft.price} onChange={event=>setTierDraft({...tierDraft,price:event.target.value})}/></div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" className={`${soft} min-h-11`} onClick={()=>setEditing(null)}>إغلاق</button><button type="button" className={`${primary} min-h-11`} onClick={saveTier}>حفظ</button></div></section></div>}</div>;
}

const MAX_NOTIFICATION_IMAGE_SIDE = 1280;
const MAX_NOTIFICATION_IMAGE_CHARS = 3_200_000;

function explainTelegramError(reason: string) {
 if (/can't initiate conversation|cannot initiate/i.test(reason)) return 'المستخدم لم يبدأ محادثة مع البوت بعد (يجب أن يضغط Start في البوت)';
 if (/blocked by the user/i.test(reason)) return 'المستخدم حظر البوت';
 if (/chat not found/i.test(reason)) return 'المحادثة غير موجودة: المعرّف غير صحيح أو لم يبدأ المستخدم البوت';
 if (/user is deactivated/i.test(reason)) return 'حساب المستخدم محذوف أو معطّل';
 if (/unauthorized|not configured/i.test(reason)) return 'رمز البوت غير صحيح أو غير مضبوط على الخادم (TELEGRAM_BOT_TOKEN)';
 if (/too many requests/i.test(reason)) return 'تجاوز حد الإرسال في Telegram، أعد المحاولة بعد قليل';
 if (/timed out|network error/i.test(reason)) return 'تعذر الاتصال بخوادم Telegram';
 if (/wrong file identifier|failed to get http url content|image_process_failed|photo_invalid/i.test(reason)) return 'رفض Telegram الصورة، جرّب صورة أخرى';
 return 'خطأ من Telegram';
}

async function prepareNotificationImage(file: File): Promise<string> {
 if (!file.type.startsWith('image/')) throw new Error('اختر ملف صورة (JPG أو PNG أو WEBP)');
 if (file.size > 20 * 1024 * 1024) throw new Error('حجم الصورة كبير جدًا (الحد 20MB)');
 const objectUrl = URL.createObjectURL(file);
 try {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
   const element = new Image();
   element.onload = () => resolve(element);
   element.onerror = () => reject(new Error('تعذر قراءة الصورة، جرّب صورة أخرى'));
   element.src = objectUrl;
  });
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longest) throw new Error('تعذر قراءة الصورة، جرّب صورة أخرى');
  const scale = Math.min(1, MAX_NOTIFICATION_IMAGE_SIDE / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('المتصفح لا يدعم معالجة الصور');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.86, 0.72, 0.58, 0.45]) {
   const dataUrl = canvas.toDataURL('image/jpeg', quality);
   if (dataUrl.length <= MAX_NOTIFICATION_IMAGE_CHARS) return dataUrl;
  }
  throw new Error('تعذر تصغير الصورة بما يكفي، اختر صورة أصغر');
 } finally {
  URL.revokeObjectURL(objectUrl);
 }
}

function NotificationPanel({reports,onSend}:{reports:Row[];onSend:(r:Record<string,any>)=>Promise<NotifyResult>}) {
 const draftKey='vidreward.admin.notification-draft.v1';
 const [draft]=useState(()=>{try{return JSON.parse(localStorage.getItem(draftKey)??'{}')}catch{return {}}});
 const [title,setTitle]=useState(String(draft.title??''));
 const [body,setBody]=useState(String(draft.body??''));
 const [buttonTitle,setButtonTitle]=useState(String(draft.buttonTitle??''));
 const [link,setLink]=useState(String(draft.link??''));
 const [recipientMode,setRecipientMode]=useState<'all'|'ids'>('all');
 const [userIds,setUserIds]=useState('');
 const [image,setImage]=useState<string|null>(null);
 const [imageName,setImageName]=useState('');
 const [imageBusy,setImageBusy]=useState(false);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState<NotifyResult|null>(null);
 const fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{try{localStorage.setItem(draftKey,JSON.stringify({title,body,buttonTitle,link}))}catch{}},[title,body,buttonTitle,link]);
 const clearImage=()=>{setImage(null);setImageName('');if(fileInput.current)fileInput.current.value=''};
 const reset=()=>{setTitle('');setBody('');setButtonTitle('');setLink('');setError('');clearImage();try{localStorage.removeItem(draftKey)}catch{}};
 const pickImage=async(file:File|undefined)=>{if(!file)return;setError('');setImageBusy(true);try{const prepared=await prepareNotificationImage(file);setImage(prepared);setImageName(file.name)}catch(failure){setError(failure instanceof Error?failure.message:'تعذر تجهيز الصورة')}finally{setImageBusy(false);if(fileInput.current)fileInput.current.value=''}};
 const send=async()=>{if(!title.trim()||!body.trim()||sending||imageBusy)return;if(Boolean(buttonTitle.trim())!==Boolean(link.trim())){setError('أدخل نص الزر ورابطه معًا أو اترك الحقلين فارغين.');return}const ids=userIds.split(/[,\s]+/).map(value=>value.trim()).filter(Boolean);if(recipientMode==='ids'&&(!ids.length||ids.length>500||ids.some(id=>!/^\d{1,20}$/.test(id)))){setError('أدخل من 1 إلى 500 معرّف Telegram رقميًا مفصولًا بفواصل.');return}setSending(true);setError('');setResult(null);try{const outcome=await onSend({title:title.trim(),body,message:body.trim(),buttonTitle,buttonText:buttonTitle.trim(),link,buttonUrl:link.trim(),recipientMode,userIds:ids,image});setResult(outcome);if(outcome.sent>0)reset()}catch(failure){setError(failure instanceof ApiError&&failure.message&&failure.message!=='Request failed'?failure.message:'تعذر الإرسال. تحقق من اتصال الخادم ثم حاول مجددًا.')}finally{setSending(false)}};
 const resultTone=result?(result.sent===0?'border-rose-200 bg-rose-50 text-rose-800':result.failed>0?'border-amber-200 bg-amber-50 text-amber-900':'border-emerald-200 bg-emerald-50 text-emerald-800'):'';
 return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-1 font-extrabold">إرسال إشعار عبر Telegram</h2><p className="mb-4 text-xs leading-5 text-slate-500">يرسل الخادم الرسالة باستخدام توكن البوت المحفوظ في الأسرار، إلى المستخدمين المسجلين أو إلى معرّفات محددة. لا يصل الإشعار إلا لمن بدأ محادثة مع البوت.</p><div className="grid gap-4"><Field label="العنوان" value={title} onChange={e=>setTitle(e.target.value)} placeholder="عنوان الإشعار" data-testid="input-notification-title"/><label className="grid gap-1.5 text-xs font-bold text-slate-600">نص الرسالة<textarea data-testid="textarea-notification-body" value={body} onChange={e=>setBody(e.target.value)} rows={5} className="rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-400"/></label>
 <div className="grid gap-2" data-testid="notification-image-picker"><span className="text-xs font-bold text-slate-600">صورة مع الإشعار (اختياري)</span><input ref={fileInput} type="file" accept="image/*" className="hidden" data-testid="input-notification-image" onChange={e=>void pickImage(e.target.files?.[0])}/>{image?<div className="rounded-xl border border-slate-200 bg-[#f7f9fc] p-3"><img src={image} alt="معاينة صورة الإشعار" data-testid="img-notification-preview" className="mx-auto max-h-64 w-auto max-w-full rounded-lg object-contain"/><p className="mt-2 truncate text-center text-[11px] text-slate-500" dir="ltr">{imageName}</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" className={soft} disabled={imageBusy||sending} onClick={()=>fileInput.current?.click()}><ImagePlus size={14}/>تغيير الصورة</button><button type="button" data-testid="button-remove-notification-image" className={`${btn} bg-rose-50 text-rose-700`} disabled={sending} onClick={clearImage}><Trash2 size={14}/>إزالة الصورة</button></div></div>:<button type="button" data-testid="button-pick-notification-image" className={`${soft} min-h-11 w-full border-dashed`} disabled={imageBusy||sending} onClick={()=>fileInput.current?.click()}><ImagePlus size={15}/>{imageBusy?'جارٍ تجهيز الصورة…':'اختيار صورة من الجهاز'}</button>}</div>
 <div className="grid gap-3 sm:grid-cols-2"><Field label="نص زر الرابط (اختياري)" value={buttonTitle} onChange={e=>setButtonTitle(e.target.value)}/><Field label="رابط الزر (اختياري)" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://…"/></div><label className="grid gap-1.5 text-xs font-bold text-slate-600">المستلمون<select value={recipientMode} onChange={e=>setRecipientMode(e.target.value as 'all'|'ids')} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">جميع المستخدمين المسجلين غير المحظورين</option><option value="ids">معرّفات Telegram محددة</option></select></label>{recipientMode==='ids'&&<label className="grid gap-1.5 text-xs font-bold text-slate-600">معرّفات المستخدمين<textarea value={userIds} onChange={e=>setUserIds(e.target.value)} rows={3} placeholder="123456789, 987654321" className="rounded-xl border border-slate-200 p-3 font-mono text-sm outline-none focus:border-blue-400"/></label>}{error&&<p role="alert" className="text-xs text-rose-600">{error}</p>}
 {result&&<div role="status" data-testid="notification-send-result" className={`rounded-xl border p-3 text-xs leading-6 ${resultTone}`}><b className="block text-sm">{result.sent===0?'فشل الإرسال':result.failed>0?'تم الإرسال جزئيًا':'تم الإرسال بنجاح'}</b><span>المستهدفون: {result.targeted} · وصل: {result.sent} · فشل: {result.failed}{result.skipped?` · تم تجاهل ${result.skipped} معرّف (غير مسجّل أو محظور)`:''}{result.withImage?' · مع صورة':' · نص فقط'}</span>{(result.errors??[]).map(item=><div key={item.reason} className="mt-1 rounded-lg bg-white/70 px-2 py-1"><b>{explainTelegramError(item.reason)}</b> <span className="font-mono text-[10px] opacity-70" dir="ltr">({item.count}) {item.reason}</span></div>)}</div>}
 <div className="flex flex-wrap gap-2"><button type="button" data-testid="button-send-notification" className={`${primary} min-h-11 w-full`} disabled={!title.trim()||!body.trim()||sending||imageBusy} onClick={()=>void send()}><Megaphone size={15}/>{sending?'جارٍ الإرسال…':image?'إرسال النص والصورة عبر البوت':'إرسال عبر البوت'}</button><button type="button" data-testid="button-clear-notification" className={soft} onClick={()=>{reset();setResult(null)}}>مسح المسودة</button></div></div></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 font-extrabold">سجل الإشعارات</h2><div className="space-y-3">{reports.length?reports.map(r=><div key={r.id} className="rounded-xl bg-[#f7f9fc] p-3"><div className="flex justify-between gap-2"><b className="text-sm">{r.title}</b><Badge>{r.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{r.body}</p>{r.hasImage&&<p className="mt-2 text-[11px] font-bold text-slate-500">مرفق صورة</p>}{r.buttonTitle&&<p className="mt-2 text-[11px] font-bold text-[#1557ee]">{r.buttonTitle}{r.link?` · ${r.link}`:''}</p>}<div className="mt-2 text-[10px] text-slate-400">{r.createdAt}</div></div>):<p className="rounded-xl bg-[#f7f9fc] p-5 text-center text-sm text-slate-400">لا توجد إشعارات مرسلة بعد</p>}</div></section></div>;
}

function Dialog({dialog,data,userBy,onClose,onConfirm,onConfirmAction,onDelete,onAction}:{dialog:{kind:string;id?:string|number};data:State;userBy:(id:number|undefined)=>User|undefined;onClose:()=>void;onConfirm:(id:any,patch:any,kind:string)=>Promise<boolean>;onConfirmAction:()=>void;onDelete:(id:number)=>Promise<boolean>;onAction:(cb:()=>Promise<boolean|void>|boolean|void)=>void}) {
 const [values,setValues]=useState<Record<string,any>>({}); const user=dialog.kind==='user'||dialog.kind==='user-edit'?userBy(Number(dialog.id)):undefined;
  const campaign=data.campaigns.find(x=>x.id===dialog.id);const proof=data.proofs.find(x=>x.id===dialog.id);
 useEffect(()=>{if(user)setValues({...user})},[dialog.id]);
 const field=(key:string,label:string,type='text')=><Field label={label} type={type} inputMode={type==='number'?'decimal':undefined} step={type==='number'?'any':undefined} min={type==='number'?'0':undefined} value={values[key]??''} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/>;
 const [saving,setSaving]=useState(false);
 const save=(patch:Record<string,any>=values)=>onConfirm(dialog.id,patch,dialog.kind);
 const saveUserChanges=async()=>{if(!user||saving)return;const patch:Record<string,any>={};if(String(values.name??'').trim()!==String(user.name??'').trim())patch.name=values.name;if(String(values.username??'').replace(/^@/,'').trim()!==String(user.username??'').replace(/^@/,'').trim())patch.username=values.username;for(const key of ['advertiserBalance','earnedBalance'] as const){const raw=String(values[key]??'').trim();if(raw===''||Number(raw)!==Number(user[key]))patch[key]=raw}setSaving(true);try{await onConfirm(dialog.id,patch,dialog.kind)}finally{setSaving(false)}};
 let content:React.ReactNode=null;let heading='تفاصيل';
 if(dialog.kind==='user'||dialog.kind==='user-edit'){heading='ملف المستخدم';content=user&&<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><small>معرّف Telegram</small><div className="font-mono font-bold">{user.id}</div></div><div className="rounded-xl bg-slate-50 p-3"><small>الحالة</small><div><Badge>{user.status}</Badge></div></div></div><div className="grid gap-3 sm:grid-cols-2">{field('name','الاسم')}{field('username','اسم المستخدم')}{field('advertiserBalance','رصيد المعلن','number')}{field('earnedBalance','الأرباح','number')}</div><div className="grid grid-cols-2 gap-3 text-xs"><p>تاريخ التسجيل<br/><b>{user.joinedAt}</b></p><p>آخر تسجيل دخول<br/><b>{user.lastLogin}</b></p><p>آخر نشاط<br/><b>{user.lastActive}</b></p><p>دُعي بواسطة<br/><b>{user.invitedBy}</b></p></div><div className="flex flex-wrap gap-2"><button className={primary} disabled={saving} onClick={()=>void saveUserChanges()}>{saving?'جارٍ الحفظ…':'حفظ التعديلات والأرصدة'}</button><button className={soft} onClick={()=>onAction(()=>save({status:user.status==='نشط'?'محظور':'نشط'}))}>{user.status==='نشط'?'حظر':'إلغاء الحظر'}</button><button className={`${btn} bg-rose-50 text-rose-700`} onClick={()=>onAction(()=>onDelete(user.id))}><Trash2 size={14}/> حذف</button></div></div>}
 else if(dialog.kind==='campaign'){heading='مراجعة الفيديو';content=campaign&&<div className="space-y-3"><div className="aspect-video overflow-hidden rounded-xl bg-slate-900"><iframe title="معاينة فيديو الحملة" className="h-full w-full" src={campaign.videoUrl} allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"/></div><h3 className="font-bold">{campaign.title}</h3><div className="grid grid-cols-2 gap-2 text-xs text-slate-500"><span>النوع: {campaign.platform}</span><span>المدة: {campaign.duration} ثانية</span><span>الميزانية: {campaign.budget} USDT</span><span>المشاهدات: {campaign.views}</span></div><div className="flex flex-wrap gap-2">{['نشطة','مرفوضة','موقوفة'].map(status=><button key={status} className={status==='مرفوضة'?`${btn} bg-rose-50 text-rose-700`:soft} onClick={()=>status==='مرفوضة'?onAction(()=>save({status})):save({status})}>{status==='نشطة'?'اعتماد':status==='مرفوضة'?'رفض':'إيقاف مؤقت'}</button>)}</div></div>}
 else if(dialog.kind==='proof'){heading='صورة إثبات المهمة';content=proof&&<div><img src={proof.image} alt="صورة الإثبات" className="max-h-[60vh] w-full rounded-xl object-contain"/><p className="mt-3 text-xs text-slate-500">{userBy(proof.userId)?.name} · {proof.taskId}</p></div>}
 else if(dialog.kind==='reject-proof'){heading='رفض الإثبات';content=<div className="space-y-3"><label className="grid gap-1.5 text-xs font-bold">سبب الرفض<textarea value={values.reason??''} onChange={e=>setValues({...values,reason:e.target.value})} rows={3} className="rounded-xl border border-slate-200 p-3"/></label><button className={`${btn} bg-rose-600 text-white`} onClick={()=>onAction(()=>save({status:'مرفوض',rejectionReason:values.reason||'لم يطابق الإثبات المتطلبات'}))}>رفض الإثبات</button></div>}
  else {heading='تأكيد الإجراء';content=<div className="space-y-4"><p className="text-sm">{dialog.id}</p><div className="flex gap-2"><button className={`${btn} bg-rose-600 text-white`} onClick={onConfirmAction}>تأكيد</button><button className={soft} onClick={onClose}>إلغاء</button></div></div>}
 const userFullPage=dialog.kind==='user'||dialog.kind==='user-edit';
 return <div className={`fixed inset-0 z-[100] flex justify-center bg-[#061333]/45 backdrop-blur-sm ${userFullPage?'items-stretch p-0 sm:items-center sm:p-4':'items-end p-0 sm:items-center sm:p-4'}`} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section role="dialog" aria-modal="true" className={`${userFullPage?'h-[100dvh] w-full max-w-none rounded-none sm:h-auto sm:max-h-[92dvh] sm:max-w-xl sm:rounded-3xl':'max-h-[92dvh] w-full max-w-xl rounded-t-3xl sm:rounded-3xl'} overflow-y-auto bg-white p-5 shadow-2xl`}><header className="mb-4 flex items-center justify-between"><h2 className="font-extrabold">{heading}</h2><button aria-label="إغلاق" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></header>{content}</section></div>;
}