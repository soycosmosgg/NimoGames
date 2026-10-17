import { matchesAdminSecret } from '../_utils/admin-auth.js';

const MAX_REQUEST_LENGTH = 8192;
const MAX_MESSAGE_LENGTH = 250;
const MESSAGE_TTL_MS = 10000;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestGet({ env }) {
  if (!env.VISITORS_DB) {
    return jsonResponse({ error: 'The messages database is not configured.' }, 503);
  }

  try {
    const row = await env.VISITORS_DB.prepare(
      'SELECT message, updated_at FROM site_messages WHERE id = 1'
    ).first();
    if (!row) return jsonResponse({ message: '', updatedAt: 0 });
    if (typeof row.message !== 'string') throw new Error('The saved message has an invalid format.');
    if (row.message.length > MAX_MESSAGE_LENGTH || !Number.isSafeInteger(row.updated_at)) {
      throw new Error('The saved message has an invalid format.');
    }

    if (row.message && Date.now() - row.updated_at >= MESSAGE_TTL_MS) {
      await env.VISITORS_DB.prepare(
        'DELETE FROM site_messages WHERE id = 1 AND updated_at = ?'
      ).bind(row.updated_at).run();
      return jsonResponse({ message: '', updatedAt: 0 });
    }

    return jsonResponse({ message: row.message, updatedAt: row.updated_at });
  } catch (error) {
    console.error('[messages] Failed to read the current message.', error);
    return jsonResponse({ error: 'Unable to read the current message.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.VISITORS_DB) {
    return jsonResponse({ error: 'The messages database is not configured.' }, 503);
  }
  if (!env.ADMIN_SECRET) {
    return jsonResponse({ error: 'The messages admin secret is not configured.' }, 503);
  }
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Requests must come from this site.' }, 403);
  }

  const authorization = request.headers.get('authorization') || '';
  if (authorization.length > 512 || !authorization.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Invalid admin secret.' }, 401);
  }
  const suppliedSecret = authorization.slice('Bearer '.length);
  if (!await matchesAdminSecret(suppliedSecret, env.ADMIN_SECRET)) {
    return jsonResponse({ error: 'Invalid admin secret.' }, 401);
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonResponse({ error: 'Expected an application/json request.' }, 415);
  }
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_LENGTH) {
    return jsonResponse({ error: 'Request body is too large.' }, 413);
  }

  let body;
  try {
    body = await request.text();
  } catch {
    return jsonResponse({ error: 'Unable to read request body.' }, 400);
  }
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_LENGTH) {
    return jsonResponse({ error: 'Request body is too large.' }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  if (!payload || typeof payload.message !== 'string') {
    return jsonResponse({ error: 'A message is required.' }, 400);
  }
  const message = payload.message.trim();
  if (message.length === 0 || message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse({
      error: `The message must contain 1-${MAX_MESSAGE_LENGTH} characters.`
    }, 400);
  }

  const updatedAt = Date.now();
  try {
    await env.VISITORS_DB.prepare(`
      INSERT INTO site_messages (id, message, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        message = excluded.message,
        updated_at = excluded.updated_at
    `).bind(message, updatedAt).run();

    return jsonResponse({ message, updatedAt });
  } catch (error) {
    console.error('[messages] Failed to save the current message.', error);
    return jsonResponse({ error: 'Unable to save the current message.' }, 500);
  }
}
