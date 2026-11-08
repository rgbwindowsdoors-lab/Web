/*
 * RGB Windows & Doors — cookie consent banner and preferences.
 * Requires js/consent-init.js to be loaded earlier in <head>.
 *
 * Public API:
 *   window.rgbCookieConsent.open()   — open Cookie Settings
 *   window.rgbCookieConsent.get()    — current choice or null
 */
(function () {
  'use strict';

  var core = window.rgbConsentCore;
  if (!core) return;

  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 12 months, then the visitor is asked again
  var PRIVACY_URL = 'privacy-policy.html';

  // Cookies that analytics / marketing tags may set on this domain.
  var ANALYTICS_COOKIES = [/^_ga$/, /^_ga_/, /^_gid$/, /^_gat/];
  var MARKETING_COOKIES = [/^_fbp$/, /^_fbc$/, /^_gcl_/];

  var current = core.read();
  var banner, modal, lastFocus;

  /* ---------- storage ---------- */

  function saveChoice(analytics, marketing) {
    var data = {
      v: core.CONSENT_VERSION,
      analytics: !!analytics,
      marketing: !!marketing,
      ts: new Date().toISOString()
    };
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = core.COOKIE_NAME + '=' + encodeURIComponent(JSON.stringify(data)) +
      '; Max-Age=' + COOKIE_MAX_AGE + '; Path=/; SameSite=Lax' + secure;
    return data;
  }

  function deleteCookiesMatching(patterns) {
    var names = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); });
    var host = location.hostname;
    var parts = host.split('.');
    var domains = ['', host];
    for (var i = 1; i < parts.length - 1; i++) {
      domains.push('.' + parts.slice(i).join('.'));
    }
    names.forEach(function (name) {
      var hit = patterns.some(function (re) { return re.test(name); });
      if (!hit) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; Max-Age=0; Path=/' + (d ? '; Domain=' + d : '');
      });
    });
  }

  /* ---------- applying a choice ---------- */

  function applyChoice(analytics, marketing) {
    var previous = current;
    current = saveChoice(analytics, marketing);

    window.gtag('consent', 'update', core.toConsentModeState(current));
    window.dataLayer.push({
      event: 'cookie_consent_update',
      consent_analytics: current.analytics ? 'granted' : 'denied',
      consent_marketing: current.marketing ? 'granted' : 'denied',
      consent_source: 'banner'
    });

    hideBanner();
    closeModal();

    // Withdrawal: if a category that was allowed is now refused, remove its
    // first-party cookies and reload so tags that already ran stop running.
    var withdrewAnalytics = previous && previous.analytics && !current.analytics;
    var withdrewMarketing = previous && previous.marketing && !current.marketing;
    if (withdrewAnalytics) deleteCookiesMatching(ANALYTICS_COOKIES);
    if (withdrewMarketing) deleteCookiesMatching(MARKETING_COOKIES);
    if (withdrewAnalytics || withdrewMarketing) {
      setTimeout(function () { location.reload(); }, 150);
    }
  }

  /* ---------- UI ---------- */

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (html != null) node.innerHTML = html;
    return node;
  }

  function buildBanner() {
    banner = el('div', {
      'class': 'rgbcc-banner',
      role: 'region',
      'aria-label': 'Cookie consent'
    },
      '<div class="rgbcc-banner__inner">' +
        '<div class="rgbcc-banner__text">' +
          '<p class="rgbcc-title" id="rgbcc-banner-title">We value your privacy</p>' +
          '<p>We use necessary cookies to make this site work. With your permission, we would also like to use ' +
          '<strong>analytics</strong> cookies (Google Analytics) to understand how the site is used, and ' +
          '<strong>marketing</strong> cookies (Meta Pixel) to measure our ads. Optional cookies stay off unless you turn them on. ' +
          'You can change your choice at any time in Cookie Settings. ' +
          '<a href="' + PRIVACY_URL + '">Privacy Policy</a></p>' +
        '</div>' +
        '<div class="rgbcc-actions">' +
          '<button type="button" class="rgbcc-btn rgbcc-btn--solid" data-rgbcc="accept">Accept All</button>' +
          '<button type="button" class="rgbcc-btn rgbcc-btn--solid" data-rgbcc="reject">Reject Optional</button>' +
          '<button type="button" class="rgbcc-btn rgbcc-btn--outline" data-rgbcc="customize">Customize</button>' +
        '</div>' +
      '</div>');
    document.body.appendChild(banner);
  }

  function toggleRow(id, title, desc, opts) {
    var checked = opts.checked ? ' checked' : '';
    var disabled = opts.locked ? ' disabled' : '';
    return '<div class="rgbcc-cat">' +
      '<div class="rgbcc-cat__head">' +
        '<label class="rgbcc-cat__label" for="' + id + '">' + title + '</label>' +
        (opts.locked
          ? '<span class="rgbcc-always">Always on</span>' +
            '<input type="checkbox" id="' + id + '" class="rgbcc-visually-hidden" checked disabled>'
          : '<span class="rgbcc-switch"><input type="checkbox" id="' + id + '"' + checked + disabled +
            ' role="switch"><span class="rgbcc-switch__track" aria-hidden="true"></span></span>') +
      '</div>' +
      '<p class="rgbcc-cat__desc">' + desc + '</p>' +
    '</div>';
  }

  function buildModal() {
    modal = el('div', { 'class': 'rgbcc-overlay', hidden: '' },
      '<div class="rgbcc-modal" role="dialog" aria-modal="true" aria-labelledby="rgbcc-modal-title">' +
        '<div class="rgbcc-modal__head">' +
          '<p class="rgbcc-title" id="rgbcc-modal-title">Cookie Settings</p>' +
          '<button type="button" class="rgbcc-close" data-rgbcc="close" aria-label="Close cookie settings">&times;</button>' +
        '</div>' +
        '<div class="rgbcc-modal__body">' +
          '<p>Choose which optional cookies we may use. Your choice is saved in a cookie on this device for 12 months. ' +
          'You can change it at any time. <a href="' + PRIVACY_URL + '">Privacy Policy</a></p>' +
          toggleRow('rgbcc-necessary', 'Necessary',
            'Required for the site to work and to remember your cookie choice. These cannot be turned off.',
            { locked: true }) +
          toggleRow('rgbcc-analytics', 'Analytics',
            'Google Analytics helps us understand how visitors use the site, for example which pages are viewed. Off unless you turn it on.',
            { checked: false }) +
          toggleRow('rgbcc-marketing', 'Marketing',
            'Meta Pixel helps us measure the results of our Facebook and Instagram ads. Off unless you turn it on.',
            { checked: false }) +
        '</div>' +
        '<div class="rgbcc-actions rgbcc-actions--modal">' +
          '<button type="button" class="rgbcc-btn rgbcc-btn--outline" data-rgbcc="save">Save My Choices</button>' +
          '<button type="button" class="rgbcc-btn rgbcc-btn--solid" data-rgbcc="reject">Reject Optional</button>' +
          '<button type="button" class="rgbcc-btn rgbcc-btn--solid" data-rgbcc="accept">Accept All</button>' +
        '</div>' +
      '</div>');
    document.body.appendChild(modal);
  }

  // Size the banner to the visible screen width (some pages are slightly wider than the phone screen).
  function fitBanner() {
    if (!banner) return;
    var w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    banner.style.setProperty('--rgbcc-vw', Math.round(w) + 'px');
    if (modal) modal.style.setProperty('--rgbcc-vw', Math.round(w) + 'px');
  }

  function showBanner() { if (banner) { fitBanner(); banner.hidden = false; } }
  function hideBanner() { if (banner) banner.hidden = true; }

  function focusables() {
    return Array.prototype.slice.call(
      modal.querySelectorAll('button, a[href], input:not([disabled])')
    );
  }

  function openModal() {
    lastFocus = document.activeElement;
    modal.querySelector('#rgbcc-analytics').checked = !!(current && current.analytics);
    modal.querySelector('#rgbcc-marketing').checked = !!(current && current.marketing);
    fitBanner();
    modal.hidden = false;
    document.documentElement.classList.add('rgbcc-lock');
    var f = focusables();
    if (f.length) f[0].focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove('rgbcc-lock');
    if (!current) showBanner();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onClick(e) {
    var btn = e.target.closest ? e.target.closest('[data-rgbcc]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-rgbcc');
    if (action === 'accept') applyChoice(true, true);
    else if (action === 'reject') applyChoice(false, false);
    else if (action === 'customize' || action === 'settings') { hideBanner(); openModal(); }
    else if (action === 'close') closeModal();
    else if (action === 'save') {
      applyChoice(
        modal.querySelector('#rgbcc-analytics').checked,
        modal.querySelector('#rgbcc-marketing').checked
      );
    }
  }

  function onKeydown(e) {
    if (!modal || modal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') {
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function addSettingsLink() {
    var target = document.querySelector('.footer .copyright p') || document.querySelector('.copyright');
    var link = el('button', { type: 'button', 'class': 'rgbcc-settings-link', 'data-rgbcc': 'settings' }, 'Cookie Settings');
    if (target) {
      var wrap = el('span', { 'class': 'rgbcc-settings-wrap' });
      wrap.appendChild(document.createTextNode(' · '));
      wrap.appendChild(link);
      target.appendChild(wrap);
    } else {
      link.classList.add('rgbcc-settings-link--floating');
      document.body.appendChild(link);
    }
  }

  function init() {
    buildBanner();
    buildModal();
    addSettingsLink();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    if (current) hideBanner(); else showBanner();
    window.addEventListener('resize', fitBanner);
  }

  window.rgbCookieConsent = {
    open: function () { hideBanner(); openModal(); },
    get: function () { return current; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
