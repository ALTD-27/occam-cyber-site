// Services. All three panels ship in the HTML so they survive print, search and a no-JS read,
// and #panel-soc ships with is-shown so the flagship is on screen even if this file never runs.
// This block is first on purpose: it is the offer, so a throw in the workflow or graph code
// below must not take it down. Service copy is edited in index.html, never here.
const serviceButtons = document.querySelectorAll('.service-choice');
const servicePanels = document.querySelectorAll('.service-panel');
const showService = (button) => {
  serviceButtons.forEach((item) => {
    const chosen = item === button;
    item.classList.toggle('is-active', chosen);
    item.setAttribute('aria-selected', String(chosen));
    item.tabIndex = chosen ? 0 : -1;
  });
  servicePanels.forEach((item) => { item.classList.toggle('is-shown', item.id === `panel-${button.dataset.service}`); });
};
serviceButtons.forEach((button, index) => {
  button.addEventListener('click', () => showService(button));
  button.addEventListener('keydown', (event) => {
    const forward = (index + 1) % serviceButtons.length;
    const back = (index + serviceButtons.length - 1) % serviceButtons.length;
    const directions = { ArrowDown: forward, ArrowRight: forward, ArrowUp: back, ArrowLeft: back, Home: 0, End: serviceButtons.length - 1 };
    if (!(event.key in directions)) return;
    event.preventDefault();
    const next = serviceButtons[directions[event.key]];
    next.focus(); showService(next);
  });
});
if (serviceButtons.length) showService(serviceButtons[0]);

const setText = (id, value) => { document.getElementById(id).textContent = value; };

// Inside the Agentic SOC: one example investigation that plays through the five steps.
// The whole run is a list of beats. The state at any point is just the beats up to it replayed, so jumping
// to a step, replaying and printing all reuse the same reduce(). The HTML ships the finished state for
// readers without JavaScript; this rewinds it. No clock times anywhere, on purpose: nothing here should
// read like a response time or a claim about cover.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sim = document.getElementById('sim');
if (sim) {
  const byId = (id) => document.getElementById(id);
  const stepButtons = [...document.querySelectorAll('.workflow-step')];
  const STEPS = ['observe', 'understand', 'reason', 'act', 'assure'];
  const STEP_COPY = {
    observe: ['01 / OBSERVE', 'Events arrive from endpoints, cloud, identity, SaaS and AI agents. We resolve them into one operational picture, so every decision after this is made against the same view.'],
    understand: ['02 / UNDERSTAND', 'We connect the event to the account, its owner, the data it can reach and the controls around it. That context decides how much it matters.'],
    reason: ['03 / REASON', 'Agents raise every plausible explanation and test each one against the evidence, writing down why each is ruled out until one remains.'],
    act: ['04 / ACT', 'Anything beyond the limits you set waits for a named person. Agents propose, a person approves, then agents carry it out.'],
    assure: ['05 / ASSURE', 'Actions, approvals and outcomes are recorded as evidence you can hand to an auditor.'],
  };
  const HYPS = ['travel', 'spray', 'device', 'vpn', 'token'];
  const APPROVED_BY = { you: 'Approved by you, the accountable person', analyst: 'Approved by the named analyst' };
  const beats = [
    { step: 'observe', dur: 1800, status: 'SIGNAL RECEIVED', log: ['agent', 'Alert raised for a first-time country'], fact: 'where' },
    { step: 'observe', dur: 1700, log: ['agent', 'Sign-in, device and network logs pulled'] },
    { step: 'understand', dur: 1500, status: 'RESOLVING CONTEXT', log: ['agent', 'Account, role and data access resolved'], fact: 'who' },
    { step: 'understand', dur: 1900, fact: ['session', 'reach'] },
    { step: 'reason', dur: 1500, status: 'TESTING EXPLANATIONS', log: ['agent', 'Five explanations raised and tested'], raise: true },
    { step: 'reason', dur: 1300, out: 'travel' },
    { step: 'reason', dur: 1300, out: 'spray' },
    { step: 'reason', dur: 1300, out: 'device' },
    { step: 'reason', dur: 1500, out: 'vpn' },
    { step: 'reason', dur: 1900, status: 'ONE EXPLANATION LEFT', survive: 'token', log: ['agent', 'Four ruled out, one remains'] },
    { step: 'act', wait: true, status: 'WAITING FOR A PERSON', log: ['agent', 'Proposed: revoke sessions, reset password'], call: 'proposed' },
    { step: 'act', dur: 1500, status: 'APPROVED, ACTING', call: 'approved', approval: true },
    { step: 'act', dur: 1800, call: 'done', log: ['agent', 'Sessions revoked, password reset, user told'] },
    { step: 'assure', status: 'CLOSED, EVIDENCE WRITTEN', log: ['agent', 'Evidence pack written'], evidence: true },
  ];
  const LAST = beats.length - 1;
  const WAIT_FOR_PERSON = 9000;

  let at = -1, playing = false, approver = null, timer = null, waitTimer = null, shownLog = 0, started = false, pausedByScroll = false;

  const reduce = (upTo) => {
    const s = { status: 'MONITORING', log: [], facts: new Set(), raised: false, out: new Set(), survivor: null, call: 'idle', evidence: false, step: 'observe' };
    for (let k = 0; k <= upTo; k++) {
      const b = beats[k];
      s.step = b.step;
      if (b.status) s.status = b.status;
      if (b.log) s.log.push(b.log);
      if (b.approval) s.log.push(['human', APPROVED_BY[approver || 'analyst']]);
      if (b.fact) [].concat(b.fact).forEach((f) => s.facts.add(f));
      if (b.raise) s.raised = true;
      if (b.out) s.out.add(b.out);
      if (b.survive) s.survivor = b.survive;
      if (b.call) s.call = b.call;
      if (b.evidence) s.evidence = true;
    }
    s.testing = s.raised && !s.survivor ? HYPS.find((h) => !s.out.has(h)) : null;
    return s;
  };

  const render = (s) => {
    const status = byId('sim-status');
    status.replaceChildren(document.createElement('i'), ` ${s.status}`);
    document.querySelectorAll('[data-fact]').forEach((el) => el.classList.toggle('is-pending', !s.facts.has(el.dataset.fact)));

    const log = byId('sim-log');
    const items = s.log.length ? s.log.map(([kind, text], n) => {
      const li = document.createElement('li');
      li.className = kind + (n === s.log.length - 1 ? ' is-latest' : '') + (n >= shownLog && started ? ' is-new' : '');
      li.append(Object.assign(document.createElement('span'), { textContent: text }));
      return li;
    }) : [Object.assign(document.createElement('li'), { className: 'placeholder', textContent: 'Waiting for a signal' })];
    log.replaceChildren(...items);
    shownLog = s.log.length;

    document.querySelectorAll('.hyp').forEach((el) => {
      const key = el.dataset.hyp;
      el.classList.toggle('is-pending', !s.raised);
      el.classList.toggle('is-out', s.out.has(key));
      el.classList.toggle('is-survivor', s.survivor === key);
      el.classList.toggle('is-testing', s.testing === key);
    });
    byId('sim-count').textContent = !s.raised ? 'Not raised yet' : s.survivor ? '1 of 5 remains' : `${HYPS.length - s.out.size} of 5 in play`;

    byId('sim-call').dataset.state = s.call;
    // one quiet announcement per milestone instead of a live region that speaks every status change
    const announce = byId('sim-announce');
    if (announce) {
      const message = s.call === 'proposed' ? 'The investigation is waiting for approval. Use the approve button to continue.'
        : s.evidence ? 'Investigation closed and evidence written.' : '';
      if (message && announce.textContent !== message) announce.textContent = message;
    }
    byId('sim-approve').hidden = s.call !== 'proposed';
    byId('sim-approver').textContent = APPROVED_BY[approver || 'analyst'];
    document.querySelector('.sim-evidence').classList.toggle('is-pending', !s.evidence);

    const current = STEPS.indexOf(s.step);
    stepButtons.forEach((button, n) => {
      const on = n === current;
      button.classList.toggle('is-active', on);
      button.classList.toggle('is-done', n < current && at >= 0);
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    sim.setAttribute('aria-labelledby', stepButtons[current].id);
    const [label, copy] = STEP_COPY[s.step];
    byId('sim-step-label').textContent = label;
    byId('sim-step-copy').textContent = copy;
  };

  const toggle = byId('sim-toggle'), replay = byId('sim-replay');
  const controls = () => {
    toggle.hidden = at >= LAST;
    toggle.textContent = playing ? 'Pause' : 'Play';
    replay.hidden = at < 0;
  };
  const go = (k) => { at = k; render(reduce(at)); controls(); };
  const stop = () => { clearTimeout(timer); clearTimeout(waitTimer); };
  const schedule = () => {
    stop();
    if (!playing) return controls();
    if (at >= LAST) { playing = false; return controls(); }
    const beat = beats[at];
    if (beat && beat.wait) {
      waitTimer = setTimeout(() => approve('analyst'), WAIT_FOR_PERSON);
      return controls();
    }
    timer = setTimeout(() => { go(at + 1); schedule(); }, at < 0 ? 700 : beat.dur);
    controls();
  };
  const play = () => { if (at >= LAST) return restart(); playing = true; started = true; schedule(); };
  const pause = () => { playing = false; stop(); controls(); };
  const restart = () => { stop(); approver = null; shownLog = 0; started = true; go(-1); playing = true; schedule(); };
  function approve(who) {
    if (!beats[at] || beats[at].call !== 'proposed') return;
    approver = who;
    go(at + 1);
    playing = true;
    schedule();
  }

  // Jumping lands on the end of a step, except Act, which lands on the proposal so the visitor can approve it.
  const jump = (step) => {
    pause();
    started = true;
    const target = step === 'act' ? beats.findIndex((b) => b.step === 'act') : beats.map((b) => b.step).lastIndexOf(step);
    shownLog = reduce(target).log.length;
    go(target);
  };

  stepButtons.forEach((button, index) => {
    button.id = `workflow-${button.dataset.step}`;
    button.addEventListener('click', () => jump(button.dataset.step));
    button.addEventListener('keydown', (event) => {
      const directions = { ArrowRight: (index + 1) % stepButtons.length, ArrowLeft: (index + stepButtons.length - 1) % stepButtons.length, Home: 0, End: stepButtons.length - 1 };
      if (!(event.key in directions)) return;
      event.preventDefault();
      const next = stepButtons[directions[event.key]];
      next.focus(); jump(next.dataset.step);
    });
  });
  toggle.addEventListener('click', () => (playing ? pause() : play()));
  replay.addEventListener('click', restart);
  byId('sim-approve').addEventListener('click', () => approve('you'));
  window.addEventListener('beforeprint', () => { pause(); go(LAST); });

  if (reducedMotion || !('IntersectionObserver' in window)) {
    go(LAST); // the finished investigation, with Replay available if the reader wants it
  } else {
    go(-1);
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!started) restart();
        else if (pausedByScroll) { pausedByScroll = false; play(); }
      } else if (playing) { pausedByScroll = true; pause(); }
    }, { threshold: 0.35 }).observe(sim);
  }
}

// Scroll reveals. Only switched on here, so if this file never runs nothing stays hidden.
if (!reducedMotion && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('reveal-ready');
  const revealer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-in');
    revealer.unobserve(entry.target);
  }), { threshold: 0.12 });
  document.querySelectorAll('[data-reveal], .closing-art').forEach((el) => revealer.observe(el));
  window.addEventListener('beforeprint', () => document.querySelectorAll('[data-reveal], .closing-art').forEach((el) => el.classList.add('is-in')));
}


const graphDetails = {
  data: ['DATA ACCESS', 'Read-only access to approved financial reporting data.'],
  identity: ['DELEGATED AUTHORITY', 'A dedicated agent identity with a defined role and time-limited permissions.'],
  policy: ['POLICY & CONTROLS', 'Reporting policies are evaluated before access is granted or an action is taken.'],
  erp: ['CONNECTED SYSTEM', 'The finance system provides approved records through a governed connection.'],
  risk: ['BUSINESS RISK', 'Exposure is evaluated against data sensitivity, access scope and business impact.'],
  owner: ['ACCOUNTABLE OWNER', 'Finance Operations owns the workflow and approves changes to the agent’s authority.']
};
document.querySelectorAll('[data-node]').forEach((node) => {
  node.addEventListener('click', () => {
    document.querySelectorAll('[data-node]').forEach((item) => {
      item.classList.toggle('is-selected', item === node);
      item.setAttribute('aria-pressed', String(item === node));
    });
    const [label, copy] = graphDetails[node.dataset.node];
    setText('graph-detail-label', label); setText('graph-detail-copy', copy);
  });
});

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.hero').forEach((surface) => {
    const visual = surface.querySelector('.hero-visual');
    surface.addEventListener('pointermove', (event) => {
      const bounds = surface.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      visual.style.setProperty('--hero-x', `${x * -2}deg`);
      visual.style.setProperty('--hero-y', `${y * 1.3}deg`);
    });
    surface.addEventListener('pointerleave', () => {
      visual.style.setProperty('--hero-x', '0deg'); visual.style.setProperty('--hero-y', '0deg');
    });
  });

}
