// Posts a review. Only paying customers can: after checkout, the thank-you page
// gets a one-time review code (see checkout.mjs), and each order can post one
// review. Reviews appear on the site right away; to remove one, delete its
// review/<order id> entry under Data & Storage > Blobs in Netlify.

import { json, shopStore } from '../lib/shop.mjs';

export const config = {
  path: '/api/reviews',
  method: ['POST'],
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

const MAX_BODY_CHARS = 5000;
const MAX_NAME = 40;
const MAX_TEXT = 800;

export default async (req) => {
  const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return json({ error: 'Please post your review from the thank-you page.' }, 415);

  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return json({ error: 'Please post your review from the thank-you page.' }, 403);

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return json({ error: 'That review is too long.' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Something went wrong. Please try again.' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'Something went wrong. Please try again.' }, 400);

  const code = typeof body.code === 'string' ? body.code : '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(code)) return json({ error: 'This review link is not valid.' }, 400);

  const rating = body.rating;
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: 'Please choose 1 to 5 stars.' }, 400);

  const name = cleanText(body.name, MAX_NAME, true) || 'Verified buyer';
  const text = cleanText(body.text, MAX_TEXT, false);

  const store = shopStore();
  const pass = await store.get('review-pass/' + code, { type: 'json' });
  if (!pass || typeof pass.order !== 'string') return json({ error: 'This review link has already been used.' }, 410);

  const review = { name, rating, text, painting: String(pass.title || ''), date: new Date().toISOString() };
  const saved = await store.setJSON('review/' + pass.order, review, { onlyIfNew: true });
  if (!saved.modified) return json({ error: 'A review for this order was already posted. Thank you!' }, 409);
  await store.delete('review-pass/' + code);
  console.log('Review posted for order', pass.order, rating + ' stars');
  return json({ ok: true });
};

// Plain text only: removes control and direction-override characters, trims,
// and caps the length. The site always shows reviews as text, never as HTML.
function cleanText(value, max, singleLine) {
  let s = typeof value === 'string' ? value.normalize('NFC') : '';
  s = Array.from(s)
    .map((ch) => (ch === String.fromCharCode(13) ? '' : ch))
    .filter((ch) => ch === String.fromCharCode(10) || !isHidden(ch.codePointAt(0)))
    .join('');
  if (singleLine) return capLength(s.split(/\s+/).join(' ').trim(), max);
  const lines = s.split(String.fromCharCode(10)).map((line) => line.trimEnd());
  const kept = [];
  for (const line of lines) {
    if (line === '' && kept.length && kept[kept.length - 1] === '') continue; // at most one blank line in a row
    kept.push(line);
  }
  return capLength(kept.join(String.fromCharCode(10)).trim(), max);
}

function capLength(s, max) {
  return Array.from(s).slice(0, max).join('').trim();
}

// Control characters, zero-width spaces, and text-direction overrides.
function isHidden(cp) {
  return cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f) ||
    cp === 0x200b || cp === 0x200c || cp === 0x200e || cp === 0x200f ||
    (cp >= 0x2028 && cp <= 0x202e) || (cp >= 0x2060 && cp <= 0x206f) || cp === 0xfeff;
}
