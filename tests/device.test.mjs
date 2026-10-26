import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { call, deviceIdFor, ensureUser, makeUser, sqlRows } from './helpers.mjs';

const { resetDeviceCacheForTests } = await import('../server/security.js');

const FP_A = 'a'.repeat(64);
const FP_B = 'b'.repeat(64);
const WIFI = '203.0.113.50';
const OTHER_NET = '203.0.113.51';

const asDevice = (deviceLabel, fingerprint) => ({
  'x-client-device-id': deviceIdFor(deviceLabel),
  ...(fingerprint ? { 'x-device-fingerprint': fingerprint } : {}),
});

beforeEach(() => {
  resetDeviceCacheForTests();
  delete process.env.DEVICE_BINDING;
  delete process.env.DEVICE_MAX_ACCOUNTS;
  delete process.env.DEVICE_FINGERPRINT_MODE;
});

await call({ path: 'maintenance' });

describe('حساب واحد لكل جهاز', () => {
  test('الحساب الثاني على نفس معرّف الجهاز يُمنع، والأول يبقى يعمل', async () => {
    const first = makeUser(81001);
    const second = makeUser(81002);
    const ok = await call({ path: 'balance', user: first, headers: asDevice('phone-1') });
    assert.equal(ok.statusCode, 200);
    const blocked = await call({ path: 'balance', user: second, headers: asDevice('phone-1') });
    assert.equal(blocked.statusCode, 403);
    assert.equal(blocked.body.code, 'MULTI_ACCOUNT_DEVICE');
    const stillWorks = await call({ path: 'balance', user: first, headers: asDevice('phone-1') });
    assert.equal(stillWorks.statusCode, 200);
    const blockedWrite = await call({ method: 'POST', path: 'withdrawals', user: second, headers: asDevice('phone-1'), body: { method: 'nope' } });
    assert.equal(blockedWrite.statusCode, 403);
    assert.equal(blockedWrite.body.code, 'MULTI_ACCOUNT_DEVICE');
  });

  test('نفس المستخدم يمكنه استخدام أكثر من جهاز', async () => {
    const user = makeUser(81010);
    assert.equal((await call({ path: 'balance', user, headers: asDevice('phone-a') })).statusCode, 200);
    assert.equal((await call({ path: 'balance', user, headers: asDevice('phone-b') })).statusCode, 200);
  });

  test('مسح التخزين (معرّف جديد) لا يكفي للتهرب: البصمة + نفس الشبكة تكشف الحساب الثاني', async () => {
    const first = makeUser(81020);
    const second = makeUser(81021);
    assert.equal((await call({ path: 'balance', user: first, ip: WIFI, headers: asDevice('phone-x', FP_A) })).statusCode, 200);
    const blocked = await call({ path: 'balance', user: second, ip: WIFI, headers: asDevice('phone-x-reset', FP_A) });
    assert.equal(blocked.statusCode, 403);
    assert.equal(blocked.body.code, 'MULTI_ACCOUNT_DEVICE');
  });

  test('بصمة متطابقة من شبكة مختلفة لا تحظر (هواتف متطابقة الطراز لأشخاص مختلفين)', async () => {
    const first = makeUser(81030);
    const second = makeUser(81031);
    assert.equal((await call({ path: 'balance', user: first, ip: WIFI, headers: asDevice('person-1', FP_B) })).statusCode, 200);
    assert.equal((await call({ path: 'balance', user: second, ip: OTHER_NET, headers: asDevice('person-2', FP_B) })).statusCode, 200);
  });

  test('الوضع الصارم: البصمة وحدها تكفي للحظر', async () => {
    process.env.DEVICE_FINGERPRINT_MODE = 'strict';
    const fp = 'c'.repeat(64);
    const first = makeUser(81040);
    const second = makeUser(81041);
    assert.equal((await call({ path: 'balance', user: first, ip: WIFI, headers: asDevice('s-1', fp) })).statusCode, 200);
    const blocked = await call({ path: 'balance', user: second, ip: OTHER_NET, headers: asDevice('s-2', fp) });
    assert.equal(blocked.statusCode, 403);
  });

  test('حذف الحساب الأول يحرّر الجهاز', async () => {
    const first = makeUser(81050);
    const second = makeUser(81051);
    await ensureUser({ ...first });
    assert.equal((await call({ path: 'balance', user: first, headers: asDevice('freed') })).statusCode, 200);
    assert.equal((await call({ path: 'balance', user: second, headers: asDevice('freed') })).statusCode, 403);
    await sqlRows(`DELETE FROM vr_users WHERE id = $1`, [first.id]);
    resetDeviceCacheForTests();
    assert.equal((await call({ path: 'balance', user: second, headers: asDevice('freed') })).statusCode, 200);
  });

  test('غياب معرّف الجهاز يُرفض بدل أن يكون طريقًا للتهرب', async () => {
    const user = makeUser(81060);
    const res = await call({ path: 'balance', user, headers: { 'x-client-device-id': 'not-a-valid-id' } });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'DEVICE_REQUIRED');
  });

  test('المدير مستثنى من الربط', async () => {
    const admin = makeUser(9001);
    assert.equal((await call({ path: 'balance', user: admin, headers: asDevice('phone-1') })).statusCode, 200);
  });

  test('DEVICE_MAX_ACCOUNTS=2 يسمح بحسابين ويمنع الثالث', async () => {
    process.env.DEVICE_MAX_ACCOUNTS = '2';
    const users = [makeUser(81070), makeUser(81071), makeUser(81072)];
    assert.equal((await call({ path: 'balance', user: users[0], headers: asDevice('family') })).statusCode, 200);
    assert.equal((await call({ path: 'balance', user: users[1], headers: asDevice('family') })).statusCode, 200);
    assert.equal((await call({ path: 'balance', user: users[2], headers: asDevice('family') })).statusCode, 403);
  });

  test('DEVICE_BINDING=off يعطّل المنع', async () => {
    process.env.DEVICE_BINDING = 'off';
    const a = makeUser(81080);
    const b = makeUser(81081);
    assert.equal((await call({ path: 'balance', user: a, headers: asDevice('off-1') })).statusCode, 200);
    assert.equal((await call({ path: 'balance', user: b, headers: asDevice('off-1') })).statusCode, 200);
  });

  test('الحساب الأقدم من الترحيل يبقى مالكًا والأحدث يُمنع', async () => {
    const older = makeUser(81090);
    const newer = makeUser(81091);
    await ensureUser(older);
    await ensureUser(newer);
    const key = 'legacy-device-key-' + 'f'.repeat(46);
    await sqlRows(
      `INSERT INTO vr_device_links (device_key, kind, user_id, first_seen_at) VALUES ($1,'id',$2, now() - interval '5 days'), ($1,'id',$3, now() - interval '1 day')`,
      [key, older.id, newer.id],
    );
    const { keyedHash } = await import('../server/security.js');
    await sqlRows(`UPDATE vr_device_links SET device_key = $2 WHERE device_key = $1`, [key, keyedHash(`device:${deviceIdFor('legacy')}`)]);
    resetDeviceCacheForTests();
    assert.equal((await call({ path: 'balance', user: older, headers: asDevice('legacy') })).statusCode, 200);
    assert.equal((await call({ path: 'balance', user: newer, headers: asDevice('legacy') })).statusCode, 403);
  });
});
