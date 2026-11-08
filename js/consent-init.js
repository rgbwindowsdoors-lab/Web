/*
 * RGB Windows & Doors — consent initialisation.
 *
 * Load this file synchronously in <head>, BEFORE the Google Tag Manager snippet.
 * It sets Google Consent Mode v2 defaults to "denied" and, if the visitor
 * already made a choice on an earlier visit, immediately re-applies it.
 *
 * GTM receives a dataLayer event "cookie_consent_update" with:
 *   consent_analytics: "granted" | "denied"
 *   consent_marketing: "granted" | "denied"
 *   consent_source:    "stored" (earlier choice) | "banner" (choice made on this page)
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'rgb_consent';
  var CONSENT_VERSION = 1;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function readStoredConsent() {
    try {
      var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE_NAME + '=([^;]+)'));
      if (!match) return null;
      var data = JSON.parse(decodeURIComponent(match[1]));
      if (!data || data.v !== CONSENT_VERSION) return null;
      return {
        v: data.v,
        analytics: data.analytics === true,
        marketing: data.marketing === true,
        ts: data.ts || null
      };
    } catch (e) {
      return null;
    }
  }

  function toConsentModeState(choice) {
    var analytics = choice && choice.analytics ? 'granted' : 'denied';
    var marketing = choice && choice.marketing ? 'granted' : 'denied';
    return {
      analytics_storage: analytics,
      ad_storage: marketing,
      ad_user_data: marketing,
      ad_personalization: marketing
    };
  }

  // 1. Defaults: everything optional is denied until the visitor decides.
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500
  });
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', 'url_passthrough', false);

  // 2. Re-apply an earlier choice, if there is one.
  var stored = readStoredConsent();
  if (stored) {
    window.gtag('consent', 'update', toConsentModeState(stored));
    window.dataLayer.push({
      event: 'cookie_consent_update',
      consent_analytics: stored.analytics ? 'granted' : 'denied',
      consent_marketing: stored.marketing ? 'granted' : 'denied',
      consent_source: 'stored'
    });
  }

  // Shared helpers for js/cookie-consent.js
  window.rgbConsentCore = {
    COOKIE_NAME: COOKIE_NAME,
    CONSENT_VERSION: CONSENT_VERSION,
    read: readStoredConsent,
    toConsentModeState: toConsentModeState,
    initial: stored
  };
})();
