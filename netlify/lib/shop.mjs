// Shared helpers for the House Of Lyonez shop functions
// (checkout.mjs, reviews.mjs, shop-stats.mjs).

import { getStore } from '@netlify/blobs';
import PAINTINGS from '../../paintings.js';

export const SHOP_NAME = 'House Of Lyonez';
export const CURRENCY = 'USD';

// PayPal settings come from Netlify environment variables, never from code:
//   PAYPAL_CLIENT_ID      PayPal REST app client ID
//   PAYPAL_CLIENT_SECRET  PayPal REST app secret (mark it as a secret in Netlify)
//   PAYPAL_ENV            "live" (default) or "sandbox" for test payments
const PAYPAL = {
  live: { api: 'https://api-m.paypal.com', checkout: 'https://www.paypal.com/checkoutnow?token=' },
  sandbox: { api: 'https://api-m.sandbox.paypal.com', checkout: 'https://www.sandbox.paypal.com/checkoutnow?token=' },
};

export function paypalMode() {
  return (Netlify.env.get('PAYPAL_ENV') || '').trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
}

// Returns null until both PayPal keys are set.
export function paypalSettings() {
  const clientId = (Netlify.env.get('PAYPAL_CLIENT_ID') || '').trim();
  const secret = (Netlify.env.get('PAYPAL_CLIENT_SECRET') || '').trim();
  if (!clientId || !secret) return null;
  const mode = paypalMode();
  return { clientId, secret, mode, ...PAYPAL[mode] };
}

// Sales and reviews live in Netlify Blobs. Test (sandbox) payments use their
// own store so they never show up on the real site. Keys:
//   sale/<painting id>          the sale of that painting (it's one of a kind)
//   review-pass/<random code>   lets the buyer of one order post one review
//   review/<PayPal order id>    a posted review
// To put a painting back on sale (for example after a refund), delete its
// sale/<painting id> entry under Data & Storage > Blobs in Netlify.
export function shopStore() {
  return getStore({ name: paypalMode() === 'sandbox' ? 'shop-sandbox' : 'shop', consistency: 'strong' });
}

export function allPaintings() {
  return Array.isArray(PAINTINGS) ? PAINTINGS.filter((p) => p && typeof p.id === 'string') : [];
}

export function findPainting(id) {
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(id)) return null;
  return allPaintings().find((p) => p.id === id) || null;
}

// Prices in cents, taken only from paintings.js.
export function priceOf(p) {
  const price = Math.round(Number(p.price) * 100);
  const shipping = Math.round(Number(p.shipping || 0) * 100);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(shipping) || shipping < 0) return null;
  return { price, shipping, total: price + shipping };
}

export const money = (cents) => (cents / 100).toFixed(2);
export const toCents = (value) => Math.round(Number(value) * 100);

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
};

export function redirect(location) {
  return new Response(null, { status: 303, headers: { ...BASE_HEADERS, Location: location } });
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

// The site's own address, for links PayPal sends buyers back to.
export function siteUrl(context, url) {
  const fromNetlify = context && context.site && context.site.url;
  return String(fromNetlify || url.origin).replace(/\/+$/, '');
}
