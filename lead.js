// Lead capture: the contact form, campaign attribution and the mobile call to action.
// Its own file, loaded with defer on every page that has the form, so nothing in script.js (the services tabs,
// the investigation simulation, the graph) can take the form down with it. No dependencies, no third parties.
//
// Where submissions go:
//   form[data-endpoint] set   -> POSTed as JSON to that URL.
//   form[data-endpoint] empty -> falls back to opening the visitor's email app with their details filled in,
//                                and says so plainly. The destination is the form's data-endpoint attribute.
// Analytics hooks: `occam:cta` fires on every [data-lead-cta] click, `occam:lead` when a submission reaches the
// endpoint, and `occam:lead-fallback` when the visitor was handed to their email app instead (nothing sent yet).
(() => {
  'use strict';

  const ATTR_KEY = 'occam.attribution';
  const TRACKED = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'msclkid'];
  const fire = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

  // ---- first-touch attribution, kept in sessionStorage only (no cookies) -------------------------------------
  // First touch wins, except that a visit with no campaign tags never blocks a later one that has them
  // (someone who wandered in directly and then clicked an ad should still be attributed to the ad).
  const hasCampaign = (record) => TRACKED.some((key) => record && record[key]);
  const readAttribution = () => {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(ATTR_KEY) || 'null'); } catch (_) { /* storage blocked */ }
    const params = new URLSearchParams(location.search);
    const found = { landing: location.pathname, referrer: document.referrer || '' };
    TRACKED.forEach((key) => { if (params.get(key)) found[key] = params.get(key).slice(0, 200); });
    if (stored && !(hasCampaign(found) && !hasCampaign(stored))) return stored;
    try { sessionStorage.setItem(ATTR_KEY, JSON.stringify(found)); } catch (_) { /* ignore */ }
    return found;
  };
  const attribution = readAttribution();

  // ---- call-to-action clicks (works on every page, with or without the form) ----------------------------------
  document.addEventListener('click', (event) => {
    const cta = event.target.closest('[data-lead-cta]');
    if (cta) fire('occam:cta', { name: cta.dataset.leadCta, href: cta.getAttribute('href') });
  });

  // ---- mobile sticky call to action: after the hero, until the contact section is on screen -------------------
  const sticky = document.querySelector('.sticky-cta');
  const hero = document.querySelector('.hero');
  const contact = document.getElementById('contact') || document.getElementById('lead-card');
  const pageFooter = document.querySelector('.site-footer');
  if (sticky && hero && contact && 'IntersectionObserver' in window) {
    const seen = { hero: true, contact: false, footer: false };
    const update = () => sticky.classList.toggle('is-visible', !seen.hero && !seen.contact && !seen.footer);
    sticky.hidden = false;
    const watch = (el, key, threshold) => new IntersectionObserver(([entry]) => { seen[key] = entry.isIntersecting; update(); }, { threshold }).observe(el);
    watch(hero, 'hero', 0.05);
    watch(contact, 'contact', 0.15);
    if (pageFooter) watch(pageFooter, 'footer', 0.05);
  }

  // ---- open every FAQ answer when printing ---------------------------------------------------------------------
  window.addEventListener('beforeprint', () => document.querySelectorAll('.faq-item').forEach((d) => { d.open = true; }));

  // ---- the form -------------------------------------------------------------------------------------------------
  const form = document.getElementById('lead-form');
  if (!form) return;

  const $ = (id) => document.getElementById(id);
  const nameField = $('lead-name'), emailField = $('lead-email'), companyField = $('lead-company');
  const interestField = $('lead-interest'), interestWrap = $('lead-interest-field');
  const status = $('lead-status'), submit = form.querySelector('.lead-submit');
  const loadedAt = Date.now();

  const MODES = {
    talk: {
      label: 'CONTACT', title: 'Talk to us', submit: 'Send message', reply: 'We reply by email.',
      sub: 'Tell us what you run and what you need covered. If we are not the right fit, we will say so.',
    },
  };
  const INTERESTS = { soc: 'Agentic SOC', intel: 'Threat intelligence', grc: 'GRC & Strategy', products: 'Security Products', unsure: 'Not sure yet' };

  const currentIntent = () => (form.querySelector('input[name="intent"]:checked') || {}).value || 'talk';

  const setIntent = (intent, interest) => {
    if (!MODES[intent]) intent = 'talk';
    const radio = form.querySelector(`input[name="intent"][value="${intent}"]`);
    if (radio) radio.checked = true;
    const mode = MODES[intent];
    $('lead-mode-label').textContent = mode.label;
    $('lead-title').textContent = mode.title;
    $('lead-sub').textContent = mode.sub;
    $('lead-submit-label').textContent = mode.submit;
    if ($('lead-reply')) $('lead-reply').textContent = mode.reply;
    // the visitor can say which service line they are asking about
    interestWrap.hidden = false;
    if (interest && INTERESTS[interest]) interestField.value = interest;
    else if (interestField.value === 'soc' && !interest) interestField.value = 'unsure';
  };

  form.querySelectorAll('input[name="intent"]').forEach((radio) => radio.addEventListener('change', () => setIntent(radio.value)));

  // buttons and links elsewhere on the page that should open the form in a particular mode
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-lead-intent]');
    if (!trigger) return;
    if (form.hidden) { // a second enquiry after one was sent: bring the form back
      form.hidden = false; $('lead-done').hidden = true; status.textContent = ''; submit.disabled = false;
    }
    setIntent(trigger.dataset.leadIntent, trigger.dataset.leadInterest);
    const href = trigger.getAttribute('href') || '';
    if (href.startsWith('#')) setTimeout(() => nameField.focus({ preventScroll: true }), 700);
  });

  // campaign links can open the form in a mode: /?intent=talk&interest=grc#contact
  const urlParams = new URLSearchParams(location.search);
  if (urlParams.get('intent')) setIntent(urlParams.get('intent'), urlParams.get('interest'));
  else setIntent('talk');

  // ---- validation -----------------------------------------------------------------------------------------------
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const problems = [
    [nameField, 'err-name', (v) => v.trim().length >= 2, 'Enter your name.'],
    [emailField, 'err-email', (v) => EMAIL.test(v.trim()), 'Enter a work email, like name@company.com.au.'],
    [companyField, 'err-company', (v) => v.trim().length >= 2, 'Enter your company.'],
  ];
  const check = (field, errId, ok, message) => {
    const valid = ok(field.value);
    field.setAttribute('aria-invalid', String(!valid));
    $(errId).textContent = valid ? '' : message;
    return valid;
  };
  problems.forEach(([field, errId, ok, message]) => {
    field.addEventListener('blur', () => { if (field.value) check(field, errId, ok, message); });
    field.addEventListener('input', () => { if (field.getAttribute('aria-invalid') === 'true') check(field, errId, ok, message); });
  });

  // ---- building the message -------------------------------------------------------------------------------------
  const collect = () => {
    const data = new FormData(form);
    const intent = currentIntent();
    return {
      intent,
      interest: interestField.value,
      name: (data.get('name') || '').toString().trim(),
      email: (data.get('email') || '').toString().trim(),
      company: (data.get('company') || '').toString().trim(),
      size: (data.get('size') || '').toString(),
      stack: data.getAll('stack').map(String),
      message: (data.get('message') || '').toString().trim(),
      page: location.href.split('#')[0],
      landing: attribution.landing || location.pathname,
      referrer: attribution.referrer || '',
      utm: TRACKED.reduce((acc, key) => (attribution[key] ? { ...acc, [key]: attribution[key] } : acc), {}),
      seconds_on_page: Math.round((Date.now() - loadedAt) / 1000),
      submitted_at: new Date().toISOString(),
    };
  };

  const toMailto = (lead) => {
    const label = MODES[lead.intent].title;
    const lines = [
      `Name: ${lead.name}`, `Email: ${lead.email}`, `Company: ${lead.company}`,
      lead.size ? `Company size: ${lead.size}` : null,
      `Interested in: ${INTERESTS[lead.interest] || lead.interest}`,
      lead.stack.length ? `Running: ${lead.stack.join(', ')}` : null,
      '', lead.message, '',
      `Sent from: ${lead.page}`,
      ...Object.entries(lead.utm).map(([k, v]) => `${k}: ${v}`),
    ].filter((line) => line !== null);
    const subject = `${label} request from ${lead.name}, ${lead.company}`;
    return `mailto:${form.dataset.fallbackEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  };

  // `occam:mailto` lets a listener see (or cancel) the email hand-off, which is also how the fallback is tested
  const openMail = (url) => {
    const proceed = document.dispatchEvent(new CustomEvent('occam:mailto', { detail: { url }, cancelable: true }));
    if (proceed) location.href = url;
  };

  const showDone = (lead, viaEmail) => {
    form.hidden = true;
    const done = $('lead-done');
    done.hidden = false;
    const first = lead.name.split(/\s+/)[0];
    $('lead-done-title').textContent = viaEmail ? `Nearly there, ${first}.` : `Thanks, ${first}.`;
    $('lead-done-copy').textContent = viaEmail
      ? 'Your email app should have opened with your details filled in. Nothing has been sent until you press send there.'
      : 'We have your message and will reply by email.';
    done.querySelector('.lead-manual')?.remove();
    if (viaEmail) {
      // webmail users have no mail app to open, so give them the message to send themselves
      const details = document.createElement('details');
      details.className = 'lead-manual';
      details.open = true;
      const summary = document.createElement('summary');
      summary.textContent = 'Nothing opened?';
      const help = document.createElement('p');
      help.textContent = `Send the message below to ${form.dataset.fallbackEmail} from any email account.`;
      const box = document.createElement('textarea');
      box.readOnly = true; box.rows = 8; box.setAttribute('aria-label', 'Your message');
      const parts = new URL(toMailto(lead)).searchParams;
      box.value = `Subject: ${parts.get('subject')}

${parts.get('body')}`;
      box.addEventListener('focus', () => box.select());
      details.append(summary, help, box);
      done.append(details);
    }
    done.focus();
    fire(viaEmail ? 'occam:lead-fallback' : 'occam:lead', { intent: lead.intent, interest: lead.interest, via: viaEmail ? 'email' : 'endpoint' });
  };

  const fail = (lead, why) => {
    status.textContent = '';
    status.append(why + ' You can ');
    const link = document.createElement('a');
    link.href = toMailto(lead);
    link.textContent = 'email us directly instead';
    status.append(link, '.');
    submit.disabled = false;
    submit.removeAttribute('aria-busy');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    const results = problems.map(([field, errId, ok, message]) => check(field, errId, ok, message));
    if (results.includes(false)) {
      const firstBad = problems.find((_, i) => !results[i])[0];
      firstBad.focus();
      return;
    }
    // a bot filled the hidden field: look successful and do nothing
    if (form.elements.contact_ref && form.elements.contact_ref.value) { showDone(collect(), false); return; }

    const lead = collect();
    const endpoint = (form.dataset.endpoint || '').trim();

    if (!endpoint) {
      showDone(lead, true);
      openMail(toMailto(lead));
      return;
    }

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lead),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      showDone(lead, false);
    } catch (error) {
      fail(lead, error.name === 'AbortError' ? 'That took too long to send.' : 'Sorry, that did not send.');
    } finally {
      clearTimeout(timer);
    }
  });
})();
