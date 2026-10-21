# Nimo Games — Free Online Browser Games

[![Play free online browser games on Nimo Games](https://img.shields.io/badge/Website-Play_Now-1f8f5f?style=for-the-badge)](https://nimogames.qzz.io/)
[![Discord](https://img.shields.io/badge/Discord-Join_Community-5865F2?logo=discord&logoColor=white&style=for-the-badge)](https://dsc.gg/nimo)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)

Nimo is a web platform that offers online games without ads, downloads, or interruptions, providing a smooth experience that is entirely focused on gaming. [Play free browser games on Nimo Games](https://nimogames.qzz.io/), browse the library, search by title, launch a game, and return to recently played titles from the home screen. The interface is available in Spanish and games are opened in an in-page player.

## Features

- Search the game library by title and browse the complete or recently played list.
- Launch games in the built-in player, with keyboard and controller support where the game supports it.
- Keep a recently played list in browser local storage.
- View a live clock and browser connection status.
- Configure the optional Camouflage setting to show a custom tab title and favicon while the page is in the background.
- Access the project, Discord community, and terms of service from the site.
- Installable web app metadata and favicon assets.

Games and some artwork are provided by third-party sources. Availability, controls, and data practices may differ between games and their providers. Polytrack is sandboxed in the player and receives a Content Security Policy sandbox header on Cloudflare Pages, without same-origin access.

## Send live messages

The first visit and returning-visitor avatar greetings are randomly selected on each page load. The admin panel is available at `/admin/`; its current tool sends a live message. Visible open pages check every 30 seconds, and check immediately when made visible again. Each tab shows a message once for 10 seconds; the message remains available for up to 60 seconds so slower polling does not miss it.

1. Create a new D1 database and bind it to the Pages project as `VISITORS_DB` under **Settings → Functions → D1 database bindings**.
2. For a new, empty database, run `migrations/0001_initial_schema.sql` and then `migrations/0002_visitor_device_analytics.sql` once each in the D1 Console. For an existing database that already has the initial schema, run only `0002_visitor_device_analytics.sql`. The second migration adds browser/device tracking; do not run the initial schema against an existing database, as it is not an upgrade migration.
3. Create a high-entropy secret (for example, with `python -c "import secrets; print(secrets.token_urlsafe(32))"`). In Pages project settings, add the existing administrator's key as the encrypted secret `ADMIN_SECRET` (shown as **Arb**). To add the second developer, create a different high-entropy key and add it as the encrypted secret `ADMIN_SECRET_MITICRAFT89` (shown as **Miticraft89**). Do not put these values in the repository or share them with visitors.
4. Deploy the site with Pages Functions enabled, then open `/admin/analytics.html` and unlock Analytics with either developer's key. The active developer is shown at the top right. Use **Mensajes** in the sidebar to send a message of up to 250 characters. Arb's messages keep the current left-side presentation; Miticraft89's appear on the right with their GitHub avatar. The live-message admin page briefly shows each sent notice in a chat bubble for 10 seconds; it does not keep a chat history.

The **Abuse** section can publish a 10-second visual rain of `67`, a large jumpscare that enters from the top, rests at the bottom for about 3 seconds, then exits, or invite visitors to open a selected game. The initial schema creates the table required by these events. Events are delivered through the existing live-message poll only to pages already open when the admin publishes them; newly opened pages ignore the last stored event. Visitors can dismiss an invitation, and the site never changes games without their explicit choice.

The public endpoint only returns an unexpired message. Sending requires `ADMIN_SECRET` in an authorization header and a same-origin request. After three incorrect attempts from the same IP, access is blocked for five minutes; subsequent lockouts increase to 20 minutes, one hour, then double up to 24 hours. A successful authentication resets the lockout level. Admin tools keep the session key in the current tab's session storage so it can be used when navigating between tools; it is not retained in persistent local storage. Visible pages that are already open display a new message within 30 seconds, or immediately when returning to the tab.

When running the site from a plain static server locally, live messages are unavailable because Pages Functions and D1 are not available.

## Configure the live visitor counter

The header counter reports active browser sessions using a Cloudflare Pages Function and D1. Each browser tab gets a random session ID, and a session is considered active for 120 seconds after its last heartbeat. Heartbeats run every 60 seconds; daily analytics are only written when a page view occurs or a new visitor peak is reached. Game launches are queued and sent with the next heartbeat (or on page close), avoiding a separate API request for every launch. Cloudflare's approximate city and country, plus the currently open game ID, browser category, and device category, are stored per active session; raw IP addresses and full user-agent strings are not stored. The admin Analytics section refreshes every 30 seconds and shows active sessions, today's peak, approximate city distribution, weekly browser/device page-view charts, and games currently open with anonymous per-session location, browser, and device details. Weekly charts include analytics collected after the initial schema/migration is installed; they do not backfill earlier data.

1. Create and bind a D1 database as `VISITORS_DB` as described above. For a new, empty database, run `migrations/0001_initial_schema.sql` followed by `migrations/0002_visitor_device_analytics.sql`. For an existing database, apply only `0002_visitor_device_analytics.sql`.
2. Deploy the Pages project with Functions enabled. The endpoint is `/api/visitors`.

The city chart uses approximate Cloudflare location data and aggregates active sessions by city and country. It does not show or store visitor IP addresses. Live game counts are based on active browser sessions that report a game open; they update on game open/close and with the 60-second heartbeat. Browser and device charts aggregate page views by category and do not store raw user-agent strings. Game details show anonymous active-session rows without session IDs. Weekly analytics are stored from the day the relevant schema is installed and are not backfilled from before setup.

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

- Play free online browser games: <https://nimogames.qzz.io/>
- Discord: <https://dsc.gg/nimo>
- GitHub: <https://github.com/soycosmosgg/NimoGames>
- Terms of service: <https://nimogames.qzz.io/tos.html>

## License

This project is distributed under the GNU Affero General Public License v3.0. See [LICENSE](./LICENSE).
