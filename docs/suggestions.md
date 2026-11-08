# Suggestions board (Phase 6)

A public board at `/suggestions`: anyone can send an idea and vote. Every idea is read by you before it appears. You moderate at `/admin/suggestions`.

**Storage today is a local JSON file, on purpose: this is a demo.** It works on one machine (`npm start`). It does NOT work on a static host (Netlify, GitHub Pages, ...): there the board shows "can't be reached" and the send button is disabled. Before launch, replace the adapter (see "Moving to a real database").

## Run it

```
npm run build && npm start
# Suggestions admin: /admin/suggestions   token: <printed here>      (a random token is made if ADMIN_TOKEN is not set)
```

## Environment variables

| Variable | Meaning | If missing |
|---|---|---|
| `ADMIN_TOKEN` | Password for `/admin/suggestions` (sent as `Authorization: Bearer ...`) | A random token is generated and printed at startup. Nobody can use the admin without one |
| `SPAM_SALT` | Secret for the visitor hashes and the signed form tokens. Keep it private and stable | A random one per start (hashes and open forms reset on restart) |
| `SUGGESTIONS_FILE` | Where the demo store lives | `data/suggestions.json` (git-ignored). `:memory:` keeps it in RAM (used by tests) |
| `TRUST_PROXY=1` | Read the visitor IP from `X-Forwarded-For`. Only behind a proxy you control | Off: the socket IP is used |

## Data shape (this is also the table design for a real database)

```
suggestions   id text PK | text (10..500) | name (<=40, optional) | status 'pending'|'approved'|'hidden' | votes int | created_at | ip_hash
votes         suggestion_id | voter_hash          UNIQUE (suggestion_id, voter_hash): one vote per browser
hits          key ('submit:<ip_hash>' | 'vote:<ip_hash>' | 'admin:<ip_hash>') | at         rate-limit events, pruned after 24 h
```

No raw IP and no raw browser id is stored: both are salted, one-way hashes. Suggestion text is stored as typed (cleaned of control characters and extra spaces) and is only ever inserted into the page with `textContent`, so it cannot run as markup.

## API (`server/api.mjs`)

```
GET    /api/suggestions?sort=top|new&voter=<id>     approved ideas + a fresh form token
POST   /api/suggestions                             { text, name?, token, website }   -> goes to the queue (status pending)
POST   /api/suggestions/<id>/vote                   { voter }
GET    /api/admin/suggestions?status=pending        Bearer ADMIN_TOKEN
PATCH  /api/admin/suggestions/<id>                  { status: approved | hidden | pending }
DELETE /api/admin/suggestions/<id>
```

## Spam control (all in `server/suggestions.mjs`, tested in `tests/suggestions.test.mjs`)

1. **Honeypot**: a hidden `website` field. Filled = fake success, nothing stored.
2. **Signed form token**: issued with the page's list, valid from 3 s to 24 h after issue. Bots that post instantly, or forge the time, are refused.
3. **Rate limits** per visitor hash: 3 ideas per hour, 8 per day, 40 votes per hour. Wrong admin tokens: 10 per hour.
4. **Content**: 10 to 500 characters, no links, no email addresses, no long runs of one character, a short spam-word list, no duplicate of an existing idea.
5. **Moderation**: nothing is public until approved. The pending queue is capped at 200.
6. Bodies over 4 KB are refused. Every response is `no-store` JSON.

This is proportionate for a small site. It will not stop a determined human with many IPs: that is what moderation is for. If bots become a problem, add a CAPTCHA (Cloudflare Turnstile is privacy-friendly) in front of `POST /api/suggestions`.

## Moving to a real database

The service only talks to an adapter with one method: `transact(async (db) => result)` reads the whole database, runs your function (which may change `db`), and writes it back atomically. `server/adapters/file.mjs` is the reference (`fileAdapter`, `memoryAdapter`).
For Supabase/Postgres: implement the same three tables above, and write the adapter so each `transact` is one transaction (or, better, rewrite the five service methods as SQL, since the whole-database read does not scale past a few thousand rows). Put the service key in an environment variable on the server only, never in the browser. A host with server functions (Vercel, Netlify, Cloudflare) also needs `server/api.mjs` mounted as a function; the static build alone cannot take submissions.
Also review: privacy page wording (`src/pages/privacy.html`, owner `[EDIT]` for retention and removal requests), backups, and who has the admin token.
