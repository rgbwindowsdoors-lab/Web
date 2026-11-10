/*
 * RGB Windows & Doors — free in-home measurement request form.
 *
 * Every <form data-quote-form> on the page is sent to Web3Forms, which emails
 * the request to the address linked to ACCESS_KEY. After a successful send the
 * visitor is taken to messageSuccess.html.
 *
 * To change the receiving email: create a new access key at web3forms.com for
 * that email and paste it below. Nothing else needs to change.
 */
(function () {
  'use strict';

  var ACCESS_KEY = '2535d0d1-4c2b-45a0-98d2-de98a2d17741';
  var ENDPOINT = 'https://api.web3forms.com/submit';
  var SUCCESS_URL = 'messageSuccess.html';
  var PHONE = '+1 647-893-2705';

  function showMessage(form, text) {
    var box = form.querySelector('.quote-form__message');
    if (!box) return;
    box.textContent = text;
    box.hidden = false;
  }

  function onSubmit(event) {
    var form = event.currentTarget;
    event.preventDefault();

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    var button = form.querySelector('[type="submit"]');
    var buttonText = button.textContent;
    var box = form.querySelector('.quote-form__message');
    if (box) box.hidden = true;

    if (!ACCESS_KEY || ACCESS_KEY.indexOf('PASTE_') === 0) {
      showMessage(form, 'Sorry, the form is not available right now. Please call us at ' + PHONE + '.');
      return;
    }

    var data = {};
    new FormData(form).forEach(function (value, key) { data[key] = value; });
    data.access_key = ACCESS_KEY;
    data.subject = 'New measurement request: ' + (data.name || '') + ', ' + (data.town || '');
    data.from_name = 'RGB Windows website';
    data.page = location.pathname;

    button.disabled = true;
    button.textContent = 'Sending...';

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (response) { return response.json(); })
      .then(function (result) {
        if (!result || !result.success) throw new Error('not sent');
        // Tell GTM a request was sent. GTM tags (GA4 / Meta Pixel) can use the
        // Custom Event "quote_form_submit"; they still follow the visitor's cookie choice.
        // Wait for GTM to finish (eventCallback), but never longer than 2 seconds.
        var done = false;
        function goToThankYou() {
          if (done) return;
          done = true;
          location.href = SUCCESS_URL;
        }
        window.dataLayer = window.dataLayer || [];
        // If GTM is not running (blocked or not loaded), nobody will call
        // eventCallback, so go to the thank-you page right away.
        if (!window.google_tag_manager) {
          window.dataLayer.push({ event: 'quote_form_submit', form_page: location.pathname, form_need: data.need || '', form_windows: data.windows || '' });
          goToThankYou();
          return;
        }
        window.dataLayer.push({
          event: 'quote_form_submit',
          form_page: location.pathname,
          form_need: data.need || '',
          form_windows: data.windows || '',
          eventCallback: goToThankYou,
          eventTimeout: 2000
        });
        setTimeout(goToThankYou, 2000);
      })
      .catch(function () {
        button.disabled = false;
        button.textContent = buttonText;
        showMessage(form, 'Sorry, your request was not sent. Please try again or call us at ' + PHONE + '.');
      });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-quote-form]');
    Array.prototype.forEach.call(forms, function (form) {
      form.setAttribute('novalidate', '');
      form.addEventListener('submit', onSubmit);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
