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

The first visit and returning-visitor avatar greetings are randomly selected on each page load. The admin panel is available at `/admin/`; its current tool sends a live message. Open pages check every three seconds, show it once per tab for 10 seconds, and do not repeat it on later visits. The message is deleted from D1 after 10 seconds.

1. Bind the existing D1 database to the Pages project as `VISITORS_DB` under **Settings → Functions → D1 database bindings**.
2. Run `migrations/0003_create_site_messages.sql`, `migrations/0004_create_site_analytics.sql`, `migrations/0005_create_game_analytics.sql`, and `migrations/0006_create_admin_login_attempts.sql` against that database. If you already ran migrations `0001` and `0002`, do not rerun them; `0003` adds the message table, `0004` adds daily traffic analytics, `0005` adds daily game-launch analytics, and `0006` adds persistent admin lockouts.
3. Create a high-entropy secret (for example, with `python -c "import secrets; print(secrets.token_urlsafe(32))"`). In Pages project settings, add it as the encrypted secret `ADMIN_SECRET`. Do not put this value in the repository or share it with visitors.
4. Deploy the site with Pages Functions enabled, then open `/admin/` and unlock the dashboard with the secret. Use **Mensajes** in the sidebar to send a message of up to 250 characters.

The public endpoint only returns an unexpired message. Sending requires `ADMIN_SECRET` in an authorization header and a same-origin request. After three incorrect attempts from the same IP, access is blocked for five minutes; subsequent lockouts increase to 20 minutes, one hour, then double up to 24 hours. A successful authentication resets the lockout level. The dashboard remembers the secret in that browser after a successful unlock or send. Pages that are already open display the message within about three seconds.

When running the site from a plain static server locally, live messages are unavailable because Pages Functions and D1 are not available.

## Configure the live visitor counter

The header counter reports active browser sessions using a Cloudflare Pages Function and D1. It does not identify people: each browser tab gets a random session ID, and a session is considered active for 120 seconds after its last heartbeat. Heartbeats run every 60 seconds; daily analytics are only written when a page view occurs or a new visitor peak is reached. Game launches are queued and sent with the next heartbeat (or on page close), avoiding a separate API request for every launch. The admin dashboard refreshes every 60 seconds and shows active sessions, the day's peak, and page loads reported by the home page after migration `0004`. It also counts game launches after migration `0005` and uses those counts for the most-opened game and weekly game-launch chart. Neither metric backfills historical data.

1. Create a D1 database in the same Cloudflare account as the Pages project.
2. Run the SQL in `migrations/0001_create_active_visitors.sql`, `migrations/0004_create_site_analytics.sql`, `migrations/0005_create_game_analytics.sql`, and `migrations/0006_create_admin_login_attempts.sql` in the D1 Console.
3. In the Pages project settings, add a D1 database binding under **Settings → Functions → D1 database bindings** with the variable name `VISITORS_DB`, selecting the database you created.
4. Deploy the Pages project with Functions enabled. The endpoint is `/api/visitors`.

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

Edit `window.NIMO_GAMES` in `assets/js/games.js`. Each entry defines a numeric `id`, title, artwork URLs, a `playUrl`, and optional metadata. Game pages can use `data-loading="true"` on the Nimo SDK script to enable its shared loading screen; CDN-backed games can also configure their base and probe attributes. Make sure the launch URL points to an existing game page and update `sitemap.xml` when adding or removing indexable pages.

## Links

- Website: <https://nimogames.qzz.io>
- Discord: <https://dsc.gg/nimo>
- GitHub: <https://github.com/soycosmosgg/NimoGames>
- Terms of service: <https://nimogames.qzz.io/tos.html>

## License

This project is distributed under the GNU Affero General Public License v3.0. See [LICENSE](./LICENSE).
