import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_TOKEN, balanceOf, call, ensureUser, installFetchStub, makeUser, nonce, setBalances, signInitData, sqlRows,
} from './helpers.mjs';

const { verifiedTelegramUser } = await import('../server/auth.js');

const ADMIN = makeUser(9001);
let fetchStub;
let nextId = 10_000;
const newUser = () => makeUser(nextId++);

async function resetLimits() {
  await sqlRows('DELETE FROM vr_api_rate_limits');
}

async function clearCooldown(ownerId) {
  await sqlRows('DELETE FROM vr_campaign_cooldowns WHERE owner_id = $1', [ownerId]);
}

async function createYoutubeCampaign(owner, key = `key-${nonce()}`, link = `https://www.youtube.com/watch?v=${nonce().slice(0, 11)}`) {
  await clearCooldown(owner.id);
  await resetLimits();
  return call({
    method: 'POST',
    path: 'campaigns',
    user: owner,
    headers: { 'idempotency-key': key },
    body: {
      platform: 'youtube', title: 'Test video', link,
      duration: 10, cpm: 1.5, requestedViews: 1000,
    },
  });
}

before(async () => {
  fetchStub = installFetchStub();
  await call({ path: 'maintenance' }); // يشغّل ensureSchema مرة واحدة
  await ensureUser(ADMIN);
});

after(() => fetchStub.restore());
beforeEach(async () => { await resetLimits(); });

describe('المصادقة (Telegram initData)', () => {
  test('يقبل البيانات الموقّعة ويرفض المعدّلة أو المنتهية أو الموقّعة بتوكن آخر', () => {
    const user = makeUser(1001);
    const good = signInitData(user);
    assert.equal(verifiedTelegramUser(good, BOT_TOKEN)?.id, 1001);

    const tampered = good.replace('%3A1001', '%3A1002');
    assert.notEqual(tampered, good);
    assert.equal(verifiedTelegramUser(tampered, BOT_TOKEN), null);

    const expired = signInitData(user, { authDate: Math.floor(Date.now() / 1000) - 25 * 3600 });
    assert.equal(verifiedTelegramUser(expired, BOT_TOKEN), null);

    const future = signInitData(user, { authDate: Math.floor(Date.now() / 1000) + 3600 });
    assert.equal(verifiedTelegramUser(future, BOT_TOKEN), null);

    assert.equal(verifiedTelegramUser(signInitData(user, { botToken: '999:OTHER' }), BOT_TOKEN), null);
    assert.equal(verifiedTelegramUser('user=%7B%22id%22%3A1%7D', BOT_TOKEN), null);
    assert.equal(verifiedTelegramUser('', BOT_TOKEN), null);
  });

  test('الكتابة بدون جلسة صالحة تُرفض بـ 401 ولا تنشئ أي سجل', async () => {
    const res = await call({ method: 'POST', path: 'withdrawals', body: { method: 'binance', amount: 1, destination: 'abc123' } });
    assert.equal(res.statusCode, 401);
    const forged = await call({
      method: 'POST', path: 'withdrawals', initData: 'user=%7B%22id%22%3A5%7D&auth_date=1&hash=' + 'a'.repeat(64),
      body: { method: 'binance', amount: 1, destination: 'abc123' },
    });
    assert.equal(forged.statusCode, 401);
    assert.equal((await sqlRows('SELECT count(*)::int AS n FROM vr_withdrawals'))[0].n, 0);
  });
});

describe('صلاحيات الإدارة والعزل بين المستخدمين', () => {
  test('مسارات الإدارة تُرفض لغير المدير (403) ولغير المسجّل (401)', async () => {
    const user = newUser();
    await ensureUser(user);
    assert.equal((await call({ path: 'admin/state', user })).statusCode, 403);
    assert.equal((await call({ method: 'PATCH', path: 'admin/users/1', user, body: { status: 'محظور' } })).statusCode, 403);
    assert.equal((await call({ method: 'DELETE', path: 'admin/users/1', user })).statusCode, 403);
    assert.equal((await call({ method: 'PATCH', path: 'admin/settings/maintenance', user, body: { enabled: true } })).statusCode, 403);
    assert.equal((await call({ path: 'admin/state' })).statusCode, 401);
    assert.equal((await call({ method: 'PATCH', path: 'admin/withdrawals/WDR-1', body: { status: 'معتمد' } })).statusCode, 401);
    assert.equal((await call({ path: 'admin/state', user: ADMIN })).statusCode, 200);
  });

  test('المستخدم لا يرى إيداعات أو سحوبات غيره ولا يعدّل حملته', async () => {
    const a = newUser(); const b = newUser();
    await ensureUser(a); await ensureUser(b);
    await setBalances(a.id, { advertiser: 5, earned: 3 });
    const deposit = await call({ method: 'POST', path: 'deposits', user: a, body: { method: 'web3', amount: 5 } });
    assert.equal(deposit.statusCode, 201);
    const withdrawal = await call({ method: 'POST', path: 'withdrawals', user: a, body: { method: 'binance', amount: 1, destination: 'binance-1234' } });
    assert.equal(withdrawal.statusCode, 201);

    assert.deepEqual((await call({ path: 'deposits', user: b })).body.data, []);
    assert.deepEqual((await call({ path: 'withdrawals', user: b })).body.data, []);
    assert.equal((await call({ path: 'deposits', user: a })).body.data.length, 1);

    const campaign = await createYoutubeCampaign(a);
    assert.equal(campaign.statusCode, 201, JSON.stringify(campaign.body));
    const id = campaign.body.data.id;
    await resetLimits();
    assert.equal((await call({ method: 'PATCH', path: `campaigns/${id}`, user: b, body: { status: 'موقوف' } })).statusCode, 404);
    assert.equal((await call({ method: 'DELETE', path: `campaigns/${id}`, user: b })).statusCode, 404);
    assert.equal((await call({ path: 'campaigns', user: b })).body.data.length, 0);
    assert.equal((await sqlRows('SELECT status FROM vr_campaigns WHERE id = $1', [id]))[0].status, 'نشط');
  });

  test('المالك لا يستطيع إعادة تفعيل حملة أوقفتها الإدارة', async () => {
    const owner = newUser();
    await ensureUser(owner);
    await setBalances(owner.id, { advertiser: 10 });
    const created = await createYoutubeCampaign(owner);
    const id = created.body.data.id;
    await resetLimits();
    const suspended = await call({ method: 'PATCH', path: `admin/campaigns/CMP-${id}`, user: ADMIN, body: { status: 'موقوفة' } });
    assert.equal(suspended.statusCode, 200);
    await resetLimits();
    const reactivate = await call({ method: 'PATCH', path: `campaigns/${id}`, user: owner, body: { status: 'نشط' } });
    assert.equal(reactivate.statusCode, 403);
    assert.equal((await sqlRows('SELECT status FROM vr_campaigns WHERE id = $1', [id]))[0].status, 'موقوف');
    await resetLimits();
    assert.equal((await call({ method: 'PATCH', path: `admin/campaigns/CMP-${id}`, user: ADMIN, body: { status: 'نشطة' } })).statusCode, 200);
    await resetLimits();
    assert.equal((await call({ method: 'PATCH', path: `campaigns/${id}`, user: owner, body: { status: 'موقوف' } })).statusCode, 200);
  });
});

describe('الرصيد والمعاملات المالية', () => {
  test('السحب بأكثر من الرصيد يُرفض (402) ولا يغيّر الرصيد', async () => {
    const user = newUser();
    await ensureUser(user);
    await setBalances(user.id, { earned: 0.5 });
    const res = await call({ method: 'POST', path: 'withdrawals', user, body: { method: 'binance', amount: 1, destination: 'binance-1234' } });
    assert.equal(res.statusCode, 402);
    assert.equal(res.body.success, false);
    assert.equal((await balanceOf(user.id)).earned, 0.5);
    assert.equal((await sqlRows('SELECT count(*)::int AS n FROM vr_withdrawals WHERE user_id = $1', [user.id]))[0].n, 0);
  });

  test('طلبان متزامنان على نفس الرصيد: ينجح واحد فقط ولا يصبح الرصيد سالبًا', async () => {
    const user = newUser();
    await ensureUser(user);
    await setBalances(user.id, { earned: 1.5 });
    const request = () => call({ method: 'POST', path: 'withdrawals', user, body: { method: 'binance', amount: 1, destination: 'binance-1234' } });
    const results = await Promise.all([request(), request()]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 402]);
    assert.equal((await balanceOf(user.id)).earned, 0.5);
    assert.equal((await sqlRows('SELECT count(*)::int AS n FROM vr_withdrawals WHERE user_id = $1', [user.id]))[0].n, 1);
  });

  test('رفض السحب يردّ المبلغ مرة واحدة فقط ولا تتكرر المعالجة', async () => {
    const user = newUser();
    await ensureUser(user);
    await setBalances(user.id, { earned: 3 });
    const created = await call({ method: 'POST', path: 'withdrawals', user, body: { method: 'web3', amount: 1, destination: '0x' + 'a'.repeat(40) } });
    const id = created.body.data.id;
    assert.equal((await balanceOf(user.id)).earned, 2);
    await resetLimits();
    const reject = () => call({ method: 'PATCH', path: `admin/withdrawals/${id}`, user: ADMIN, body: { status: 'مرفوض', reason: 'test' } });
    const [first, second] = [await reject(), await reject()];
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 409);
    assert.equal((await balanceOf(user.id)).earned, 3);
    const approveAfter = await call({ method: 'PATCH', path: `admin/withdrawals/${id}`, user: ADMIN, body: { status: 'معتمد', txId: 'TX-ABC' } });
    assert.equal(approveAfter.statusCode, 409);
    const audit = await sqlRows(`SELECT count(*)::int AS n FROM vr_admin_audit_log WHERE collection = 'withdrawals' AND record_id = $1`, [id]);
    assert.equal(audit[0].n, 1, 'سجل التدقيق يُكتب مرة واحدة ضمن نفس العملية الذرّية');
  });

  test('اعتماد الإيداع مرة واحدة، ومعرّف المعاملة الخارجية لا يُستخدم لإيداعين', async () => {
    const user = newUser();
    await ensureUser(user);
    const first = (await call({ method: 'POST', path: 'deposits', user, body: { method: 'web3', amount: 4 } })).body.data;
    await resetLimits();
    const second = (await call({ method: 'POST', path: 'deposits', user, body: { method: 'web3', amount: 6 } })).body.data;
    await resetLimits();

    const approve = (id, txId) => call({ method: 'PATCH', path: `admin/deposits/${id}`, user: ADMIN, body: { status: 'ناجح', txId } });
    assert.equal((await approve(first.id, 'TXHASH-001')).statusCode, 200);
    assert.equal((await balanceOf(user.id)).advertiser, 4);
    assert.equal((await approve(first.id, 'TXHASH-001')).statusCode, 409);
    assert.equal((await balanceOf(user.id)).advertiser, 4, 'لا اعتماد مزدوج');
    assert.equal((await approve(second.id, 'txhash-001')).statusCode, 409, 'نفس معرّف المعاملة بحروف مختلفة');
    assert.equal((await balanceOf(user.id)).advertiser, 4);
    assert.equal((await approve(second.id, 'TXHASH-002')).statusCode, 200);
    assert.equal((await balanceOf(user.id)).advertiser, 10);

    await resetLimits();
    const fail = () => call({ method: 'PATCH', path: `admin/deposits/${first.id}`, user: ADMIN, body: { status: 'فاشل', reason: 'bad' } });
    assert.equal((await fail()).statusCode, 200);
    assert.equal((await fail()).statusCode, 200);
    assert.equal((await balanceOf(user.id)).advertiser, 6, 'العكس يحدث مرة واحدة فقط');
  });

  test('إيداع Stars يقبل رابط فاتورة Telegram فقط', async () => {
    const user = newUser();
    await ensureUser(user);
    const bad = await call({ method: 'POST', path: 'deposits', user, body: { method: 'stars', amount: 2, destination: 'https://evil.example/pay', memoTag: 'vidreward:1:2.00:1' } });
    assert.equal(bad.statusCode, 400);
    const good = await call({ method: 'POST', path: 'deposits', user, body: { method: 'stars', amount: 2, destination: 'https://t.me/$abcDEF123', memoTag: 'vidreward:1:2.00:1' } });
    assert.equal(good.statusCode, 201);
  });

  test('تعديل رصيد مستخدم من الإدارة يُسجَّل بالقيم قبل وبعد في نفس العملية', async () => {
    const user = newUser();
    await ensureUser(user);
    await setBalances(user.id, { advertiser: 1, earned: 2 });
    const res = await call({ method: 'PATCH', path: `admin/users/${user.id}`, user: ADMIN, body: { advertiserBalance: 7 } });
    assert.equal(res.statusCode, 200);
    const audit = await sqlRows(`SELECT new_status FROM vr_admin_audit_log WHERE collection = 'users' AND record_id = $1`, [String(user.id)]);
    assert.equal(audit.length, 1);
    assert.match(audit[0].new_status, /adv:1\.000000->7\.000000/);
    assert.match(audit[0].new_status, /earned:2\.000000->2\.000000/);
  });

  test('فشل قاعدة البيانات لا يتحول إلى نجاح ولا يغيّر الرصيد', async () => {
    const user = newUser();
    await ensureUser(user);
    await setBalances(user.id, { earned: 5 });
    globalThis.__failQueryPattern = /INSERT INTO vr_withdrawals/;
    try {
      const res = await call({ method: 'POST', path: 'withdrawals', user, body: { method: 'binance', amount: 1, destination: 'binance-1234' } });
      assert.equal(res.statusCode, 500);
      assert.equal(res.body.success, false);
      assert.equal(res.body.data, undefined);
    } finally {
      globalThis.__failQueryPattern = undefined;
    }
    assert.equal((await balanceOf(user.id)).earned, 5);
  });
});

describe('الحملات: خصم الرصيد والتكرار', () => {
  test('لا تُنشأ حملة دون رصيد كافٍ، ولا يُخصم شيء عند الفشل', async () => {
    const poor = newUser();
    await ensureUser(poor);
    await setBalances(poor.id, { advertiser: 0.1 });
    const res = await createYoutubeCampaign(poor);
    assert.equal(res.statusCode, 402);
    assert.equal((await balanceOf(poor.id)).advertiser, 0.1);
    assert.equal((await sqlRows('SELECT count(*)::int AS n FROM vr_campaigns WHERE owner_id = $1', [poor.id]))[0].n, 0);
  });

  test('إعادة إرسال نفس مفتاح idempotency لا تخصم مرة ثانية', async () => {
    const owner = newUser();
    await ensureUser(owner);
    await setBalances(owner.id, { advertiser: 10 });
    const key = `idem-${nonce()}`;
    const link = 'https://www.youtube.com/watch?v=idempotent1';
    const first = await createYoutubeCampaign(owner, key, link);
    assert.equal(first.statusCode, 201);
    assert.equal((await balanceOf(owner.id)).advertiser, 8.5);
    const replay = await createYoutubeCampaign(owner, key, link);
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.body.data.replayed, true);
    assert.equal((await balanceOf(owner.id)).advertiser, 8.5);
    assert.equal((await sqlRows('SELECT count(*)::int AS n FROM vr_campaigns WHERE owner_id = $1', [owner.id]))[0].n, 1);
  });

  test('سقف الحملة المدفوعة: لا تُصرف مكافآت تيليجرام بعد بلوغ العدد المطلوب', async () => {
    const owner = newUser(); const v1 = newUser(); const v2 = newUser();
    for (const u of [owner, v1, v2]) await ensureUser(u);
    await setBalances(owner.id, { advertiser: 5 });
    await clearCooldown(owner.id);
    const created = await call({ method: 'POST', path: 'campaigns', user: owner, body: { platform: 'telegram', title: 'Join', link: 'https://t.me/testchannel', targetCount: 1, price: 1 } });
    assert.equal(created.statusCode, 201, JSON.stringify(created.body));
    const id = created.body.data.id;
    const first = await call({ method: 'POST', path: `tasks/${id}/complete`, user: v1 });
    assert.equal(first.statusCode, 200, JSON.stringify(first.body));
    const second = await call({ method: 'POST', path: `tasks/${id}/complete`, user: v2 });
    assert.equal(second.statusCode, 409);
    assert.equal(second.body.error, 'Campaign target reached');
    assert.equal((await balanceOf(v2.id)).earned, 0);
    assert.ok((await balanceOf(v1.id)).earned > 0);
    const visibleToThird = await call({ path: 'tasks?platform=telegram', user: v2 });
    assert.equal(visibleToThird.body.data.some((row) => row.id === id), false, 'الحملة المكتملة تختفي من المهام');
  });
});

describe('المهام والمكافآت', () => {
  test('مهمة يوتيوب: لا مكافأة بدون بدء ولا قبل المدة ولا مرتين ولا بجلسة غيرك', async () => {
    const owner = newUser(); const viewer = newUser(); const other = newUser();
    for (const u of [owner, viewer, other]) await ensureUser(u);
    await setBalances(owner.id, { advertiser: 10 });
    const created = await createYoutubeCampaign(owner);
    const id = created.body.data.id;
    await resetLimits();

    const noStart = await call({ method: 'POST', path: `tasks/${id}/complete`, user: viewer });
    assert.equal(noStart.statusCode, 409);
    assert.equal((await balanceOf(viewer.id)).earned, 0);

    assert.equal((await call({ method: 'POST', path: `tasks/${id}/start`, user: viewer })).statusCode, 200);
    await resetLimits();
    const tooEarly = await call({ method: 'POST', path: `tasks/${id}/complete`, user: viewer });
    assert.equal(tooEarly.statusCode, 409);
    assert.equal((await balanceOf(viewer.id)).earned, 0);

    // جلسة مستخدم آخر لا تُستخدم: «other» لم يبدأ المهمة حتى لو انتهى وقت viewer.
    await sqlRows(`UPDATE vr_completions SET started_at = now() - interval '11 seconds' WHERE campaign_id = $1 AND user_id = $2`, [id, viewer.id]);
    await resetLimits();
    const stolen = await call({ method: 'POST', path: `tasks/${id}/complete`, user: other });
    assert.equal(stolen.statusCode, 409);
    assert.equal((await balanceOf(other.id)).earned, 0);

    await resetLimits();
    const done = await call({ method: 'POST', path: `tasks/${id}/complete`, user: viewer });
    assert.equal(done.statusCode, 200, JSON.stringify(done.body));
    const earned = (await balanceOf(viewer.id)).earned;
    assert.ok(Math.abs(earned - 0.00045) < 1e-9, `المكافأة محسوبة على الخادم: ${earned}`);

    await resetLimits();
    const again = await call({ method: 'POST', path: `tasks/${id}/complete`, user: viewer });
    assert.equal(again.statusCode, 200);
    assert.equal(again.body.data.alreadyCredited, true);
    assert.equal((await balanceOf(viewer.id)).earned, earned, 'لا مكافأة ثانية');
    const row = (await sqlRows('SELECT views::int AS views, completed_count AS completed FROM vr_campaigns WHERE id = $1', [id]))[0];
    assert.equal(row.views, 1);
    assert.equal(row.completed, 1);
    assert.equal((await call({ method: 'POST', path: 'tasks/999999/complete', user: viewer })).statusCode, 404);
  });

  test('الإنجاز لا يُصرف قبل تحقق شرطه ولا يُصرف مرتين', async () => {
    const user = newUser();
    await ensureUser(user);
    const early = await call({ method: 'POST', path: 'achievements/claim', user, body: { id: 'invite_daily' } });
    assert.equal(early.statusCode, 400);
    assert.equal((await balanceOf(user.id)).earned, 0);
    for (let i = 0; i < 3; i += 1) {
      await sqlRows(`INSERT INTO vr_users (id, first_name, invited_by) VALUES ($1, 'ref', $2)`, [900_000 + user.id * 10 + i, user.id]);
    }
    await resetLimits();
    const claimed = await call({ method: 'POST', path: 'achievements/claim', user, body: { id: 'invite_daily' } });
    assert.equal(claimed.statusCode, 200, JSON.stringify(claimed.body));
    await resetLimits();
    const duplicate = await call({ method: 'POST', path: 'achievements/claim', user, body: { id: 'invite_daily' } });
    assert.equal(duplicate.statusCode, 409);
    assert.ok(Math.abs((await balanceOf(user.id)).earned - 0.007) < 1e-9);
    assert.equal((await call({ method: 'POST', path: 'achievements/claim', user, body: { id: 'does_not_exist' } })).statusCode, 400);
  });

  test('مكافأة إعلان Adsterra: فاصل زمني يمنع التكرار الفوري', async () => {
    const user = newUser();
    await ensureUser(user);
    const first = await call({ method: 'POST', path: 'ads/reward/adstera', user });
    assert.equal(first.statusCode, 200);
    const second = await call({ method: 'POST', path: 'ads/reward/adstera', user });
    assert.equal(second.statusCode, 429);
    assert.ok(Math.abs((await balanceOf(user.id)).earned - first.body.data.reward) < 1e-9);
  });

  test('جلسة Monetag: مرتبطة بصاحبها، لا إكمال فوري، ولا مكافأة مكررة', async () => {
    const owner = newUser(); const intruder = newUser();
    await ensureUser(owner); await ensureUser(intruder);
    const session = await call({ method: 'POST', path: 'ads/monetag/session', user: owner });
    assert.equal(session.statusCode, 201);
    const id = session.body.data.id;
    const complete = (user, step) => call({ method: 'POST', path: `ads/monetag/session/${id}/complete`, user, body: { step } });

    assert.equal((await complete(intruder, 1)).statusCode, 404, 'جلسة مستخدم آخر');
    assert.equal((await complete(owner, 1)).statusCode, 429, 'إكمال فوري قبل زمن الإعلان');
    assert.equal((await balanceOf(owner.id)).earned, 0);

    await sqlRows(`UPDATE vr_monetag_ad_sessions SET created_at = now() - interval '120 seconds' WHERE id = $1`, [id]);
    await resetLimits();
    assert.equal((await complete(owner, 1)).statusCode, 200);
    const last = await complete(owner, 2);
    assert.equal(last.statusCode, 200);
    assert.equal(last.body.data.credited, true);
    const earned = (await balanceOf(owner.id)).earned;
    assert.ok(earned > 0);
    await resetLimits();
    await complete(owner, 2);
    await complete(owner, 1);
    assert.equal((await balanceOf(owner.id)).earned, earned, 'نفس الجلسة لا تُصرف مرتين');
    assert.equal((await sqlRows('SELECT count(*)::int AS n FROM vr_monetag_reward_credits WHERE session_id = $1', [id]))[0].n, 1);
  });
});

describe('طبقة الحماية (nonce وتحديد المعدل)', () => {
  test('نفس الـ nonce لا يُقبل مرتين، وغيابه يُرفض', async () => {
    const user = newUser();
    await ensureUser(user);
    const fixed = nonce();
    const first = await call({ method: 'POST', path: 'withdrawals', user, headers: { 'x-request-nonce': fixed }, body: { method: 'nope' } });
    assert.equal(first.statusCode, 400);
    const replay = await call({ method: 'POST', path: 'withdrawals', user, headers: { 'x-request-nonce': fixed }, body: { method: 'nope' } });
    assert.equal(replay.statusCode, 409);
    const missing = await call({ method: 'POST', path: 'withdrawals', user, withNonce: false, body: { method: 'nope' } });
    assert.equal(missing.statusCode, 400);
    assert.match(missing.body.error, /nonce/i);
  });

  test('حد مسارات المال أضيق من الحد العام ويُنفَّذ لكل مستخدم', async () => {
    const user = newUser(); const other = newUser();
    await ensureUser(user); await ensureUser(other);
    const codes = [];
    for (let i = 0; i < 6; i += 1) {
      codes.push((await call({ method: 'POST', path: 'withdrawals', user, body: { method: 'nope' } })).statusCode);
    }
    assert.deepEqual(codes, [400, 400, 400, 400, 429, 429]);
    assert.equal((await call({ method: 'POST', path: 'withdrawals', user: other, body: { method: 'nope' } })).statusCode, 400);
  });

  test('الحد العام للطلبات يُطبَّق (429 بعد تجاوز النافذة)', async () => {
    const user = newUser();
    await ensureUser(user);
    await resetLimits();
    let blocked = 0;
    for (let i = 0; i < 45; i += 1) {
      if ((await call({ path: 'balance', user })).statusCode === 429) blocked += 1;
    }
    assert.ok(blocked >= 4, `توقّعنا رفض 5 طلبات تقريبًا لكن رُفض ${blocked}`);
  });

  test('غياب الأسرار في الإنتاج يعطّل الخدمة بدل تشغيل حماية ضعيفة بصمت', async () => {
    const saved = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SECURITY_HASH_SECRET;
      delete process.env.TELEGRAM_BOT_TOKEN;
      const noToken = await call({ path: 'tasks', user: undefined });
      assert.equal(noToken.statusCode, 503);
      process.env.TELEGRAM_BOT_TOKEN = saved.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;
      const { keyedHash } = await import('../server/security.js');
      assert.throws(() => keyedHash('x'), (error) => error.status === 503);
    } finally {
      process.env.NODE_ENV = saved.NODE_ENV;
      process.env.TELEGRAM_BOT_TOKEN = saved.TELEGRAM_BOT_TOKEN;
      process.env.SECURITY_HASH_SECRET = saved.SECURITY_HASH_SECRET;
    }
  });
});
