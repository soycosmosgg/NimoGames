import { matchesAdminSecret } from '../../_utils/admin-auth.js';

const ACTIVE_VISITOR_TTL_SECONDS = 90;

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
  if (authorization.length > 512 || !authorization.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Invalid admin secret.' }, 401);
  }
  if (!await matchesAdminSecret(authorization.slice('Bearer '.length), env.ADMIN_SECRET)) {
    return jsonResponse({ error: 'Invalid admin secret.' }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - ACTIVE_VISITOR_TTL_SECONDS;
  const today = new Date(now * 1000).toISOString().slice(0, 10);
  const weekStart = new Date((now - 6 * 24 * 60 * 60) * 1000).toISOString().slice(0, 10);

  try {
    await env.VISITORS_DB.prepare(
      'DELETE FROM active_visitors WHERE last_seen < ?'
    ).bind(cutoff).run();

    const [activeResult, dailyRows] = await Promise.all([
      env.VISITORS_DB.prepare(
        'SELECT COUNT(*) AS count FROM active_visitors WHERE last_seen >= ?'
      ).bind(cutoff).first(),
      env.VISITORS_DB.prepare(`
        SELECT day, page_views, peak_visitors
        FROM site_analytics_daily
        WHERE day >= ? AND day <= ?
        ORDER BY day ASC
      `).bind(weekStart, today).all()
    ]);

    if (!activeResult || !Number.isSafeInteger(activeResult.count) || activeResult.count < 0) {
      throw new Error('D1 returned an invalid active visitor count.');
    }

    const days = new Map((dailyRows.results || []).map(row => {
      if (typeof row.day !== 'string' || !Number.isSafeInteger(row.page_views) ||
          !Number.isSafeInteger(row.peak_visitors) || row.page_views < 0 || row.peak_visitors < 0) {
        throw new Error('D1 returned invalid daily analytics.');
      }
      return [row.day, { pageViews: row.page_views, peakVisitors: row.peak_visitors }];
    }));

    return jsonResponse({
      activeVisitors: activeResult.count,
      todayPeakVisitors: days.get(today)?.peakVisitors || 0,
      last7Days: Array.from({ length: 7 }, (_, index) => {
        const date = new Date((now - (6 - index) * 24 * 60 * 60) * 1000);
        const day = date.toISOString().slice(0, 10);
        return { day, pageViews: days.get(day)?.pageViews || 0 };
      })
    });
  } catch (error) {
    console.error('[admin-stats] Failed to load dashboard statistics.', error);
    return jsonResponse({ error: 'Unable to load dashboard statistics.' }, 500);
  }
}
