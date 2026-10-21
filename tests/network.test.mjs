import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { call, ensureUser, installFetchStub, makeUser } from './helpers.mjs';

const { resetNetworkCacheForTests, inspectNetwork } = await import('../server/network.js');

const VPN_IP = '198.51.100.7';
const CLEAN_IP = '198.51.100.8';
let providerCalls = 0;
let providerMode = 'normal';
let stub;
const saved = {};

const providerResponse = (url) => {
  providerCalls += 1;
  if (providerMode === 'down') throw new Error('provider unreachable');
  const ip = decodeURIComponent(new URL(url).pathname.split('/').pop());
  const proxy = ip === VPN_IP;
  return new Response(JSON.stringify({ status: 'ok', [ip]: proxy ? { proxy: 'yes', type: 'VPN' } : { proxy: 'no' } }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};

let secondMode = 'clean';
const secondProviderResponse = (url) => {
  if (secondMode === 'down') throw new Error('unreachable');
  const ip = new URL(url).searchParams.get('q');
  const flags = { is_vpn: false, is_tor: false, is_proxy: false, is_datacenter: false };
  if (secondMode === 'datacenter' || ip === '198.51.100.55') flags.is_datacenter = true;
  if (secondMode === 'vpn' || ip === '198.51.100.56') flags.is_vpn = true;
  return new Response(JSON.stringify({ ip, ...flags }), { status: 200, headers: { 'content-type': 'application/json' } });
};

before(async () => {
  for (const key of ['VPN_PROTECTION', 'VPN_FAIL_CLOSED', 'VPN_CHECK_API_KEY']) saved[key] = process.env[key];
  process.env.VPN_PROTECTION = 'on';
  process.env.VPN_CHECK_API_KEY = 'test-key-not-real';
  stub = installFetchStub({
    custom: async (url) => {
      if (url.startsWith('https://proxycheck.io/')) return providerResponse(url);
      if (url.startsWith('https://api.ipapi.is/')) return secondProviderResponse(url);
      return null;
    },
  });
  await call({ path: 'maintenance' });
});

after(() => {
  stub.restore();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

beforeEach(() => {
  resetNetworkCacheForTests();
  providerCalls = 0;
  providerMode = 'normal';
  secondMode = 'clean';
  delete process.env.VPN_FAIL_CLOSED;
  process.env.VPN_PROTECTION = 'on';
});

describe('المزوّد الثاني (ipapi.is) يغطي ما يفوت المزوّد الأول', () => {
  test('VPN أو مركز بيانات يُحجب حتى لو قال proxycheck إنه نظيف', async () => {
    const vpn = await call({ path: 'network/check', ip: '198.51.100.56' });
    assert.equal(vpn.body.data.vpn, true);
    const datacenter = await call({ path: 'network/check', ip: '198.51.100.55' });
    assert.equal(datacenter.body.data.vpn, true);
    process.env.VPN_BLOCK_DATACENTER = 'false';
    resetNetworkCacheForTests();
    const allowed = await call({ path: 'network/check', ip: '198.51.100.57' });
    delete process.env.VPN_BLOCK_DATACENTER;
    assert.equal(allowed.body.data.vpn, false);
  });

  test('سقوط أحد المزوّدين لا يعطّل الآخر', async () => {
    secondMode = 'down';
    const viaFirst = await call({ path: 'network/check', ip: VPN_IP });
    assert.equal(viaFirst.body.data.vpn, true);
    const clean = await call({ path: 'network/check', ip: '198.51.100.60' });
    assert.equal(clean.body.data.vpn, false);
    assert.equal(clean.body.data.checked, true);
  });
});

describe('الحماية ضد VPN / Proxy', () => {
  test('الفحص يكتشف عنوان VPN ويسمح بالعنوان النظيف', async () => {
    const blocked = await call({ path: 'network/check', ip: VPN_IP });
    assert.equal(blocked.statusCode, 200);
    assert.equal(blocked.body.data.vpn, true);
    const clean = await call({ path: 'network/check', ip: CLEAN_IP });
    assert.equal(clean.body.data.vpn, false);
    assert.equal(clean.body.data.checked, true);
  });

  test('عمليات الكتابة تُرفض من خلف VPN برمز VPN_DETECTED وتمر من عنوان نظيف', async () => {
    const user = makeUser(70001);
    await ensureUser(user);
    const viaVpn = await call({ method: 'POST', path: 'withdrawals', user, ip: VPN_IP, body: { method: 'nope' } });
    assert.equal(viaVpn.statusCode, 403);
    assert.equal(viaVpn.body.code, 'VPN_DETECTED');
    assert.equal(viaVpn.body.success, false);
    const viaClean = await call({ method: 'POST', path: 'withdrawals', user, ip: CLEAN_IP, body: { method: 'nope' } });
    assert.equal(viaClean.statusCode, 400, 'تجاوز فحص الشبكة ووصل إلى التحقق العادي من الطلب');
  });

  test('المدير مستثنى حتى لا يفقد وصوله إلى لوحة الإدارة', async () => {
    const admin = makeUser(9001);
    await ensureUser(admin);
    const res = await call({ method: 'PATCH', path: 'admin/suspicious/SIG-1', user: admin, ip: VPN_IP, body: { status: 'مفتوح' } });
    assert.equal(res.statusCode, 404);
  });

  test('نتيجة الفحص تُخزَّن ولا يُستعلم المزوّد في كل طلب', async () => {
    const fresh = '198.51.100.99';
    await call({ path: 'network/check', ip: fresh });
    await call({ path: 'network/check', ip: fresh });
    resetNetworkCacheForTests(); // حتى بعد فقدان ذاكرة النسخة تبقى النتيجة في قاعدة البيانات
    await call({ path: 'network/check', ip: fresh });
    assert.equal(providerCalls, 1);
  });

  test('تعذّر المزوّد: السماح افتراضيًا، والحظر عند VPN_FAIL_CLOSED=true', async () => {
    providerMode = 'down';
    secondMode = 'down';
    const open = await call({ path: 'network/check', ip: '198.51.100.20' });
    assert.equal(open.body.data.vpn, false);
    assert.equal(open.body.data.checked, false);
    process.env.VPN_FAIL_CLOSED = 'true';
    const closed = await call({ path: 'network/check', ip: '198.51.100.21' });
    assert.equal(closed.body.data.vpn, true);
  });

  test('العناوين المحلية والتعطيل الصريح لا يستدعيان المزوّد', async () => {
    const local = await inspectNetwork({ headers: { 'x-vercel-forwarded-for': '10.1.2.3' } });
    assert.equal(local.enforced, false);
    process.env.VPN_PROTECTION = 'off';
    const off = await inspectNetwork({ headers: { 'x-vercel-forwarded-for': VPN_IP } });
    assert.equal(off.enforced, false);
    assert.equal(off.proxy, false);
    assert.equal(providerCalls, 0);
  });

  test('ترويسة x-forwarded-for المزوّرة لا تُستخدم خارج Vercel', async () => {
    const savedVercel = process.env.VERCEL;
    delete process.env.VERCEL;
    try {
      const { requestIp } = await import('../server/ip.js');
      assert.equal(requestIp({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '203.0.113.9' } }), '203.0.113.9');
    } finally {
      process.env.VERCEL = savedVercel;
    }
  });
});
