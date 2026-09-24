(function () {
  'use strict';

  var PAYPAL_EMAIL = 'mmmeeezzzyyy@protonmail.com';
  var paintings = Array.isArray(window.PAINTINGS) ? window.PAINTINGS : [];

  // Guarantee each painting appears only once.
  var seen = Object.create(null);
  paintings = paintings.filter(function (p) {
    if (!p || !p.id || seen[p.id]) return false;
    seen[p.id] = true;
    return true;
  });

  var grid = document.getElementById('grid');
  var filtersEl = document.getElementById('filters');

  // Size groups for the filter chips (in display order).
  var groups = [
    { key: 'all', label: 'All', test: function () { return true; } },
    { key: 'large', label: 'Large (11×14 and up)', test: function (p) { return /^(10x20|12x16|11x14|14x11)/.test(p.size); } },
    { key: 'medium', label: 'Medium (8×10 – 9×12)', test: function (p) { return /^(10x8|9x12|12x9)/.test(p.size); } },
    { key: 'small', label: 'Small (5×7)', test: function (p) { return /^5x7/.test(p.size); } },
    { key: 'mini', label: 'Mini (4×4 – 4×6)', test: function (p) { return /^4x/.test(p.size); } }
  ];

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text; // textContent only: nothing is ever parsed as HTML
    return node;
  }

  function prettySize(p) {
    return p.size.replace('x', '×') + (p.thick ? ' · thick canvas' : '');
  }

  function paypalLink(p) {
    var params = new URLSearchParams({
      cmd: '_xclick',
      business: PAYPAL_EMAIL,
      item_name: 'House Of Lyonez: ' + p.title + ' (' + p.size + ', original)',
      item_number: p.id,
      amount: Number(p.price).toFixed(2),
      shipping: Number(p.shipping).toFixed(2),
      currency_code: 'USD',
      no_shipping: '2' // require a shipping address
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
    body.appendChild(el('p', { 'class': 'meta' }, prettySize(p)));

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
    paintings.filter(g.test).forEach(function (p) { grid.appendChild(card(p)); });
    Array.prototype.forEach.call(filtersEl.children, function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.key === g.key));
    });
  }

  groups.forEach(function (g) {
    var count = paintings.filter(g.test).length;
    if (!count) return;
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
    lbCap.textContent = p.title + ' · ' + p.size.replace('x', '×') + ' · $' + p.price;
    lb.hidden = false;
    document.getElementById('lb-close').focus();
  }
  function closeLightbox() { lb.hidden = true; lbImg.src = ''; }
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });
})();
