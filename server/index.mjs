/* Builds the Suggestions API from environment variables (used by tools/serve.cjs, i.e. `npm start`).
     ADMIN_TOKEN        the password for /admin/suggestions. If it is not set a random one is made and printed at startup (so the demo is never open).
     SPAM_SALT          secret for the visitor hashes and form tokens. If not set a random one is made (tokens and hashes then reset on every restart).
     SUGGESTIONS_FILE   where the demo JSON store lives (default data/suggestions.json)
     TRUST_PROXY=1      read the visitor IP from X-Forwarded-For (only behind a proxy you control) */
import crypto from 'node:crypto';
import path from 'node:path';
import { createService } from './suggestions.mjs';
import { createApi } from './api.mjs';
import { fileAdapter, memoryAdapter } from './adapters/file.mjs';

export function makeApi(env = process.env, { log = console.log } = {}) {
  const generated = !env.ADMIN_TOKEN;
  const adminToken = env.ADMIN_TOKEN || crypto.randomBytes(12).toString('base64url');
  const secret = env.SPAM_SALT || crypto.randomBytes(24).toString('hex');
  const adapter = env.SUGGESTIONS_FILE === ':memory:' ? memoryAdapter() : fileAdapter(path.resolve(env.SUGGESTIONS_FILE || 'data/suggestions.json'));
  if (generated) log(`Suggestions admin: /admin/suggestions   token: ${adminToken}   (set ADMIN_TOKEN to choose your own)`);
  return { handle: createApi({ service: createService({ adapter, secret }), adminToken, trustProxy: env.TRUST_PROXY === '1' }), adminToken, adapter };
}
