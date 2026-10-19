import { matchesAdminSecret } from './admin-auth.js';

const ATTEMPTS_BEFORE_LOCKOUT = 3;
const LOCKOUT_DURATIONS_SECONDS = [300, 1200, 3600, 7200, 14400, 28800, 57600, 86400];

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

async function getClientId(request, secret) {
  const ipAddress = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ipAddress));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function getRetryAfter(lockedUntil, now) {
  return Math.max(1, lockedUntil - now);
}

function lockedResponse(lockedUntil, now) {
  const retryAfterSeconds = getRetryAfter(lockedUntil, now);
  return jsonResponse({
    error: 'Acceso bloqueado temporalmente. Inténtalo de nuevo más tarde.',
    retryAfterSeconds
  }, 429, { 'Retry-After': String(retryAfterSeconds) });
}

export async function authorizeAdminRequest(request, env, suppliedSecret) {
  const now = Math.floor(Date.now() / 1000);
  const clientId = await getClientId(request, env.ADMIN_SECRET);
  const attempt = await env.VISITORS_DB.prepare(`
    SELECT failed_attempts, lock_level, locked_until
    FROM admin_login_attempts
    WHERE client_id = ?
  `).bind(clientId).first();

  if (attempt && (!Number.isSafeInteger(attempt.failed_attempts) ||
      !Number.isSafeInteger(attempt.lock_level) ||
      !Number.isSafeInteger(attempt.locked_until))) {
    throw new Error('D1 returned invalid admin lockout state.');
  }
  if (attempt?.locked_until > now) {
    return {
      authorized: false,
      response: lockedResponse(attempt.locked_until, now)
    };
  }

  let identity = null;
  if (await matchesAdminSecret(suppliedSecret, env.ADMIN_SECRET)) {
    identity = 'Arb';
  } else if (env.ADMIN_SECRET_MITICRAFT89 &&
      await matchesAdminSecret(suppliedSecret, env.ADMIN_SECRET_MITICRAFT89)) {
    identity = 'Miticraft89';
  }

  if (identity) {
    if (attempt) {
      await env.VISITORS_DB.prepare(
        'DELETE FROM admin_login_attempts WHERE client_id = ? AND locked_until <= ?'
      ).bind(clientId, now).run();
    }
    return { authorized: true, identity };
  }

  const lockLevel = attempt?.lock_level || 0;
  const lockDuration = LOCKOUT_DURATIONS_SECONDS[
    Math.min(lockLevel, LOCKOUT_DURATIONS_SECONDS.length - 1)
  ];
  const updatedAttempt = await env.VISITORS_DB.prepare(`
    INSERT INTO admin_login_attempts (
      client_id, failed_attempts, lock_level, locked_until, updated_at
    )
    VALUES (?, 1, 0, 0, ?)
    ON CONFLICT (client_id) DO UPDATE SET
      failed_attempts = CASE
        WHEN admin_login_attempts.failed_attempts >= ? THEN 0
        ELSE admin_login_attempts.failed_attempts + 1
      END,
      lock_level = CASE
        WHEN admin_login_attempts.failed_attempts >= ? THEN admin_login_attempts.lock_level + 1
        ELSE admin_login_attempts.lock_level
      END,
      locked_until = CASE
        WHEN admin_login_attempts.failed_attempts >= ? THEN ? + ?
        ELSE 0
      END,
      updated_at = ?
    WHERE admin_login_attempts.locked_until <= ?
    RETURNING failed_attempts, lock_level, locked_until
  `).bind(
    clientId,
    now,
    ATTEMPTS_BEFORE_LOCKOUT - 1,
    ATTEMPTS_BEFORE_LOCKOUT - 1,
    ATTEMPTS_BEFORE_LOCKOUT - 1,
    now,
    lockDuration,
    now,
    now
  ).first();

  if (!updatedAttempt) {
    const currentAttempt = await env.VISITORS_DB.prepare(`
      SELECT locked_until
      FROM admin_login_attempts
      WHERE client_id = ?
    `).bind(clientId).first();
    if (!currentAttempt || !Number.isSafeInteger(currentAttempt.locked_until)) {
      throw new Error('D1 could not return the current admin lockout state.');
    }
    if (currentAttempt.locked_until > now) {
      return {
        authorized: false,
        response: lockedResponse(currentAttempt.locked_until, now)
      };
    }
    throw new Error('D1 did not update the admin lockout state.');
  }

  if (updatedAttempt.locked_until > now) {
    return {
      authorized: false,
      response: lockedResponse(updatedAttempt.locked_until, now)
    };
  }

  return {
    authorized: false,
    response: jsonResponse({ error: 'Invalid admin secret.' }, 401)
  };
}
