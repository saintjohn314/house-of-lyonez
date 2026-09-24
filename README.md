# House Of Lyonez

Original paintings by Esmeralda — *Art for all who have a heart to perceive; vision or no vision.*

Instagram: [@houseoflyonez](https://www.instagram.com/houseoflyonez/) · [@hyperspektiv](https://www.instagram.com/hyperspektiv/)

## Editing the gallery
All paintings are listed in **`paintings.js`**. Each line is one painting:

```js
{ id: "white-rose", title: "White Rose", size: "10x20 in", thick: false, price: 120, shipping: 10, sold: false },
```

- **Rename / reprice:** change `title`, `price`, or `shipping`.
- **Mark sold:** change `sold: false` to `sold: true` (the Buy button turns off).
- **Add a painting:** upload `images/<id>.jpg`, then add a line with the same `id`.
- **Remove a painting:** delete its line.

Checkout uses PayPal "Buy Now" links to the shop's PayPal account.
Before shipping, confirm the amount paid matches the total in **`PRICE-CHECK.md`** (look up the Item number from the PayPal email).
