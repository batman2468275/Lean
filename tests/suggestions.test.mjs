import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createService, validate, LIMITS, Rejection } from '../server/suggestions.mjs';
import { memoryAdapter, fileAdapter } from '../server/adapters/file.mjs';

let clock = 1_800_000_000_000;
const mk = (adapter = memoryAdapter()) => { let n = 0; return { adapter, svc: createService({ adapter, secret: 'test-secret', now: () => clock, newId: () => 'id' + (++n) + 'abcdefgh' }) }; };
const IP = '203.0.113.7', ctx = { ip: IP };
const good = (svc, extra = {}) => { const token = svc.formToken(); clock += LIMITS.minFillMs + 10; return { text: 'A stand that folds flat for travel', name: 'Sam', token, website: '', ...extra }; };
const fails = async (p, code) => assert.rejects(p, (e) => e instanceof Rejection && e.code === code, code);

test('validation: length, links, emails, repeats, spam words, whitespace cleanup', () => {
  assert.deepEqual(validate({ text: '  A   stand \n for travel  ', name: ' Sam ' }), { text: 'A stand for travel', name: 'Sam' });
  for (const [t, code] of [['short', 'too_short'], ['x'.repeat(501), 'too_long'], ['see https://example.com now please', 'links'], ['visit www.shop-deals.net today', 'links'], ['write me at me@mail.com about it', 'email'], ['aaaaaaaaaaaaaaaa a long idea', 'repeats'], ['buy cheap viagra for your phone', 'spam']]) {
    assert.throws(() => validate({ text: t }), (e) => e.code === code, code);
  }
  assert.throws(() => validate({ text: 'A fine idea for a stand', name: 'n'.repeat(41) }), (e) => e.code === 'name_too_long');
});

test('a good suggestion is stored as pending and is not public until approved', async () => {
  const { svc } = mk();
  assert.deepEqual(await svc.submit(good(svc), ctx), { ok: true, pending: true });
  assert.equal((await svc.list()).length, 0);
  const [s] = await svc.adminList({ status: 'pending' }); assert.equal(s.name, 'Sam');
  await svc.adminSetStatus(s.id, 'approved');
  assert.equal((await svc.list()).length, 1);
  await svc.adminSetStatus(s.id, 'hidden'); assert.equal((await svc.list()).length, 0);
});

test('public list never exposes the IP hash or status, and text is stored as plain text', async () => {
  const { svc } = mk();
  await svc.submit(good(svc, { text: '<script>alert(1)</script> idea for a stand' }), ctx);
  const [s] = await svc.adminList(); await svc.adminSetStatus(s.id, 'approved');
  const [pub] = await svc.list(); assert.deepEqual(Object.keys(pub).sort(), ['createdAt', 'id', 'name', 'text', 'voted', 'votes']);
  assert.ok(pub.text.includes('<script>'), 'stored as given; the page renders it with textContent');
});

test('honeypot: a filled hidden field looks like success but stores nothing', async () => {
  const { svc } = mk();
  assert.deepEqual(await svc.submit(good(svc, { website: 'http://spam.example' }), ctx), { ok: true, pending: true });
  assert.equal((await svc.adminList()).length, 0);
});

test('form token: too fast, missing, forged, expired are all rejected', async () => {
  const { svc } = mk();
  await fails(svc.submit({ text: 'A stand that folds flat', token: svc.formToken() }, ctx), 'too_fast');      // instant
  await fails(svc.submit({ text: 'A stand that folds flat' }, ctx), 'too_fast');                               // none
  await fails(svc.submit({ text: 'A stand that folds flat', token: `${clock - 10000}.${'0'.repeat(24)}` }, ctx), 'too_fast');   // forged age
  const old = svc.formToken(); clock += LIMITS.maxFillMs + 1000;
  await fails(svc.submit({ text: 'A stand that folds flat', token: old }, ctx), 'too_fast');                  // expired
});

test('rate limit: 3 per hour per visitor, other visitors are unaffected, the window moves on', async () => {
  const { svc } = mk();
  for (let i = 0; i < 3; i++) await svc.submit(good(svc, { text: `Idea number ${i} for a better stand` }), ctx);
  await fails(svc.submit(good(svc, { text: 'Idea number 4 for a better stand' }), ctx), 'rate');
  await svc.submit(good(svc, { text: 'Idea number 4 for a better stand' }), { ip: '198.51.100.9' });
  clock += 61 * 60e3; await svc.submit(good(svc, { text: 'Idea number 5 for a better stand' }), ctx);
});

test('daily limit applies even when the hourly one is respected', async () => {
  const { svc } = mk();
  for (let i = 0; i < LIMITS.submitsPerDay; i++) { await svc.submit(good(svc, { text: `Spaced out idea number ${i} for stand` }), ctx); clock += 61 * 60e3; }
  await fails(svc.submit(good(svc, { text: 'One more idea for the stand please' }), ctx), 'rate');
});

test('duplicates are refused (case and punctuation ignored) unless the earlier one is hidden', async () => {
  const { svc } = mk();
  await svc.submit(good(svc, { text: 'Make it fold flat!' + ' for travel' }), ctx);
  await fails(svc.submit(good(svc, { text: 'make it FOLD flat for travel' }), { ip: '198.51.100.1' }), 'duplicate');
  const [s] = await svc.adminList(); await svc.adminSetStatus(s.id, 'hidden');
  await svc.submit(good(svc, { text: 'make it FOLD flat for travel' }), { ip: '198.51.100.2' });
});

test('the pending queue is capped', async () => {
  const { svc, adapter } = mk();
  await adapter.transact(async (db) => { for (let i = 0; i < LIMITS.maxPending; i++) db.suggestions.push({ id: 'p' + i, text: 'filler ' + i, name: '', status: 'pending', votes: 0, createdAt: clock, ipHash: 'x' }); });
  await fails(svc.submit(good(svc), ctx), 'full');
});

test('votes: one per voter, only on approved ideas, counted, sorted, and the voter is never stored raw', async () => {
  const { svc, adapter } = mk();
  for (const [i, ip] of ['1', '2'].entries()) await svc.submit(good(svc, { text: `Idea ${i} that is long enough` }), { ip: '198.51.100.' + ip });
  const [a, b] = (await svc.adminList()).sort((x, y) => x.createdAt - y.createdAt);
  await fails(svc.vote(a.id, 'voter-aaaaaaaaaaaaaaaa', ctx), 'missing');                    // not approved yet
  await svc.adminSetStatus(a.id, 'approved'); await svc.adminSetStatus(b.id, 'approved');
  assert.equal((await svc.vote(b.id, 'voter-aaaaaaaaaaaaaaaa', ctx)).votes, 1);
  assert.equal((await svc.vote(b.id, 'voter-aaaaaaaaaaaaaaaa', ctx)).already, true);        // again: no change
  assert.equal((await svc.vote(b.id, 'voter-bbbbbbbbbbbbbbbb', { ip: '198.51.100.50' })).votes, 2);
  const top = await svc.list({ sort: 'top', voter: 'voter-aaaaaaaaaaaaaaaa' });
  assert.equal(top[0].id, b.id); assert.equal(top[0].voted, true); assert.equal(top[1].voted, false);
  assert.equal((await svc.list({ sort: 'new' }))[0].id, b.id);                               // b is the newer one
  await fails(svc.vote(a.id, 'short', ctx), 'voter');
  assert.ok(!JSON.stringify(adapter.snapshot()).includes('voter-aaaaaaaaaaaaaaaa'), 'voter id is hashed');
  assert.ok(!JSON.stringify(adapter.snapshot()).includes(IP), 'IP is hashed');
});

test('vote rate limit per visitor', async () => {
  const { svc } = mk(); await svc.submit(good(svc), ctx); const [s] = await svc.adminList(); await svc.adminSetStatus(s.id, 'approved');
  for (let i = 0; i < LIMITS.votesPerHour; i++) await svc.vote(s.id, 'voter-' + String(i).padStart(16, '0'), ctx);
  await fails(svc.vote(s.id, 'voter-zzzzzzzzzzzzzzzz', ctx), 'rate');
});

test('admin: wrong tokens are refused and rate-limited, the right one works, delete removes votes too', async () => {
  const { svc } = mk();
  assert.equal(await svc.adminAllowed('nope', 'secret-token', ctx), false);
  assert.equal(await svc.adminAllowed(undefined, 'secret-token', ctx), false);
  assert.equal(await svc.adminAllowed('secret-token', 'secret-token', ctx), true);
  assert.equal(await svc.adminAllowed('secret-token', undefined, ctx), false, 'no token configured means nobody gets in');
  for (let i = 0; i < LIMITS.adminFailsPerHour; i++) await svc.adminAllowed('x', 'secret-token', { ip: '9.9.9.9' });
  await fails(svc.adminAllowed('secret-token', 'secret-token', { ip: '9.9.9.9' }), 'rate');
  await svc.submit(good(svc), ctx); const [s] = await svc.adminList();
  await fails(svc.adminSetStatus(s.id, 'bogus'), 'status'); await fails(svc.adminSetStatus('nope', 'approved'), 'missing');
  await svc.adminRemove(s.id); assert.equal((await svc.adminList()).length, 0); await fails(svc.adminRemove(s.id), 'missing');
});

test('a rejected call leaves the data untouched', async () => {
  const { svc, adapter } = mk(); await svc.submit(good(svc), ctx); const before = JSON.stringify(adapter.snapshot());
  await fails(svc.submit(good(svc, { text: 'A stand that folds flat for travel' }), { ip: '198.51.100.3' }), 'duplicate');
  assert.equal(JSON.stringify(adapter.snapshot()), before);
});

test('file adapter: survives a restart, writes atomically, serialises concurrent writers, reports a corrupt file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-sugg-')), file = path.join(dir, 'nested', 'db.json');
  const a = mk(fileAdapter(file));
  await Promise.all(Array.from({ length: 8 }, (_, i) => a.svc.submit(good(a.svc, { text: `Concurrent idea number ${i} for stand` }), { ip: '198.51.100.' + i })));
  assert.equal((await a.svc.adminList()).length, 8);
  const b = mk(fileAdapter(file)); assert.equal((await b.svc.adminList()).length, 8, 'a new process reads the same file');
  assert.ok(!fs.existsSync(file + '.tmp'));
  fs.writeFileSync(file, '{not json'); await assert.rejects(mk(fileAdapter(file)).svc.adminList(), /Cannot read/);
});
