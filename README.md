# Nimo Games

[![Website](https://img.shields.io/badge/Website-Play_Now-1f8f5f?style=for-the-badge)](https://nimogames.qzz.io)
[![Discord](https://img.shields.io/badge/Discord-Join_Community-5865F2?logo=discord&logoColor=white&style=for-the-badge)](https://dsc.gg/nimo)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)

Nimo Games is a browser-based game hub. Browse the game library, search by title, launch a game, and return to recently played titles from the home screen. The interface is available in Spanish and games are opened in an in-page player.

## Features

- Search the game library by title and browse the complete or recently played list.
- Launch games in the built-in player, with keyboard and controller support where the game supports it.
- Keep a recently played list in browser local storage.
- View a live clock and browser connection status.
- Access the project, Discord community, and terms of service from the site.
- Installable web app metadata and favicon assets.

Games and some artwork are provided by third-party sources. Availability, controls, and data practices may differ between games and their providers.

## Send live messages

The first visit and returning-visitor avatar greetings are randomly selected on each page load. The admin panel is available at `/admin/`; its current tool sends a live message. Visible open pages check every 30 seconds, and check immediately when made visible again. Each tab shows a message once for 10 seconds; the message remains available for up to 60 seconds so slower polling does not miss it.

1. Bind the existing D1 database to the Pages project as `VISITORS_DB` under **Settings → Functions → D1 database bindings**.
2. Run `migrations/0003_create_site_messages.sql`, `migrations/0004_create_site_analytics.sql`, `migrations/0005_create_game_analytics.sql`, `migrations/0006_create_admin_login_attempts.sql`, `migrations/0007_add_site_message_sender.sql`, `migrations/0009_create_live_abuse_events.sql`, and `migrations/0010_rename_taco_events_to_game_invites.sql` against that database. If you already ran migrations `0001` and `0002`, do not rerun them; `0003` adds the message table, `0004` adds daily traffic analytics, `0005` adds daily game-launch analytics, `0006` adds persistent admin lockouts, `0007` records the sender of each live message, `0009` enables short-lived visitor events, and `0010` renames the taco event to a game invitation.
3. Create a high-entropy secret (for example, with `python -c "import secrets; print(secrets.token_urlsafe(32))"`). In Pages project settings, add the existing administrator's key as the encrypted secret `ADMIN_SECRET` (shown as **Arb**). To add the second developer, create a different high-entropy key and add it as the encrypted secret `ADMIN_SECRET_MITICRAFT89` (shown as **Miticraft89**). Do not put these values in the repository or share them with visitors.
4. Deploy the site with Pages Functions enabled, then open `/admin/` and unlock the dashboard with either developer's key. The active developer is shown at the top right. Use **Mensajes** in the sidebar to send a message of up to 250 characters. Arb's messages keep the current left-side presentation; Miticraft89's appear on the right with their GitHub avatar. The live-message admin page briefly shows each sent notice in a chat bubble for 10 seconds; it does not keep a chat history.

The **Abuse** section can publish a 10-second visual rain of `67` or invite visitors to open a selected game. Apply migrations `0009_create_live_abuse_events.sql` and `0010_rename_taco_events_to_game_invites.sql` before deploying this feature. Events are delivered through the existing live-message poll; visitors can dismiss an invitation, and the site never changes games without their explicit choice.

The public endpoint only returns an unexpired message. Sending requires `ADMIN_SECRET` in an authorization header and a same-origin request. After three incorrect attempts from the same IP, access is blocked for five minutes; subsequent lockouts increase to 20 minutes, one hour, then double up to 24 hours. A successful authentication resets the lockout level. The dashboard remembers the secret in that browser after a successful unlock or send. Visible pages that are already open display a new message within 30 seconds, or immediately when returning to the tab.

When running the site from a plain static server locally, live messages are unavailable because Pages Functions and D1 are not available.

## Configure the live visitor counter

The header counter reports active browser sessions using a Cloudflare Pages Function and D1. Each browser tab gets a random session ID, and a session is considered active for 120 seconds after its last heartbeat. Heartbeats run every 60 seconds; daily analytics are only written when a page view occurs or a new visitor peak is reached. Game launches are queued and sent with the next heartbeat (or on page close), avoiding a separate API request for every launch. Cloudflare's approximate city and country, plus the currently open game ID, are stored per active session; raw IP addresses are not stored. The admin dashboard refreshes every 30 seconds and shows active sessions, today's peak, approximate city distribution, and games currently open with player counts and percentages of all active sessions. Historical page views after migration `0004` and game launches after migration `0005` also appear in the weekly charts. Neither metric backfills historical data.

1. Create a D1 database in the same Cloudflare account as the Pages project.
2. Run the SQL in `migrations/0001_create_active_visitors.sql`, `migrations/0004_create_site_analytics.sql`, `migrations/0005_create_game_analytics.sql`, `migrations/0006_create_admin_login_attempts.sql`, and `migrations/0008_add_live_visitor_details.sql` in the D1 Console. Apply `0008` after `0001`; if the database already has the active visitor table, run only `0008` to add city, country, and current-game fields.
3. In the Pages project settings, add a D1 database binding under **Settings → Functions → D1 database bindings** with the variable name `VISITORS_DB`, selecting the database you created.
4. Deploy the Pages project with Functions enabled. The endpoint is `/api/visitors`.

The city chart uses approximate Cloudflare location data and aggregates active sessions by city and country. It does not show or store visitor IP addresses. Live game counts are based on active browser sessions that report a game open; they update on game open/close and with the 60-second heartbeat.

Until the D1 binding and table are configured, the counter shows `—`; it does not display a fabricated number.

## Run locally

The site is static HTML, CSS, and JavaScript; there is no build step or package installation required. Serve the repository root with any static web server, then open its local URL. For example, with Python installed:

```sh
python -m http.server 8000
```

Open <http://localhost:8000>. A local web server is recommended because some browser features do not work consistently when opening `index.html` directly as a file.

## Project structure

```text
assets/
  css/main.css       Main interface styles
  js/app.js          Library, player, recents, and interface behavior
  js/games.js        Game catalog and launch URLs
  js/nimo-sdk.js     CDN selection, fallbacks, and the shared game-loading screen
admin/               Password-protected dashboard and live message tool
functions/api/       Cloudflare Pages API endpoints
migrations/          D1 database and analytics schema
favicon/             Browser, Apple, and web-app icons
games/
  <id>/              Game launch pages
index.html           Main page
tos.html             Terms of service and privacy information
robots.txt           Crawler directives and sitemap location
sitemap.xml          Public pages for search engines
```

## Update the game catalog

Edit `window.NIMO_GAMES` in `assets/js/games.js`. Each entry needs an `id` and title; artwork URLs and `playUrl` are generated from the ID. Keep optional game-specific settings such as CDN configuration or custom metadata when needed. Game pages can use `data-loading="true"` on the Nimo SDK script to enable its shared loading screen. Make sure the game ID points to an existing game page and update `sitemap.xml` when adding or removing indexable pages.

## Links

- Website: <https://nimogames.qzz.io>
- Discord: <https://dsc.gg/nimo>
- GitHub: <https://github.com/soycosmosgg/NimoGames>
- Terms of service: <https://nimogames.qzz.io/tos.html>

## License

This project is distributed under the GNU Affero General Public License v3.0. See [LICENSE](./LICENSE).
