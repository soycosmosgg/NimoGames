const ACTIVE_VISITOR_TTL_SECONDS = 120;
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GAME_IDS = new Set([
  '945360', '285900', '3527290', '2835570', '367520', '322170', '98266', '12100',
  '1388880', '103012', '319510', '332800', '354140', '388090', '871720', '758260', '302895',
  '9734614', '493632', '3314790', '198666', '142609', '5493605', '616603', '11913',
  '5326261', '8944', '7574', '796817', '1351', '1307', '1358', '5255287', '628348', '023978'
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

function getBrowser(userAgent) {
  if (/bot|crawler|spider/i.test(userAgent)) return 'Bot';
  if (/Edg(?:e|A|iOS)?\//i.test(userAgent)) return 'Edge';
  if (/OPR\//i.test(userAgent)) return 'Opera';
  if (/SamsungBrowser\//i.test(userAgent)) return 'Samsung Internet';
  if (/FxiOS\/|Firefox\//i.test(userAgent)) return 'Firefox';
  if (/CriOS\/|Chrome\//i.test(userAgent)) return 'Chrome';
  if (/Chromium\//i.test(userAgent)) return 'Chromium';
  if (/Safari\//i.test(userAgent)) return 'Safari';
  return 'Other';
}

function getDevice(userAgent) {
  if (/bot|crawler|spider/i.test(userAgent)) return 'Bot';
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(userAgent)) return 'Tablet';
  if (/Mobile|Android|iPhone|iPod|IEMobile|Windows Phone/i.test(userAgent)) return 'Mobile';
  if (userAgent) return 'Desktop';
  return 'Unknown';
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
  if (body.length > 2048) {
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
  if (payload.pageView !== undefined && typeof payload.pageView !== 'boolean') {
    return jsonResponse({ error: 'pageView must be a boolean.' }, 400);
  }

  const gameId = payload.gameId === undefined ? null : payload.gameId;
  if (gameId !== null && (typeof gameId !== 'string' || !GAME_IDS.has(gameId))) {
    return jsonResponse({ error: 'gameId must be a valid game ID or null.' }, 400);
  }

  const gameLaunches = payload.gameLaunches === undefined ? {} : payload.gameLaunches;
  if (!gameLaunches || typeof gameLaunches !== 'object' || Array.isArray(gameLaunches)) {
    return jsonResponse({ error: 'gameLaunches must be an object.' }, 400);
  }
  const launchEntries = Object.entries(gameLaunches);
  if (launchEntries.length > GAME_IDS.size || launchEntries.some(([gameId, count]) =>
    !GAME_IDS.has(gameId) || !Number.isSafeInteger(count) || count < 1 || count > 1000
  )) {
    return jsonResponse({ error: 'gameLaunches contains invalid entries.' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - ACTIVE_VISITOR_TTL_SECONDS;
  const today = new Date(now * 1000).toISOString().slice(0, 10);
  const city = typeof request.cf?.city === 'string' ? request.cf.city.trim().slice(0, 100) : '';
  const country = typeof request.cf?.country === 'string' && /^[A-Za-z]{2}$/.test(request.cf.country)
    ? request.cf.country.toUpperCase()
    : '';
  const userAgent = request.headers.get('user-agent') || '';
  const browser = getBrowser(userAgent);
  const device = getDevice(userAgent);

  try {
    if (payload.pageView === true) {
      await env.VISITORS_DB.prepare(
        'DELETE FROM active_visitors WHERE last_seen < ?'
      ).bind(cutoff).run();
    }

    await env.VISITORS_DB.prepare(`
      INSERT INTO active_visitors (session_id, last_seen, city, country, game_id, browser, device)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (session_id) DO UPDATE SET
        last_seen = excluded.last_seen,
        city = excluded.city,
        country = excluded.country,
        game_id = excluded.game_id,
        browser = excluded.browser,
        device = excluded.device
    `).bind(payload.sessionId, now, city, country, gameId, browser, device).run();

    const result = await env.VISITORS_DB.prepare(
      'SELECT COUNT(*) AS count FROM active_visitors WHERE last_seen >= ?'
    ).bind(cutoff).first();

    if (!result || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error('D1 returned an invalid active visitor count.');
    }

    await env.VISITORS_DB.prepare(`
      INSERT INTO site_analytics_daily (day, page_views, peak_visitors)
      VALUES (?, ?, ?)
      ON CONFLICT (day) DO UPDATE SET
        page_views = page_views + excluded.page_views,
        peak_visitors = MAX(peak_visitors, excluded.peak_visitors)
      WHERE excluded.page_views > 0 OR excluded.peak_visitors > peak_visitors
    `).bind(today, payload.pageView === true ? 1 : 0, result.count).run();

    if (payload.pageView === true) {
      await env.VISITORS_DB.prepare(`
        INSERT INTO visitor_analytics_daily (day, dimension, value, page_views)
        VALUES (?, 'browser', ?, 1), (?, 'device', ?, 1)
        ON CONFLICT (day, dimension, value) DO UPDATE SET
          page_views = page_views + excluded.page_views
      `).bind(today, browser, today, device).run();
    }

    if (launchEntries.length > 0) {
      const values = launchEntries.map(() => '(?, ?, ?)').join(', ');
      const bindings = launchEntries.flatMap(([gameId, count]) => [today, gameId, count]);
      await env.VISITORS_DB.prepare(`
        INSERT INTO game_analytics_daily (day, game_id, game_launches)
        VALUES ${values}
        ON CONFLICT (day, game_id) DO UPDATE SET
          game_launches = game_launches + excluded.game_launches
      `).bind(...bindings).run();
    }

    return jsonResponse({ count: result.count });
  } catch (error) {
    console.error('[visitor-counter] Failed to update active sessions.', error);
    return jsonResponse({ error: 'Unable to update the visitor counter.' }, 500);
  }
}
