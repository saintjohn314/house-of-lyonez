// Review form on the thank-you page. Checkout adds a one-time review code to the
// address (#review=...), so only paying customers see the form. Reviews are posted
// to /api/reviews (netlify/functions/reviews.mjs).
(function () {
  'use strict';
  var match = /^#review=([A-Za-z0-9_-]{20,64})$/.exec(location.hash);
  var box = document.getElementById('review-box');
  var form = document.getElementById('review-form');
  if (!match || !box || !form || !window.fetch) return;

  var code = match[1];
  var status = document.getElementById('review-status');
  var button = form.querySelector('button[type="submit"]');
  box.hidden = false;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var picked = form.querySelector('input[name="rating"]:checked');
    if (!picked) { status.textContent = 'Please choose 1 to 5 stars.'; return; }
    button.disabled = true;
    status.textContent = 'Posting your review...';

    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        code: code,
        rating: Number(picked.value),
        name: document.getElementById('review-name').value,
        text: document.getElementById('review-text').value
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, status: res.status, data: data || {} };
        });
      })
      .then(function (r) {
        if (r.ok) {
          form.hidden = true;
          var done = document.createElement('p');
          done.className = 'review-done';
          done.textContent = 'Thank you! Your review is posted. It can take a minute to show up on the site.';
          box.appendChild(done);
          try { history.replaceState(null, '', location.pathname); } catch (err) {}
          return;
        }
        button.disabled = r.status === 409 || r.status === 410;
        status.textContent = r.data.error ||
          (r.status === 429 ? 'Too many tries. Please wait a minute and try again.' : 'Something went wrong. Please try again.');
      })
      .catch(function () {
        button.disabled = false;
        status.textContent = 'Could not reach the site. Check your connection and try again.';
      });
  });
})();
