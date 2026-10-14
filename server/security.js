import { createHash, createHmac, randomBytes } from 'node:crypto';
import { sql } from './db.js';
import { HttpError } from './errors.js';

const RATE_WINDOW_MS = 5_000;
const SESSION_TTL_HOURS = 24;
const NONCE_TTL_HOURS = 24;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanupAt = 0;

function readHeader(req, name) {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function securityHashSecret() {
  return process.env.SECURITY_HASH_SECRET || process.env.TELEGRAM_BOT_TOKEN || null;
}

function keyedHash(value) {
  const secret = securityHashSecret();
  if (secret) return createHmac('sha256', secret).update(value).digest('hex');
  return createHash('sha256').update(value).digest('hex');
}

function requestIp(req) {
  const direct = readHeader(req, 'x-real-ip')
    ?? readHeader(req, 'x-vercel-forwarded-for')
    ?? req.ip
    ?? readHeader(req, 'x-forwarded-for');
  if (typeof direct !== 'string') return null;
  const value = direct.split(',').at(-1)?.trim().slice(0, 128);
  return value || null;
}

function requestPath(routeKey) {
  return String(routeKey || '/').replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 160) || '/';
}

function configuredLimit(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 && value <= 500 ? value : fallback;
}

function eventKey(...parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

async function recordSecurityEvent({
  userId = null,
  eventType,
  route,
  method,
  ipHash = null,
  deviceHash = null,
  details = {},
  key,
}) {
  try {
    await sql.query(
      `INSERT INTO vr_security_events
         (event_key, user_id, event_type, request_path, method, ip_hash, device_hash, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (event_key) DO NOTHING`,
      [
        key,
        userId,
        eventType,
        route,
        method,
        ipHash,
        deviceHash,
        JSON.stringify(details),
      ],
    );
  } catch {
    // Security logging is best-effort; logging failure must not turn a valid
    // request into an outage.
  }
}

async function incrementRateLimit(identityHash, scope, windowStart) {
  const rows = await sql.query(
    `INSERT INTO vr_api_rate_limits (identity_hash, scope, window_start, request_count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (identity_hash, scope, window_start)
     DO UPDATE SET request_count = vr_api_rate_limits.request_count + 1
     RETURNING request_count`,
    [identityHash, scope, windowStart],
  );
  return Number(rows[0]?.request_count ?? 0);
}

async function applyRateLimit({ identity, userId, route, method, ipHash, deviceHash, windowStart, scope, limit }) {
  const count = await incrementRateLimit(identity, scope, windowStart);
  if (count <= limit) return;

  await recordSecurityEvent({
    userId,
    eventType: 'rate_limit_exceeded',
    route,
    method,
    ipHash,
    deviceHash,
    details: { scope, limit },
    key: eventKey('rate-limit', identity, scope, windowStart),
  });
  throw new HttpError(429, 'Too many requests. Please try again shortly.');
}

async function registerDeviceSession({ userId, deviceHash, ipHash, suppliedSessionId, route, method }) {
  const current = await sql.query(
    `SELECT session_id
     FROM vr_security_sessions
     WHERE user_id = $1 AND device_hash = $2 AND expires_at > now()
     LIMIT 1`,
    [userId, deviceHash],
  );

  let sessionId = current[0]?.session_id;
  if (sessionId) {
    if (suppliedSessionId && suppliedSessionId !== sessionId) {
      await recordSecurityEvent({
        userId,
        eventType: 'session_replaced',
        route,
        method,
        ipHash,
        deviceHash,
        details: {},
        key: eventKey('session-replaced', userId, deviceHash, suppliedSessionId),
      });
    }
    await sql.query(
      `UPDATE vr_security_sessions
       SET last_seen_at = now(),
           ip_hash = COALESCE($3, ip_hash),
           expires_at = now() + make_interval(hours => $4::int)
       WHERE user_id = $1 AND device_hash = $2`,
      [userId, deviceHash, ipHash, SESSION_TTL_HOURS],
    );
    return sessionId;
  }

  const otherAccounts = await sql.query(
    `SELECT COUNT(DISTINCT user_id)::int AS count
     FROM vr_security_sessions
     WHERE device_hash = $1
       AND user_id <> $2
       AND last_seen_at > now() - interval '30 days'`,
    [deviceHash, userId],
  );
  const linkedAccounts = Number(otherAccounts[0]?.count ?? 0);
  if (linkedAccounts > 0) {
    const day = new Date().toISOString().slice(0, 10);
    await recordSecurityEvent({
      userId,
      eventType: 'device_shared_between_accounts',
      route,
      method,
      ipHash,
      deviceHash,
      details: { otherAccounts: linkedAccounts },
      key: eventKey('shared-device', userId, deviceHash, day),
    });
  }

  const generatedSessionId = randomBytes(32).toString('hex');
  const rows = await sql.query(
    `INSERT INTO vr_security_sessions
       (session_id, user_id, device_hash, ip_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5::int))
     ON CONFLICT (user_id, device_hash)
     DO UPDATE SET
       session_id = CASE
         WHEN vr_security_sessions.expires_at <= now() THEN EXCLUDED.session_id
         ELSE vr_security_sessions.session_id
       END,
       ip_hash = COALESCE(EXCLUDED.ip_hash, vr_security_sessions.ip_hash),
       last_seen_at = now(),
       expires_at = now() + make_interval(hours => $5::int)
     RETURNING session_id`,
    [generatedSessionId, userId, deviceHash, ipHash, SESSION_TTL_HOURS],
  );
  sessionId = rows[0]?.session_id ?? generatedSessionId;

  if (suppliedSessionId && suppliedSessionId !== sessionId) {
    await recordSecurityEvent({
      userId,
      eventType: 'session_replaced',
      route,
      method,
      ipHash,
      deviceHash,
      details: {},
      key: eventKey('session-replaced', userId, deviceHash, suppliedSessionId),
    });
  }
  return sessionId;
}

async function consumeRequestNonce({ userId, nonce, route, method, ipHash, deviceHash }) {
  if (!/^[a-f0-9]{32}$/i.test(nonce ?? '')) {
    await recordSecurityEvent({
      userId,
      eventType: 'missing_or_invalid_nonce',
      route,
      method,
      ipHash,
      deviceHash,
      details: {},
      key: eventKey('invalid-nonce', userId, route, method, Math.floor(Date.now() / RATE_WINDOW_MS)),
    });
    throw new HttpError(400, 'Missing or invalid request nonce');
  }

  const rows = await sql.query(
    `INSERT INTO vr_api_request_nonces (user_id, nonce, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3::int))
     ON CONFLICT (user_id, nonce)
     DO UPDATE SET expires_at = EXCLUDED.expires_at
     WHERE vr_api_request_nonces.expires_at <= now()
     RETURNING nonce`,
    [userId, nonce.toLowerCase(), NONCE_TTL_HOURS],
  );
  if (rows.length) return;

  await recordSecurityEvent({
    userId,
    eventType: 'request_replay_blocked',
    route,
    method,
    ipHash,
    deviceHash,
    details: {},
    key: eventKey('nonce-replay', userId, nonce.toLowerCase()),
  });
  throw new HttpError(409, 'This request was already processed');
}

async function cleanupOldSecurityRecords(now) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  try {
    await sql.query(`DELETE FROM vr_api_request_nonces WHERE expires_at < now()`);
    await sql.query(`DELETE FROM vr_api_rate_limits WHERE window_start < $1`, [now - 2 * 60 * 60 * 1000]);
    await sql.query(`DELETE FROM vr_security_sessions WHERE expires_at < now() - interval '7 days'`);
    await sql.query(`DELETE FROM vr_security_events WHERE created_at < now() - interval '90 days'`);
  } catch {
    // Cleanup can retry on a later request; active protection remains enabled.
  }
}

export async function applyApiSecurity(req, res, authUser, routeKey) {
  if (!sql) return;

  const method = String(req.method ?? 'GET').toUpperCase();
  const route = requestPath(routeKey);
  const rawIp = requestIp(req);
  const ipHash = rawIp ? keyedHash(`ip:${rawIp}`) : null;
  const rawDeviceId = readHeader(req, 'x-client-device-id');
  const validDeviceId = typeof rawDeviceId === 'string' && /^[a-f0-9]{64}$/i.test(rawDeviceId);
  const deviceHash = authUser
    ? keyedHash(validDeviceId ? `device:${rawDeviceId.toLowerCase()}` : `fallback:${authUser.id}:${ipHash ?? 'no-ip'}`)
    : null;
  const userId = authUser?.id ?? null;
  const identity = userId !== null ? `user:${userId}` : ipHash ? `ip:${ipHash}` : null;
  const identityHash = identity ? keyedHash(identity) : null;
  const windowStart = Math.floor(Date.now() / RATE_WINDOW_MS) * RATE_WINDOW_MS;

  if (identityHash) {
    await applyRateLimit({
      identity: identityHash,
      userId,
      route,
      method,
      ipHash,
      deviceHash,
      windowStart,
      scope: 'all',
      limit: configuredLimit('SECURITY_REQUESTS_PER_WINDOW', 40),
    });
    if (method !== 'GET' && method !== 'HEAD') {
      await applyRateLimit({
        identity: identityHash,
        userId,
        route,
        method,
        ipHash,
        deviceHash,
        windowStart,
        scope: 'writes',
        limit: configuredLimit('SECURITY_WRITES_PER_WINDOW', 12),
      });
    }
  }

  if (userId !== null) {
    if (method !== 'GET' && method !== 'HEAD') {
      await consumeRequestNonce({
        userId,
        nonce: readHeader(req, 'x-request-nonce'),
        route,
        method,
        ipHash,
        deviceHash,
      });
    }

    const suppliedSessionId = readHeader(req, 'x-security-session-id');
    const validSessionId = typeof suppliedSessionId === 'string' && /^[a-f0-9]{64}$/i.test(suppliedSessionId);
    const sessionId = await registerDeviceSession({
      userId,
      deviceHash,
      ipHash,
      suppliedSessionId: validSessionId ? suppliedSessionId.toLowerCase() : null,
      route,
      method,
    });
    res.setHeader('x-security-session-id', sessionId);
  }

  await cleanupOldSecurityRecords(Date.now());
}
