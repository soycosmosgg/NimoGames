# Nimo Games

[![Website](https://img.shields.io/badge/Website-Play_Now-1f8f5f?style=for-the-badge)](https://nimogames.qzz.io)
[![Discord](https://img.shields.io/badge/Discord-Join_Community-5865F2?logo=discord&logoColor=white&style=for-the-badge)](https://dsc.gg/nimo)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=for-the-badge)](https://www.gnu.org/licenses/agpl-3.0)

Nimo Games is a browser-based game hub. Browse the game library, search by title, launch a game, and return to recently played titles from the home screen. The interface is available in Spanish and games are opened in an in-page player.

## Features

- Search the game library by title and browse the complete or recently played list.
- Launch games in the built-in player, with keyboard and controller support where the game supports it.
- Keep a recently played list and optional profile avatar in browser local storage.
- View a live clock and browser connection status.
- Access the project, Discord community, and terms of service from the site.
- Installable web app metadata and favicon assets.

Games and some artwork are provided by third-party sources. Availability, controls, and data practices may differ between games and their providers.

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
