import { authorizeAdminRequest } from '../../_utils/admin-lockout.js';

const MAX_REQUEST_LENGTH = 2048;
const GAME_IDS = new Set([
  '945360', '285900', '3527290', '2835570', '367520', '322170', '98266', '12100',
  '1388880', '103012', '758260', '302895', '9734614', '3314790', '198666', '142609',
  '5493605', '616603', '11913', '5326261', '319510', '332800', '354140', '388090',
  '871720', '8944', '7574', '796817', '1351'
]);

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
    return jsonResponse({ error: 'The admin database is not configured.' }, 503);
  }
  if (!env.ADMIN_SECRET) {
    return jsonResponse({ error: 'The admin secret is not configured.' }, 503);
  }
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Requests must come from this site.' }, 403);
  }

  const authorization = request.headers.get('authorization') || '';
  const suppliedSecret = authorization.length <= 512 && authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  let authorizationResult;
  try {
    authorizationResult = await authorizeAdminRequest(request, env, suppliedSecret);
    if (!authorizationResult.authorized) return authorizationResult.response;
  } catch (error) {
    console.error('[admin-abuse] Failed to verify admin access.', error);
    return jsonResponse({ error: 'Unable to verify admin access.' }, 500);
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

  if (!payload || !['number-rain', 'game-invite', 'jumpscare'].includes(payload.eventType)) {
    return jsonResponse({ error: 'Choose a supported event.' }, 400);
  }
  const gameId = payload.eventType === 'game-invite' ? payload.gameId : null;
  if (payload.eventType === 'game-invite' && !GAME_IDS.has(gameId)) {
    return jsonResponse({ error: 'Choose a valid game for the optional event.' }, 400);
  }

  const createdAt = Date.now();
  try {
    await env.VISITORS_DB.prepare(`
      INSERT INTO live_abuse_events (id, event_type, game_id, sender, created_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        event_type = excluded.event_type,
        game_id = excluded.game_id,
        sender = excluded.sender,
        created_at = excluded.created_at
    `).bind(payload.eventType, gameId, authorizationResult.identity, createdAt).run();

    return jsonResponse({
      eventType: payload.eventType,
      gameId,
      sender: authorizationResult.identity,
      createdAt
    });
  } catch (error) {
    console.error('[admin-abuse] Failed to publish the live event.', error);
    return jsonResponse({ error: 'Unable to publish the live event.' }, 500);
  }
}
