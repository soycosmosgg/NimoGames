import { authorizeAdminRequest } from '../../_utils/admin-lockout.js';

const ACTIVE_VISITOR_TTL_SECONDS = 120;
const GAME_IDS = new Set([
  '945360', '285900', '3527290', '2835570', '367520', '322170', '98266', '12100',
  '1388880', '319510', '332800', '354140', '388090', '871720', '758260', '302895',
  '9734614', '493632', '3314790'
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
  let adminIdentity;
  try {
    const authorizationResult = await authorizeAdminRequest(request, env, suppliedSecret);
    if (!authorizationResult.authorized) return authorizationResult.response;
    adminIdentity = authorizationResult.identity;
  } catch (error) {
    console.error('[admin-stats] Failed to verify admin access.', error);
    return jsonResponse({ error: 'Unable to verify admin access.' }, 500);
  }

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - ACTIVE_VISITOR_TTL_SECONDS;
  const today = new Date(now * 1000).toISOString().slice(0, 10);
  const weekStart = new Date((now - 6 * 24 * 60 * 60) * 1000).toISOString().slice(0, 10);

  try {
    const [activeResult, dailyRows, gameDailyRows, locationRows, activeGameRows] = await Promise.all([
      env.VISITORS_DB.prepare(
        'SELECT COUNT(*) AS count FROM active_visitors WHERE last_seen >= ?'
      ).bind(cutoff).first(),
      env.VISITORS_DB.prepare(`
        SELECT day, page_views, peak_visitors
        FROM site_analytics_daily
        WHERE day >= ? AND day <= ?
        ORDER BY day ASC
      `).bind(weekStart, today).all(),
      env.VISITORS_DB.prepare(`
        SELECT day, game_id, game_launches
        FROM game_analytics_daily
        WHERE day >= ? AND day <= ?
      `).bind(weekStart, today).all(),
      env.VISITORS_DB.prepare(`
        SELECT city, country, COUNT(*) AS count
        FROM active_visitors
        WHERE last_seen >= ?
        GROUP BY city, country
        ORDER BY count DESC, city ASC, country ASC
        LIMIT 8
      `).bind(cutoff).all(),
      env.VISITORS_DB.prepare(`
        SELECT game_id, COUNT(*) AS players
        FROM active_visitors
        WHERE last_seen >= ? AND game_id IS NOT NULL
        GROUP BY game_id
        ORDER BY players DESC, game_id ASC
      `).bind(cutoff).all()
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
    const gameLaunchesByDay = new Map();
    let popularGame = null;
    (gameDailyRows.results || []).forEach(row => {
      if (typeof row.day !== 'string' || typeof row.game_id !== 'string' ||
          !Number.isSafeInteger(row.game_launches) || row.game_launches < 0) {
        throw new Error('D1 returned invalid daily game analytics.');
      }
      gameLaunchesByDay.set(row.day, (gameLaunchesByDay.get(row.day) || 0) + row.game_launches);
      if (row.day === today && (!popularGame || row.game_launches > popularGame.gameLaunches ||
          (row.game_launches === popularGame.gameLaunches && row.game_id < popularGame.id))) {
        popularGame = { id: row.game_id, gameLaunches: row.game_launches };
      }
    });
    const locations = (locationRows.results || []).map(row => {
      if (typeof row.city !== 'string' || typeof row.country !== 'string' ||
          !Number.isSafeInteger(row.count) || row.count < 1) {
        throw new Error('D1 returned invalid visitor location data.');
      }
      return { city: row.city || 'Ubicación desconocida', country: row.country, count: row.count };
    });
    const activeGames = (activeGameRows.results || []).map(row => {
      if (typeof row.game_id !== 'string' || !GAME_IDS.has(row.game_id) ||
          !Number.isSafeInteger(row.players) || row.players < 1 || row.players > activeResult.count) {
        throw new Error('D1 returned invalid live game data.');
      }
      return {
        id: row.game_id,
        players: row.players,
        percentage: activeResult.count === 0 ? 0 : Math.round(row.players / activeResult.count * 1000) / 10
      };
    });
    const locationCount = locations.reduce((total, location) => total + location.count, 0);
    if (locationCount > activeResult.count) {
      throw new Error('D1 returned more visitor locations than active sessions.');
    }

    return jsonResponse({
      adminIdentity,
      activeVisitors: activeResult.count,
      locations,
      otherLocationsCount: activeResult.count - locationCount,
      activeGames,
      todayPeakVisitors: days.get(today)?.peakVisitors || 0,
      popularGame,
      last7Days: Array.from({ length: 7 }, (_, index) => {
        const date = new Date((now - (6 - index) * 24 * 60 * 60) * 1000);
        const day = date.toISOString().slice(0, 10);
        return { day, pageViews: days.get(day)?.pageViews || 0 };
      }),
      last7DaysGameLaunches: Array.from({ length: 7 }, (_, index) => {
        const date = new Date((now - (6 - index) * 24 * 60 * 60) * 1000);
        const day = date.toISOString().slice(0, 10);
        return { day, gameLaunches: gameLaunchesByDay.get(day) || 0 };
      })
    });
  } catch (error) {
    console.error('[admin-stats] Failed to load dashboard statistics.', error);
    return jsonResponse({ error: 'Unable to load dashboard statistics.' }, 500);
  }
}
