# Hosting Lean

`npm run build` writes a static site to `dist/`. Any static host works, but **every path must serve the app**: the 3D canvas and router are one page, and `/models`, `/customize?color=sky` and so on must load it directly (deep links, refresh, shared URLs).

**The ideas board is the one part that is not static.** `/suggestions` and `/admin/suggestions` talk to `/api/...`, which is served by `server/` (run `npm start`, see `docs/suggestions.md`). On a purely static host the board shows "can't be reached" and sending is disabled, and the demo JSON store is not suitable for production anyway. Before launch, pick a host with server functions or a database and swap the storage adapter.

What the build already does for you:

| Host | What to do |
|---|---|
| Netlify, Cloudflare Pages | Nothing: `dist/_redirects` (`/*  /index.html  200`) is included. |
| Vercel | Nothing: `dist/vercel.json` rewrites every path except `/assets/` to the app. |
| Apache | Nothing: `dist/.htaccess` rewrites unknown paths to `/index.html` (needs `mod_rewrite` and `AllowOverride`). |
| nginx | `location / { try_files $uri $uri/ /index.html; }` |
| GitHub Pages and other hosts with no rewrite rules | Each route also exists as its own file (`dist/models/index.html` ...) with the right `<title>` and description, so the pages load directly. `dist/404.html` serves unknown paths (the app then shows its own "not found" page). Old URLs like `/buy` or `/charging` need a rewrite to be redirected; without one they show the not-found page. |

Notes

- Serve over http(s). Opening `dist/index.html` from disk will not work (the router and the model fetch need a server). Locally: `npm start`.
- The site assumes it lives at the **root** of its domain. `LEAN_BASE=/sub/ npm run build` moves the asset URLs, but the routes (`/models`...) still assume the root.
- `dist/` is a build artifact (git-ignored). Build it in CI or locally before deploying.
- Per-route titles and descriptions are set in the static HTML and again by the router, so both crawlers and visitors see the right ones. The page content itself is rendered by JavaScript.
- `og:image` uses a relative path until the domain is known: set an absolute URL in `build.mjs` (see `docs/branding.md`).
