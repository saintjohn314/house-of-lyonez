// Public shop numbers for the site: how many paintings have sold, which ones
// (so the gallery can mark them SOLD), and the reviews. No buyer details are
// stored or returned. Cached by Netlify's CDN for a minute.

import { allPaintings, json, shopStore } from '../lib/shop.mjs';

export const config = {
  path: '/api/shop-stats',
  method: ['GET'],
};

const MAX_REVIEWS = 60;

export default async () => {
  const store = shopStore();
  const [sales, reviewKeys] = await Promise.all([
    store.list({ prefix: 'sale/' }),
    store.list({ prefix: 'review/' }),
  ]);

  const soldOnline = sales.blobs
    .map((b) => b.key.slice('sale/'.length))
    .filter((id) => /^[a-z0-9-]{1,64}$/.test(id));
  const soldByHand = allPaintings().filter((p) => p.sold === true).map((p) => p.id);
  const sold = Array.from(new Set([...soldOnline, ...soldByHand]));

  const loaded = await Promise.all(
    reviewKeys.blobs.map((b) => store.get(b.key, { type: 'json' }).catch(() => null)),
  );
  const reviews = loaded
    .filter((r) => r && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5)
    .map((r) => ({
      name: String(r.name || 'Verified buyer'),
      rating: r.rating,
      text: String(r.text || ''),
      painting: String(r.painting || ''),
      date: String(r.date || '').slice(0, 10),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return json(
    {
      sales: sold.length,
      sold,
      reviewCount: reviews.length,
      averageRating: reviews.length ? Math.round((total / reviews.length) * 10) / 10 : null,
      reviews: reviews.slice(0, MAX_REVIEWS),
    },
    200,
    {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=60, stale-while-revalidate=300',
      'Netlify-Vary': 'query=v',
    },
  );
};
