// House Of Lyonez checkout.
//
// Buy Now buttons link to /api/checkout?item=<painting id>. The price is looked up
// here on the server (from paintings.js), so a buyer can't change it. This creates
// the PayPal order and sends the buyer to PayPal. PayPal then sends them back to
// /api/paypal-return, which checks the order against paintings.js again before
// taking the payment, records the sale, and shows the thank-you page with a link
// for leaving a review.
//
// Until the PayPal keys are set in Netlify (see ../lib/shop.mjs), Buy Now falls
// back to the older PayPal link so the shop keeps working.

import { randomBytes, randomUUID } from 'node:crypto';
import {
  CURRENCY, SHOP_NAME, findPainting, money, paypalSettings, priceOf,
  redirect, shopStore, siteUrl, toCents,
} from '../lib/shop.mjs';

const LEGACY_PAYPAL_EMAIL = 'mmmeeezzzyyy@protonmail.com';

export const config = {
  path: ['/api/checkout', '/api/paypal-return'],
  method: ['GET'],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

export default async (req, context) => {
  const url = new URL(req.url);
  const site = siteUrl(context, url);
  try {
    if (url.pathname.replace(/\/+$/, '') === '/api/paypal-return') return await finishCheckout(url, site);
    return await startCheckout(url, site);
  } catch (err) {
    console.error('Checkout error:', err && err.message ? err.message : err);
    return redirect(site + '/checkout-problem.html');
  }
};

// Step 1: Buy Now -> create the PayPal order at the site's price -> off to PayPal.
async function startCheckout(url, site) {
  const problem = site + '/checkout-problem.html';
  const painting = findPainting(url.searchParams.get('item'));
  const amounts = painting && priceOf(painting);
  if (!painting || !amounts || painting.sold) return redirect(problem);

  const pp = paypalSettings();
  if (!pp) return redirect(legacyPayPalLink(painting, amounts, site));

  if (await shopStore().get('sale/' + painting.id)) return redirect(problem); // already sold

  const title = String(painting.title || painting.id);
  const res = await paypalApi(pp, 'POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: painting.id,
      custom_id: painting.id,
      description: (SHOP_NAME + ': ' + title + ' (original)').slice(0, 127),
      amount: {
        currency_code: CURRENCY,
        value: money(amounts.total),
        breakdown: {
          item_total: { currency_code: CURRENCY, value: money(amounts.price) },
          shipping: { currency_code: CURRENCY, value: money(amounts.shipping) },
        },
      },
      items: [{
        name: title.slice(0, 127),
        sku: painting.id,
        quantity: '1',
        category: 'PHYSICAL_GOODS',
        unit_amount: { currency_code: CURRENCY, value: money(amounts.price) },
      }],
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: SHOP_NAME,
          shipping_preference: 'GET_FROM_FILE',
          user_action: 'PAY_NOW',
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          return_url: site + '/api/paypal-return',
          cancel_url: site + '/',
        },
      },
    },
  }, randomUUID());

  const links = res.ok && res.data && Array.isArray(res.data.links) ? res.data.links : [];
  const link = links.find((l) => l && (l.rel === 'payer-action' || l.rel === 'approve'));
  if (!link || !/^https:\/\/www\.(sandbox\.)?paypal\.com\//.test(String(link.href))) {
    console.error('PayPal order not created', res.status, res.debugId, issueOf(res.data));
    return redirect(problem);
  }
  console.log('Order', res.data.id, 'created for', painting.id, money(amounts.total), pp.mode);
  return redirect(link.href);
}

// Step 2: PayPal sends the buyer back here -> check everything -> take the payment.
async function finishCheckout(url, site) {
  const problem = site + '/checkout-problem.html';
  const thanks = site + '/thanks.html';
  const orderId = url.searchParams.get('token') || '';
  if (!/^[A-Z0-9]{5,64}$/.test(orderId)) return redirect(problem);

  const pp = paypalSettings();
  if (!pp) return redirect(problem);

  const found = await paypalApi(pp, 'GET', '/v2/checkout/orders/' + orderId);
  const order = found.ok ? found.data : null;
  if (!order) {
    console.error('Order lookup failed', orderId, found.status, found.debugId, issueOf(found.data));
    return redirect(problem);
  }

  const unit = Array.isArray(order.purchase_units) ? order.purchase_units[0] : null;
  const painting = findPainting(unit && unit.reference_id);
  const amounts = painting && priceOf(painting);
  const store = shopStore();
  const saleKey = painting ? 'sale/' + painting.id : '';

  // Page refreshed after paying: show the thank-you page again (with the review link).
  if (order.status === 'COMPLETED') {
    if (!painting) return redirect(thanks);
    const sale = await recordSale(store, saleKey, painting, orderId, unit, 'COMPLETED');
    return redirect(thanks + reviewHash(sale));
  }

  // Never take money that doesn't match the site's current price.
  const amount = unit && unit.amount;
  const matches = Boolean(amounts && amount && amount.currency_code === CURRENCY && toCents(amount.value) === amounts.total);
  if (!painting || painting.sold || !matches) {
    console.error('Order does not match the site, not charging', orderId, unit && unit.reference_id, amount && amount.value);
    return redirect(problem);
  }
  if (order.status !== 'APPROVED') {
    console.error('Order not approved', orderId, order.status);
    return redirect(problem);
  }

  // Reserve the painting so two buyers can't pay for the same one at once.
  const claim = await store.setJSON(saleKey, { order: orderId, status: 'paying', at: new Date().toISOString() }, { onlyIfNew: true });
  if (!claim.modified) {
    const current = await store.get(saleKey, { type: 'json' });
    if (!current || current.order !== orderId) {
      console.error('Painting already sold or being paid for', painting.id, orderId);
      return redirect(problem);
    }
  }

  const cap = await paypalApi(pp, 'POST', '/v2/checkout/orders/' + orderId + '/capture', {}, 'capture-' + orderId);
  const capUnit = cap.data && Array.isArray(cap.data.purchase_units) ? cap.data.purchase_units[0] : null;
  const capture = capUnit && capUnit.payments && Array.isArray(capUnit.payments.captures) ? capUnit.payments.captures[0] : null;
  const why = issueOf(cap.data);

  if ((cap.ok && capture && (capture.status === 'COMPLETED' || capture.status === 'PENDING')) || why === 'ORDER_ALREADY_CAPTURED') {
    const status = capture ? capture.status : 'COMPLETED';
    console.log('Payment taken', orderId, painting.id, status, capture && capture.amount ? capture.amount.value : '');
    const sale = await recordSale(store, saleKey, painting, orderId, unit, status);
    return redirect(thanks + reviewHash(sale));
  }

  // Payment didn't go through: release the painting.
  await releaseClaim(store, saleKey, orderId);
  if (why === 'INSTRUMENT_DECLINED') return redirect(pp.checkout + encodeURIComponent(orderId)); // let them pick another card
  console.error('Payment not taken', orderId, cap.status, cap.debugId, why, capture && capture.status);
  return redirect(problem);
}

// Saves the sale (no buyer details) and a one-time review code for the buyer.
async function recordSale(store, saleKey, painting, orderId, unit, status) {
  try {
    const existing = await store.get(saleKey, { type: 'json' });
    if (existing && existing.order === orderId && existing.reviewCode) return existing;
    if (existing && existing.order !== orderId) {
      console.error('SOLD TWICE? Check PayPal before shipping', painting.id, existing.order, orderId);
      return null;
    }
    const reviewCode = randomBytes(24).toString('base64url');
    const now = new Date().toISOString();
    const sale = {
      order: orderId,
      status: status === 'PENDING' ? 'pending' : 'paid',
      painting: painting.id,
      title: String(painting.title || painting.id),
      total: unit && unit.amount ? String(unit.amount.value) : '',
      at: now,
      reviewCode,
    };
    await store.setJSON('review-pass/' + reviewCode, { order: orderId, painting: painting.id, title: sale.title, at: now });
    await store.setJSON(saleKey, sale);
    return sale;
  } catch (err) {
    console.error('Payment taken but the sale was not recorded', orderId, painting.id, err && err.message);
    return null;
  }
}

async function releaseClaim(store, saleKey, orderId) {
  try {
    const current = await store.get(saleKey, { type: 'json' });
    if (current && current.order === orderId && current.status === 'paying') await store.delete(saleKey);
  } catch (err) {
    console.error('Could not release painting', saleKey, err && err.message);
  }
}

function reviewHash(sale) {
  return sale && sale.reviewCode ? '#review=' + sale.reviewCode : '';
}

// The older PayPal link, used only until the PayPal keys are set.
function legacyPayPalLink(p, a, site) {
  const params = new URLSearchParams({
    cmd: '_xclick',
    business: LEGACY_PAYPAL_EMAIL,
    item_name: SHOP_NAME + ': ' + String(p.title || p.id) + ' (original)',
    item_number: p.id,
    amount: money(a.price),
    shipping: money(a.shipping),
    currency_code: CURRENCY,
    no_shipping: '2',
    return: site + '/thanks.html',
    cancel_return: site + '/#gallery',
  });
  return 'https://www.paypal.com/cgi-bin/webscr?' + params.toString();
}

// PayPal REST API
let cachedToken = null;

async function accessToken(pp) {
  const key = pp.mode + ':' + pp.clientId;
  if (cachedToken && cachedToken.key === key && cachedToken.expires > Date.now() + 60000) return cachedToken.value;
  const res = await fetch(pp.api + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(pp.clientId + ':' + pp.secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error('PayPal sign-in failed (HTTP ' + res.status + '). Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV.');
  const data = await res.json();
  if (!data || !data.access_token) throw new Error('PayPal sign-in returned no token');
  cachedToken = { key, value: data.access_token, expires: Date.now() + (Number(data.expires_in) || 300) * 1000 };
  return cachedToken.value;
}

async function paypalApi(pp, method, path, body, requestId) {
  const headers = {
    Authorization: 'Bearer ' + (await accessToken(pp)),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;
  const res = await fetch(pp.api + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data, debugId: res.headers.get('paypal-debug-id') };
}

function issueOf(data) {
  if (!data) return '';
  if (Array.isArray(data.details) && data.details[0] && data.details[0].issue) return String(data.details[0].issue);
  return String(data.name || '');
}
