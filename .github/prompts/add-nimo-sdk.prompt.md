---
name: "nimosdk"
description: "Add or configure the Nimo SDK in the selected game. Use when integrating the Nimo SDK into a game."
argument-hint: "Selected game and, if it has no <base href>, its GitHub repository URL"
agent: "agent"
---

Integrate the Nimo SDK into the HTML of the selected or mentioned game. Make the change directly and limit the scope to that game.

1. Locate the game's `index.html` and inspect its `<head>`, loader, and asset paths.
2. Look for a `<base href>`:
   - If present, use it to identify the GitHub `owner/repo` and, when determinable, the branch/tag and subpath. Recognize GitHub, GitHub Pages, and jsDelivr URLs.
   - If absent, use a GitHub URL provided in the user's message. If none was provided, ask for the repository URL and stop without editing files.
   - Do not guess the repository, ref, subpath, or assets. If the `<base href>` does not identify the repository with confidence, ask for its GitHub URL and stop.
3. Follow the project pattern: load `/assets/js/nimo-sdk.js` exactly once in the `<head>`, with `data-game-id` matching the numeric game-folder name and `data-base` set to the correct CDN root (`https://cdn.jsdelivr.net/gh/{owner}/{repo}@{ref}/{path}/`). Preserve only a verifiable ref and subpath; do not duplicate or alter an already correctly configured SDK.
4. Add `data-probe` only after confirming that the specified resource exists under `data-base`; the project requires both `data-base` and `data-probe` to generate the catalog's CDN configuration. Preserve any other existing SDK attributes.
5. Do not rewrite the loader or change game logic. Check that relative asset paths still work with the `<base>` and that the SDK tag comes before scripts that depend on `window.NIMO_CDN_BASE`.
6. Add SEO metadata in the game's `<head>`: set the document title to `{Game Name} | Nimo Games` and add one concise, unique `<meta name="description">` (about 120–160 characters) describing the real game and that it can be played on Nimo Games. Do not invent features or duplicate existing description tags; update them in place.
7. Validate the HTML, SEO metadata, and configured paths using available checks. Report the changed file and the repository/ref/base and probe used; mention any validation you could not run.
