/* The Suggestions board's content rules and limits: pure, no Node APIs, so the server AND the in-browser demo board (src/demo-board.js) share them. */
export const LIMITS = { textMin: 10, textMax: 500, nameMax: 40, minFillMs: 3000, maxFillMs: 24 * 3600e3, submitsPerHour: 3, submitsPerDay: 8, votesPerHour: 40, adminFailsPerHour: 10, maxPending: 200 };
export const STATUSES = ['pending', 'approved', 'hidden'];
export const HOUR = 3600e3, DAY = 24 * HOUR;
const SPAM_WORDS = ['viagra', 'casino', 'crypto', 'bitcoin', 'forex', 'loan', 'porn', 'seo service', 'backlinks', 'whatsapp', 'telegram', 'click here', 'free money'];
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|xyz|ru|info|biz|shop|top|site|online|link|me)\b)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export class Rejection extends Error { constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; } }
const clean = (s) => String(s ?? '').normalize('NFKC').replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** text and name rules shared by the server and (as a courtesy) the form. Returns the cleaned values or throws a Rejection. */
export function validate(input) {
  const text = clean(input && input.text), name = clean(input && input.name);
  if (text.length < LIMITS.textMin) throw new Rejection('too_short', `Please write a little more (at least ${LIMITS.textMin} characters).`);
  if (text.length > LIMITS.textMax) throw new Rejection('too_long', `Please keep it under ${LIMITS.textMax} characters.`);
  if (name.length > LIMITS.nameMax) throw new Rejection('name_too_long', `A name can be up to ${LIMITS.nameMax} characters.`);
  if (EMAIL.test(text) || EMAIL.test(name)) throw new Rejection('email', 'Please leave out email addresses. This board is public.');   // before links: an address contains a domain
  if (LINK.test(text) || LINK.test(name)) throw new Rejection('links', 'Please leave out links. Describe the idea in words.');
  if (/(.)\1{9,}/.test(text)) throw new Rejection('repeats', 'That looks like a typo. Please check the text.');
  const low = text.toLowerCase();
  if (SPAM_WORDS.some((w) => low.includes(w))) throw new Rejection('spam', 'That looks like spam. If it is not, please reword it.');
  return { text, name };
}

export { clean, key };
