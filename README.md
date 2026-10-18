# House Of Lyonez

Original paintings by Esmeralda — *Art for all who have a heart to perceive; vision or no vision.*

Instagram: [@houseoflyonez](https://www.instagram.com/houseoflyonez/) · [@hyperspektiv](https://www.instagram.com/hyperspektiv/)

## Editing the gallery
All paintings are listed in **`paintings.js`**. Each line is one painting:

```js
{ id: "white-rose", title: "White Rose", size: "10x20 in", thick: false, tactile: true, cats: ["flowers"], price: 100, shipping: 10, sold: false },
```

- **Rename / reprice:** change `title`, `price`, or `shipping`.
- **Categories:** `cats` can include `"flowers"`, `"anatomy"` and `"surreal"`. `tactile: true` adds the Tactile label and filter.
- **Mark sold:** change `sold: false` to `sold: true`. Paintings bought through the site are marked sold automatically.
- **Add a painting:** upload `images/<id>.jpg`, then add a line with the same `id`.
- **Remove a painting:** delete its line.

## Checkout
Buy Now goes to `/api/checkout` (`netlify/functions/checkout.mjs`). It looks up the price in `paintings.js` on the server, creates the PayPal order, and sends the buyer to PayPal. When they come back, the order is checked again before the payment is taken, so buyers can't change the price.

PayPal keys live in Netlify (**Project configuration > Environment variables**), never in this repo:

| Variable | Value |
|---|---|
| `PAYPAL_CLIENT_ID` | Client ID of the PayPal REST app |
| `PAYPAL_CLIENT_SECRET` | Secret of the PayPal REST app (mark it as a secret) |
| `PAYPAL_ENV` | `live` (default) or `sandbox` for test payments |

After changing them, redeploy (**Deploys > Trigger deploy**). Until both keys are set, Buy Now uses the older PayPal link.

## Sales counter and reviews
- Each sale is saved in Netlify Blobs (**Data & Storage > Blobs**, store `shop`), with no buyer details. The number at the bottom of the site counts paintings sold online plus any marked `sold: true`.
- After paying, the buyer's thank-you page has a one-time form to leave a 1 to 5 star review. Reviews appear at the bottom of the site within a minute.
- To remove a review, delete its `review/<order id>` entry in the `shop` store.
- To put a painting back on sale (for example after a refund), delete its `sale/<painting id>` entry.
- Test payments (`PAYPAL_ENV` = `sandbox`) use a separate `shop-sandbox` store, so they never show on the real site.

Before shipping, confirm the amount paid matches the total in **`PRICE-CHECK.md`** (look up the Item number from the PayPal email).
