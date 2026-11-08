/* Storage adapters for the Suggestions board (see server/suggestions.mjs for the interface).
   fileAdapter   a single JSON file. THIS IS THE DEMO STORE: fine on one machine (npm start), not for static hosting or several servers.
                 Writes are serialised in-process and atomic (write a temp file, rename it over the real one).
   memoryAdapter the same thing in memory, for tests. */
import fs from 'node:fs';
import path from 'node:path';

const empty = () => ({ suggestions: [], votes: {}, hits: [] });
const normalise = (db) => ({ suggestions: Array.isArray(db && db.suggestions) ? db.suggestions : [], votes: (db && db.votes) || {}, hits: Array.isArray(db && db.hits) ? db.hits : [] });

export function memoryAdapter(seed) {
  let db = normalise(seed || empty()), chain = Promise.resolve();
  return {
    snapshot: () => structuredClone(db),
    transact(fn) { const run = chain.then(async () => { const work = structuredClone(db); const out = await fn(work); db = work; return out; }); chain = run.catch(() => {}); return run; },   // a throw leaves the data untouched
  };
}

export function fileAdapter(file) {
  let chain = Promise.resolve();
  const read = () => { try { return normalise(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { if (e.code === 'ENOENT') return empty(); throw new Error(`Cannot read ${file}: ${e.message}. Fix or delete the file.`); } };
  const write = (db) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, file); };
  return {
    file,
    transact(fn) { const run = chain.then(async () => { const db = read(); const out = await fn(db); write(db); return out; }); chain = run.catch(() => {}); return run; },
  };
}
