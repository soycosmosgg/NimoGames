const MAX_REQUEST_LENGTH = 8192;
const MAX_GREETING_COUNT = 10;
const MAX_GREETING_LENGTH = 120;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function validateGreetings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const firstVisit = validateGreetingList(value.firstVisit);
  const returning = validateGreetingList(value.returning);
  if (!firstVisit || !returning) return null;

  return { firstVisit, returning };
}

function validateGreetingList(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_GREETING_COUNT) return null;

  const greetings = value.map(greeting =>
    typeof greeting === 'string' ? greeting.trim() : ''
  );
  if (greetings.some(greeting =>
    greeting.length === 0 || greeting.length > MAX_GREETING_LENGTH
  )) return null;

  return greetings;
}

async function matchesAdminSecret(suppliedSecret, configuredSecret) {
  const encoder = new TextEncoder();
  const [suppliedDigest, configuredDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(suppliedSecret)),
    crypto.subtle.digest('SHA-256', encoder.encode(configuredSecret))
  ]);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  const configuredBytes = new Uint8Array(configuredDigest);
  let difference = 0;

  for (let index = 0; index < configuredBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ configuredBytes[index];
  }

  return difference === 0;
}

export async function onRequestGet({ env }) {
  if (!env.VISITORS_DB) {
    return jsonResponse({ error: 'The greetings database is not configured.' }, 503);
  }

  try {
    const row = await env.VISITORS_DB.prepare(
      'SELECT greetings_json, updated_at FROM site_greetings WHERE id = 1'
    ).first();
    if (!row || typeof row.greetings_json !== 'string') {
      throw new Error('The greetings row has not been initialized.');
    }

    const greetings = validateGreetings(JSON.parse(row.greetings_json));
    if (!greetings || !Number.isSafeInteger(row.updated_at)) {
      throw new Error('The saved greetings have an invalid format.');
    }

    return jsonResponse({ ...greetings, updatedAt: row.updated_at });
  } catch (error) {
    console.error('[greetings] Failed to read saved greetings.', error);
    return jsonResponse({ error: 'Unable to read the saved greetings.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.VISITORS_DB) {
    return jsonResponse({ error: 'The greetings database is not configured.' }, 503);
  }
  if (!env.ADMIN_SECRET) {
    return jsonResponse({ error: 'The greetings admin secret is not configured.' }, 503);
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

  const greetings = validateGreetings(payload);
  if (!greetings) {
    return jsonResponse({
      error: `Provide 1-${MAX_GREETING_COUNT} non-empty greetings per visit type; each must be at most ${MAX_GREETING_LENGTH} characters.`
    }, 400);
  }

  const updatedAt = Date.now();
  try {
    await env.VISITORS_DB.prepare(`
      INSERT INTO site_greetings (id, greetings_json, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        greetings_json = excluded.greetings_json,
        updated_at = excluded.updated_at
    `).bind(JSON.stringify(greetings), updatedAt).run();

    return jsonResponse({ ...greetings, updatedAt });
  } catch (error) {
    console.error('[greetings] Failed to save greetings.', error);
    return jsonResponse({ error: 'Unable to save the greetings.' }, 500);
  }
}
