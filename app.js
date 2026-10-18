(function () {
  'use strict';

  // Anti-clickjacking: refuse to run inside another site's frame.
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none';
    try { window.top.location = window.self.location.href; } catch (e) {}
    return;
  }

  var PAYPAL_EMAIL = 'mmmeeezzzyyy@protonmail.com';
  var SITE_URL = location.origin + location.pathname.replace(/[^\/]*$/, '');
  var paintings = Array.isArray(window.PAINTINGS) ? window.PAINTINGS : [];

  // Guarantee each painting appears only once.
  var seen = Object.create(null);
  paintings = paintings.filter(function (p) {
    if (!p || !p.id || seen[p.id]) return false;
    seen[p.id] = true;
    return true;
  });

  function inCat(p, c) {
    return c === 'tactile' ? p.tactile === true : (Array.isArray(p.cats) && p.cats.indexOf(c) !== -1);
  }

  // Sort by price, most expensive first. Ties go in category order
  // (flowers, anatomy, tactile, surreal), then keep the order in paintings.js.
  var CAT_ORDER = ['flowers', 'anatomy', 'tactile', 'surreal'];
  function catRank(p) {
    for (var i = 0; i < CAT_ORDER.length; i++) if (inCat(p, CAT_ORDER[i])) return i;
    return CAT_ORDER.length;
  }
  paintings = paintings
    .map(function (p, i) { return { p: p, i: i }; })
    .sort(function (a, b) {
      return (Number(b.p.price) - Number(a.p.price)) || (catRank(a.p) - catRank(b.p)) || (a.i - b.i);
    })
    .map(function (x) { return x.p; });

  var grid = document.getElementById('grid');
  var filtersEl = document.getElementById('filters');

  // Category filter chips (in display order). Set each painting's cats / tactile in paintings.js.
  var groups = [
    { key: 'all', label: 'All', test: function () { return true; } },
    { key: 'flowers', label: 'Flowers', test: function (p) { return inCat(p, 'flowers'); } },
    { key: 'anatomy', label: 'Anatomy', test: function (p) { return inCat(p, 'anatomy'); } },
    { key: 'tactile', label: 'Tactile', test: function (p) { return inCat(p, 'tactile'); } },
    { key: 'surreal', label: 'Surreal', test: function (p) { return inCat(p, 'surreal'); } }
  ];

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text; // textContent only: nothing is ever parsed as HTML
    return node;
  }

  // Small label under the title. Canvas sizes are kept in paintings.js but not shown on the site.
  function cardNote(p) {
    var notes = [];
    if (p.tactile === true) notes.push('Tactile');
    if (p.thick) notes.push('Thick canvas');
    return notes.join(' · ');
  }

  function paypalLink(p) {
    var params = new URLSearchParams({
      cmd: '_xclick',
      business: PAYPAL_EMAIL,
      item_name: 'House Of Lyonez: ' + p.title + ' (original)',
      item_number: p.id,
      amount: Number(p.price).toFixed(2),
      shipping: Number(p.shipping).toFixed(2),
      currency_code: 'USD',
      no_shipping: '2', // require a shipping address
      return: SITE_URL + 'thanks.html',
      cancel_return: SITE_URL + '#gallery'
    });
    return 'https://www.paypal.com/cgi-bin/webscr?' + params.toString();
  }

  function card(p) {
    var art = el('article', { 'class': 'card' });
    art.dataset.id = p.id;

    var thumb = el('button', { 'class': 'thumb', type: 'button', 'aria-label': 'View ' + p.title + ' full size' });
    var img = el('img', { src: 'images/' + p.id + '.jpg', alt: p.title + ', original painting by Esmeralda', loading: 'lazy', decoding: 'async' });
    thumb.appendChild(img);
    thumb.appendChild(el('span', { 'class': 'badge' + (p.sold ? ' sold' : '') }, p.sold ? 'SOLD' : 'Original'));
    thumb.addEventListener('click', function () { openLightbox(p); });
    art.appendChild(thumb);

    var body = el('div', { 'class': 'card-body' });
    body.appendChild(el('h3', null, p.title));
    if (cardNote(p)) body.appendChild(el('p', { 'class': 'meta' }, cardNote(p)));

    var row = el('div', { 'class': 'buy-row' });
    var price = el('div', { 'class': 'price' }, '$' + p.price);
    price.appendChild(el('small', null, '+ $' + p.shipping + ' shipping'));
    row.appendChild(price);

    var buy = el('a', { 'class': 'buy', target: '_blank', rel: 'noopener noreferrer' }, p.sold ? 'Sold' : 'Buy Now');
    if (p.sold) buy.setAttribute('aria-disabled', 'true');
    else buy.href = paypalLink(p);
    row.appendChild(buy);

    body.appendChild(row);
    art.appendChild(body);
    return art;
  }

  function render(groupKey) {
    var g = groups.filter(function (x) { return x.key === groupKey; })[0] || groups[0];
    grid.replaceChildren();
    var list = paintings.filter(g.test);
    list.forEach(function (p) { grid.appendChild(card(p)); });
    if (!list.length) grid.appendChild(el('p', { 'class': 'grid-empty' }, 'No paintings in this category yet.'));
    Array.prototype.forEach.call(filtersEl.children, function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.key === g.key));
    });
  }

  groups.forEach(function (g) {
    var count = paintings.filter(g.test).length;
    var chip = el('button', { 'class': 'chip', type: 'button', 'aria-pressed': 'false' }, g.label);
    chip.dataset.key = g.key;
    chip.appendChild(el('span', { 'class': 'n' }, '(' + count + ')'));
    chip.addEventListener('click', function () { render(g.key); });
    filtersEl.appendChild(chip);
  });
  render('all');

  document.getElementById('explore-btn').textContent = 'View the Collection (' + paintings.length + ' Originals)';
  document.getElementById('year').textContent = String(new Date().getFullYear());

  // Lightbox
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lb-img');
  var lbCap = document.getElementById('lb-cap');
  function openLightbox(p) {
    lbImg.src = 'images/' + p.id + '.jpg';
    lbImg.alt = p.title;
    lbCap.textContent = p.title + ' · $' + p.price;
    lb.hidden = false;
    document.getElementById('lb-close').focus();
  }
  function closeLightbox() { lb.hidden = true; lbImg.src = ''; }
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });
})();
