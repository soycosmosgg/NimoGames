const ACTIVE_VISITOR_TTL_SECONDS = 90;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.VISITORS_DB) {
    return jsonResponse({ error: 'Visitor counter is not configured.' }, 503);
  }

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return jsonResponse({ error: 'Expected an application/json request.' }, 415);
  }

  let body;
  try {
    body = await request.text();
  } catch {
    return jsonResponse({ error: 'Unable to read request body.' }, 400);
  }
  if (body.length > 256) {
    return jsonResponse({ error: 'Request body is too large.' }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  if (!payload || typeof payload.sessionId !== 'string' || !SESSION_ID_PATTERN.test(payload.sessionId)) {
    return jsonResponse({ error: 'A valid sessionId is required.' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - ACTIVE_VISITOR_TTL_SECONDS;

  try {
    await env.VISITORS_DB.prepare(
      'DELETE FROM active_visitors WHERE last_seen < ?'
    ).bind(cutoff).run();

    await env.VISITORS_DB.prepare(`
      INSERT INTO active_visitors (session_id, last_seen)
      VALUES (?, ?)
      ON CONFLICT (session_id) DO UPDATE SET last_seen = excluded.last_seen
    `).bind(payload.sessionId, now).run();

    const result = await env.VISITORS_DB.prepare(
      'SELECT COUNT(*) AS count FROM active_visitors WHERE last_seen >= ?'
    ).bind(cutoff).first();

    if (!result || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error('D1 returned an invalid active visitor count.');
    }

    return jsonResponse({ count: result.count });
  } catch (error) {
    console.error('[visitor-counter] Failed to update active sessions.', error);
    return jsonResponse({ error: 'Unable to update the visitor counter.' }, 500);
  }
}
