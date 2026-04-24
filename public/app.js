'use strict';

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'admin') { switchAdmTab('users', document.querySelector('.adm-tab[data-adm="users"]')); }
  });
});

// ── Theme ──────────────────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  html.classList.remove('banana');
  const light = html.classList.toggle('light');
  document.getElementById('theme-icon').textContent = light ? '🌙' : '☀';
  localStorage.setItem('wr-theme', light ? 'light' : 'dark');
}
(function applyStoredTheme() {
  const theme = localStorage.getItem('wr-theme');
  if (theme === 'light') {
    document.documentElement.classList.add('light');
    document.getElementById('theme-icon').textContent = '🌙';
  } else if (theme === 'banana') {
    document.documentElement.classList.add('banana');
    document.getElementById('theme-icon').textContent = '🍌';
  }
})();

// 🥚 Easter egg — type "banana" anywhere to toggle banana mode
(function() {
  const secret = 'banana';
  let typed = '';
  document.addEventListener('keydown', function(e) {
    typed += e.key.toLowerCase();
    if (typed.length > secret.length) typed = typed.slice(-secret.length);
    if (typed === secret) {
      typed = '';
      const html = document.documentElement;
      const isBanana = html.classList.contains('banana');
      html.classList.remove('light', 'banana');
      if (!isBanana) {
        html.classList.add('banana');
        document.getElementById('theme-icon').textContent = '🍌';
        localStorage.setItem('wr-theme', 'banana');
        showToast('🍌 Banana mode activated. You found the secret!');
      } else {
        document.getElementById('theme-icon').textContent = '☀';
        localStorage.setItem('wr-theme', 'dark');
        showToast('Back to normal… boring.');
      }
    }
  });
})();

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: 'var(--accent)', color: 'var(--bg)', padding: '10px 20px',
    borderRadius: '999px', fontWeight: '600', fontSize: '13px',
    zIndex: '9999', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    transition: 'opacity 0.4s', whiteSpace: 'nowrap',
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}

// ── Utilities ──────────────────────────────────────────────────────────────
function esc(v) {
  const d = document.createElement('div');
  d.textContent = String(v ?? '');
  return d.innerHTML;
}
function showLoading(el) {
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p>Scanning…</p></div>`;
}
function statusClass(code) {
  if (typeof code !== 'number') return 'se';
  if (code < 300) return 's2';
  if (code < 400) return 's3';
  if (code < 500) return 's4';
  return 's5';
}
function toggleCard(id) { document.getElementById(id)?.classList.toggle('expanded'); }
function toggleRaw(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
}
function formatDate(s) {
  if (!s) return null;
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return s; }
}

// Ctrl+Enter submit
const ctrlMap = {
  'whois-input':    () => runWhois(),
  'ip-input':       () => runIpCheck(),
  'dns-input':      () => runDnsCheck(),
  'redirect-input': () => runRedirectCheck(),
};
document.querySelectorAll('textarea').forEach(ta => {
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); ctrlMap[ta.id]?.(); }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// WHOIS
// ══════════════════════════════════════════════════════════════════════════
async function runWhois() {
  const val = document.getElementById('whois-input').value.trim();
  if (!val) return;
  const el = document.getElementById('whois-results');
  showLoading(el);
  try {
    const r = await fetch('/api/whois', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: val.split('\n').map(d => d.trim()).filter(Boolean) }),
    });
    renderWhois(await r.json(), el);
  } catch (err) { el.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`; }
}

function renderWhois(results, el) {
  if (!results?.length) { el.innerHTML = '<div class="empty-state">No results.</div>'; return; }
  el.innerHTML = results.map((res, i) => {
    const id = `wc-${i}`;
    if (res.status === 'error') return `
      <div class="result-card" id="${id}">
        <div class="result-header" onclick="toggleCard('${id}')">
          <div class="result-title"><span class="result-domain">${esc(res.domain)}</span><span class="badge badge-error">Error</span></div>
          <span class="expand-btn">▾</span>
        </div>
        <div class="result-body"><p style="color:var(--error);font-size:13px">${esc(res.error)}</p></div>
      </div>`;
    const d = res.data || {};
    const expired = d.expiresOn && new Date(d.expiresOn) < new Date();
    const fields = [
      ['Domain Name', d.domainName], ['Registrar', d.registrar],
      ['Registered On', formatDate(d.createdOn)], ['Expires On', formatDate(d.expiresOn)],
      ['Last Updated', formatDate(d.lastUpdated)], ['Registrant Name', d.registrantName],
      ['Registrant Org', d.registrantOrg], ['Registrant Email', d.registrantEmail],
      ['Registrant Country', d.registrantCountry],
    ].filter(([, v]) => v);
    const statuses = [].concat(d.status || []);
    const ns = [].concat(d.nameServers || []);
    return `
      <div class="result-card" id="${id}">
        <div class="result-header" onclick="toggleCard('${id}')">
          <div class="result-title">
            <span class="result-domain">${esc(res.domain)}</span>
            ${d.expiresOn ? `<span class="badge ${expired ? 'badge-error' : 'badge-success'}">${expired ? 'Expired' : 'Active'}</span>` : ''}
          </div>
          <span class="expand-btn">▾</span>
        </div>
        <div class="result-body">
          <div class="data-grid">${fields.map(([l, v]) => `<div class="data-item"><div class="data-label">${esc(l)}</div><div class="data-value">${esc(v)}</div></div>`).join('')}</div>
          ${statuses.length ? `<div class="section-title">Domain Status</div><div class="tag-list">${statuses.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>` : ''}
          ${ns.length ? `<div class="section-title">Name Servers</div><div class="tag-list">${ns.map(n => `<span class="tag">${esc(n)}</span>`).join('')}</div>` : ''}
          <span class="raw-toggle" onclick="toggleRaw('wr-${i}')">⇲ Raw WHOIS</span>
          <pre class="raw-data" id="wr-${i}">${esc(res.raw || '')}</pre>
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════
// IP Checker
// ══════════════════════════════════════════════════════════════════════════
async function runIpCheck() {
  const val = document.getElementById('ip-input').value.trim();
  if (!val) return;
  const el = document.getElementById('ip-results');
  showLoading(el);
  try {
    const r = await fetch('/api/ip', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ips: val.split('\n').map(s => s.trim()).filter(Boolean) }),
    });
    renderIp(await r.json(), el);
  } catch (err) { el.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`; }
}

function renderIp(results, el) {
  if (!results?.length) { el.innerHTML = '<div class="empty-state">No results.</div>'; return; }
  el.innerHTML = results.map((res, i) => {
    const id = `ic-${i}`;
    const ok = res.providers.filter(p => p.status === 'success').length;
    return `
      <div class="result-card" id="${id}">
        <div class="result-header" onclick="toggleCard('${id}')">
          <div class="result-title">
            <span class="result-domain">${esc(res.ip)}</span>
            <span class="badge ${ok === res.providers.length ? 'badge-success' : ok > 0 ? 'badge-warning' : 'badge-error'}">${ok}/${res.providers.length} providers</span>
          </div>
          <span class="expand-btn">▾</span>
        </div>
        <div class="result-body">
          <div class="provider-grid">${res.providers.map(renderProvider).join('')}</div>
        </div>
      </div>`;
  }).join('');
}

function renderProvider(p) {
  if (p.status === 'error') return `
    <div class="provider-card">
      <div class="provider-title">${esc(p.provider)}</div>
      <div class="provider-error">${esc(p.error || 'Failed')}</div>
    </div>`;
  const rows = Object.entries(p.data)
    .filter(([k, v]) => v != null && v !== '' && k !== 'ip')
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').trim();
      return `<div class="provider-row"><span class="provider-key">${esc(label)}</span><span class="provider-val">${esc(typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v)}</span></div>`;
    }).join('');
  return `
    <div class="provider-card">
      <div class="provider-title">${esc(p.provider)}</div>
      <div class="provider-body">${rows || '<span style="color:var(--muted);font-size:12px">No data</span>'}</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════
// DNS Checker
// ══════════════════════════════════════════════════════════════════════════
async function runDnsCheck() {
  const val = document.getElementById('dns-input').value.trim();
  if (!val) return;
  const el = document.getElementById('dns-results');
  showLoading(el);
  try {
    const r = await fetch('/api/dns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: val.split('\n').map(s => s.trim()).filter(Boolean), recordType: document.getElementById('dns-type').value }),
    });
    renderDns(await r.json(), el);
  } catch (err) { el.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`; }
}

function renderDns(results, el) {
  if (!results?.length) { el.innerHTML = '<div class="empty-state">No results.</div>'; return; }
  el.innerHTML = results.map((res, i) => {
    const id = `dc-${i}`;
    const ok = res.resolvers.filter(r => r.status === 'success' && r.answers?.length).length;
    return `
      <div class="result-card" id="${id}">
        <div class="result-header" onclick="toggleCard('${id}')">
          <div class="result-title">
            <span class="result-domain">${esc(res.domain)}</span>
            <span class="badge badge-info">${esc(res.recordType)}</span>
            <span class="badge ${ok === res.resolvers.length ? 'badge-success' : ok > 0 ? 'badge-warning' : 'badge-error'}">${ok}/${res.resolvers.length} resolved</span>
          </div>
          <span class="expand-btn">▾</span>
        </div>
        <div class="result-body">
          <div class="dns-wrap">
            <table class="dns-table">
              <thead><tr><th>Resolver</th><th>Location</th><th>Status</th><th>Answer</th><th>TTL</th></tr></thead>
              <tbody>${res.resolvers.map(r => {
                const has = r.status === 'success' && r.answers?.length;
                return `<tr>
                  <td style="font-weight:600">${esc(r.resolver)}</td>
                  <td style="white-space:nowrap">${r.flag || ''} ${esc(r.country || '')}</td>
                  <td>${has ? '<span class="check">✓</span>' : '<span class="cross">✗</span>'}</td>
                  <td>${has ? `<div class="dns-answers">${r.answers.map(a => `<span class="dns-answer">${esc(a.data)}</span>`).join('')}</div>` : `<span style="color:var(--muted);font-size:11px">${esc(r.error || r.rcode || 'No record')}</span>`}</td>
                  <td style="color:var(--muted)">${has ? r.answers[0]?.ttl ?? '—' : '—'}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════
// Redirect Checker
// ══════════════════════════════════════════════════════════════════════════
async function runRedirectCheck() {
  const val = document.getElementById('redirect-input').value.trim();
  if (!val) return;
  const el = document.getElementById('redirect-results');
  showLoading(el);
  try {
    const r = await fetch('/api/redirect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: val.split('\n').map(s => s.trim()).filter(Boolean) }),
    });
    renderRedirect(await r.json(), el);
  } catch (err) { el.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`; }
}

function renderRedirect(results, el) {
  if (!results?.length) { el.innerHTML = '<div class="empty-state">No results.</div>'; return; }
  el.innerHTML = results.map((res, i) => {
    const id = `rc-${i}`;
    if (res.status === 'error') return `
      <div class="result-card" id="${id}">
        <div class="result-header" onclick="toggleCard('${id}')"><div class="result-title"><span class="result-domain">${esc(res.url)}</span><span class="badge badge-error">Error</span></div><span class="expand-btn">▾</span></div>
        <div class="result-body"><p style="color:var(--error);font-size:13px">${esc(res.error)}</p></div>
      </div>`;
    return `
      <div class="result-card" id="${id}">
        <div class="result-header" onclick="toggleCard('${id}')">
          <div class="result-title">
            <span class="result-domain">${esc(res.url)}</span>
            <span class="badge ${res.hops > 1 ? 'badge-warning' : 'badge-success'}">${res.hops} hop${res.hops !== 1 ? 's' : ''}</span>
            ${res.finalStatus ? `<span class="badge badge-info">${esc(String(res.finalStatus))}</span>` : ''}
          </div>
          <span class="expand-btn">▾</span>
        </div>
        <div class="result-body">
          ${res.finalUrl !== res.url ? `<div class="redirect-final"><div class="redirect-final-label">Final Destination</div><div class="redirect-final-url">${esc(res.finalUrl)}</div></div>` : ''}
          <div class="chain">${res.chain.map((step, si) => `
            <div class="chain-step">
              <div class="step-num">${si + 1}</div>
              <div class="step-code ${statusClass(step.status)}">${esc(String(step.status))}</div>
              <div class="step-details">
                <div class="step-url">${esc(step.url)}</div>
                ${step.redirectTo ? `<div class="step-to">${esc(step.redirectTo)}</div>` : ''}
                ${step.server ? `<div class="step-meta">Server: ${esc(step.server)}</div>` : ''}
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════
// Text Calculator
// ══════════════════════════════════════════════════════════════════════════
const STOP_WORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','was','are','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','ought','used','it','its','this','that','these','those','i','you','he','she','we','they','me','him','her','us','them','my','your','his','our','their','not','no','so','as','if','then','than','when','where','who','which','what','how','all','both','each','few','more','most','other','some','such','any','up','out','about','into','through','during','before','after','above','below','between','much','very','just','over','also','back','still','even','here','there']);

document.getElementById('tc-input').addEventListener('input', updateTextStats);

function updateTextStats() {
  const text = document.getElementById('tc-input').value;
  const statsEl = document.getElementById('tc-stats');
  const kwEl    = document.getElementById('tc-keywords');

  if (!text) {
    statsEl.innerHTML = '<div class="tc-placeholder">Start typing to see statistics…</div>';
    kwEl.innerHTML = '';
    return;
  }

  const chars        = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const wordTokens   = text.trim().match(/\b\w+\b/g) || [];
  const words        = wordTokens.length;
  const sentences    = (text.match(/[^.!?]*[.!?]+/g) || []).filter(s => s.trim()).length || (text.trim() ? 1 : 0);
  const paragraphs   = text.split(/\n\s*\n/).filter(p => p.trim()).length || (text.trim() ? 1 : 0);
  const lines        = text.split('\n').length;
  const readSec      = Math.round((words / 200) * 60);
  const speakSec     = Math.round((words / 130) * 60);
  const uniqueWords  = new Set(wordTokens.map(w => w.toLowerCase())).size;

  function fmt(sec) {
    if (sec === 0) return '0s';
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60), s = sec % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }

  statsEl.innerHTML = [
    { label: 'Characters',    value: chars.toLocaleString(),        sub: `${charsNoSpace.toLocaleString()} without spaces` },
    { label: 'Words',         value: words.toLocaleString(),        sub: `${uniqueWords.toLocaleString()} unique` },
    { label: 'Sentences',     value: sentences.toLocaleString(),    sub: null },
    { label: 'Paragraphs',    value: paragraphs.toLocaleString(),   sub: null },
    { label: 'Lines',         value: lines.toLocaleString(),        sub: null },
    { label: 'Reading Time',  value: fmt(readSec),                  sub: '~200 wpm' },
    { label: 'Speaking Time', value: fmt(speakSec),                 sub: '~130 wpm' },
  ].map(s => `
    <div class="tc-stat">
      <span class="tc-stat-label">${esc(s.label)}</span>
      <div style="text-align:right">
        <div class="tc-stat-value">${esc(s.value)}</div>
        ${s.sub ? `<div class="tc-stat-sub">${esc(s.sub)}</div>` : ''}
      </div>
    </div>`).join('');

  const freq = {};
  wordTokens.forEach(w => { const lw = w.toLowerCase(); if (!STOP_WORDS.has(lw) && lw.length > 2) freq[lw] = (freq[lw] || 0) + 1; });
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15);

  kwEl.innerHTML = topWords.length ? `
    <div class="tc-kw-title">Top Keywords</div>
    <div class="tc-kw-list">
      ${topWords.map(([w, n]) => `<div class="tc-kw"><span class="tc-kw-word">${esc(w)}</span><span class="tc-kw-count">${n}</span></div>`).join('')}
    </div>` : '';
}

// ══════════════════════════════════════════════════════════════════════════
// Password Generator
// ══════════════════════════════════════════════════════════════════════════
let _pwdType = 'password';
let _pwds    = [];

const WORDLIST = [
  'alpine','brave','cloud','delta','eagle','flame','grace','honor','ivory','joker',
  'kneel','lemon','maple','noble','ocean','peace','quest','river','stone','tiger',
  'ultra','vivid','water','xenon','youth','zebra','amber','blaze','cedar','dusk',
  'ember','frost','glide','hazel','indie','jade','karma','lunar','mango','nexus',
  'orbit','pilot','rapid','solar','torch','unity','vault','vigor','waltz','yield',
  'alpha','brisk','crisp','drift','fluid','grand','helix','joint','lance','mocha',
  'north','ozone','prism','reign','spark','tidal','urban','viper','worth','zesty',
  'comet','dense','field','ghost','haven','jelly','light','mixed','nerve','outer',
  'plaza','rebel','sleek','thick','value','whole','azure','blunt','steel','cipher',
  'drone','epoch','forge','glyph','hydra','inbox','joust','knack','lyric','metro',
  'niche','oxide','pulse','realm','shard','trend','umbra','wired','xenix','zonal',
];

function setPasswordType(type) {
  _pwdType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  const slider  = document.getElementById('password-length');
  const display = document.getElementById('length-display');
  const optGrid = document.getElementById('options-grid');
  document.getElementById('length-label').textContent = type === 'passphrase' ? 'Words' : 'Length';
  if (type === 'passphrase') {
    slider.min = '2'; slider.max = '10'; slider.value = '4'; display.textContent = '4';
    optGrid.style.display = 'none';
  } else {
    slider.min = '8'; slider.max = '128'; slider.value = '20'; display.textContent = '20';
    optGrid.style.display = 'grid';
  }
  generatePasswords();
}

function _randInt(n) { return crypto.getRandomValues(new Uint32Array(1))[0] % n; }

function generateOne() {
  const len = parseInt(document.getElementById('password-length').value, 10);
  if (_pwdType === 'passphrase') {
    return Array.from({ length: len }, () => WORDLIST[_randInt(WORDLIST.length)]).join('-');
  }
  let chars = '';
  if (document.getElementById('opt-upper').checked)   chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (document.getElementById('opt-lower').checked)   chars += 'abcdefghijklmnopqrstuvwxyz';
  if (document.getElementById('opt-numbers').checked) chars += '0123456789';
  if (document.getElementById('opt-special').checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (document.getElementById('opt-common').checked)  chars += '!@#';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(len)), v => chars[v % chars.length]).join('');
}

function generatePasswords() {
  _pwds = Array.from({ length: 5 }, generateOne);
  document.getElementById('generated-passwords').innerHTML = _pwds.map((pwd, i) => `
    <div class="pwd-item" onclick="copyPwd(${i}, this)">
      <span class="pwd-text">${esc(pwd)}</span>
      <button class="copy-btn" data-idx="${i}">Copy</button>
    </div>`).join('');
}

function copyPwd(idx, el) {
  const pwd = _pwds[idx];
  if (pwd === undefined) return;
  navigator.clipboard.writeText(pwd).then(() => {
    const btn = el.querySelector('.copy-btn');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
  });
}

document.getElementById('password-length').addEventListener('input', function () {
  document.getElementById('length-display').textContent = this.value;
  generatePasswords();
});
document.querySelectorAll('#options-grid input[type="checkbox"]').forEach(cb => cb.addEventListener('change', generatePasswords));

// ── Safe API fetch — never throws on HTML error responses ─────────────────
async function apiFetch(url, opts = {}) {
  const r = await fetch(url, opts);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(`Server error (HTTP ${r.status})`);
  }
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

// ── Auth / Session ────────────────────────────────────────────────────────
const FEATURE_LABELS = { whois:'◎ WHOIS', ip:'⊕ IP Checker', dns:'⊗ DNS', redirect:'⇢ Redirects',
  textcalc:'✎ Text Calc', password:'⊙ Password', caseconv:'Aa Case', validator:'⊞ Validator',
  cfemail:'✉ CF Email' };

let _session = null;

async function initAuth() {
  try {
    const r = await fetch('/api/auth/me');
    if (r.status === 401) { window.location.href = '/login'; return; }
    _session = await r.json();
    applySession();
  } catch { window.location.href = '/login'; }
}

function applySession() {
  if (!_session) return;
  // Show user badge
  const ui = document.getElementById('user-info');
  const badge = document.getElementById('user-badge');
  ui.style.display = 'flex';
  badge.textContent = `${_session.username} (${_session.role})`;

  // Show/hide tabs by feature
  document.querySelectorAll('.tab[data-feature]').forEach(tab => {
    const feat = tab.dataset.feature;
    tab.style.display = _session.features.includes(feat) ? '' : 'none';
  });

  // Show admin tab if canManageUsers
  if (_session.canManageUsers) {
    document.getElementById('tab-admin').style.display = '';
  }

  // If first active tab is hidden, activate first visible one
  const active = document.querySelector('.tab.active');
  if (active && active.style.display === 'none') {
    const first = document.querySelector('.tab[data-feature]:not([style*="none"])');
    if (first) first.click();
  }
}

async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

// ── Admin Panel ───────────────────────────────────────────────────────────
function switchAdmTab(name, btn) {
  document.querySelectorAll('.adm-pane').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.adm-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('adm-' + name).style.display = 'block';
  btn.classList.add('active');
  if (name === 'users')      loadUsers();
  if (name === 'roles')      loadRoles();
  if (name === 'cfmappings') loadCFMappings();
  if (name === 'account')    loadAccount();
}

// ── Users ────────────────────────────────────────────────────────
async function loadUsers() {
  const r = await fetch('/api/admin/users');
  const users = await r.json();
  const el = document.getElementById('adm-users-list');
  if (!users.length) { el.innerHTML = '<p style="color:var(--muted);font-size:13px">No users yet.</p>'; return; }
  el.innerHTML = `<table class="adm-table">
    <thead><tr><th>Username</th><th>Role</th><th>2FA</th><th>Created</th><th></th></tr></thead>
    <tbody>${users.map(u => `<tr>
      <td><strong>${esc(u.username)}</strong></td>
      <td><span class="role-pill">${esc(u.role)}</span></td>
      <td class="${u.tfaEnabled ? 'tfa-on' : 'tfa-off'}">${u.tfaEnabled ? '✓ On' : '— Off'}</td>
      <td style="color:var(--muted);font-size:12px">${new Date(u.createdAt).toLocaleDateString()}</td>
      <td style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn btn-sm" onclick="openEditUser('${u.id}','${esc(u.username)}','${esc(u.role)}')">Edit</button>
        ${u.tfaEnabled ? `<button class="btn btn-sm" onclick="resetUserTFA('${u.id}')">Reset 2FA</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}','${esc(u.username)}')">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>`;
}

async function getRoles() {
  const r = await fetch('/api/admin/roles');
  return r.json();
}

function openCreateUser() {
  getRoles().then(roles => {
    showModal(`<h3>Create User</h3>
      <div class="field-row"><label>Username</label><input class="adm-input" id="m-username" /></div>
      <div class="field-row"><label>Password</label><input class="adm-input" type="password" id="m-password" /></div>
      <div class="field-row"><label>Role</label><select class="adm-input" id="m-role">
        ${roles.map(r => `<option value="${esc(r.name)}">${esc(r.label)}</option>`).join('')}
      </select></div>
      <div id="m-msg" class="adm-msg"></div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="btn" onclick="submitCreateUser()">Create</button>
      </div>`);
  });
}

async function submitCreateUser() {
  const username = document.getElementById('m-username').value.trim();
  const password = document.getElementById('m-password').value;
  const role     = document.getElementById('m-role').value;
  const msg      = document.getElementById('m-msg');
  const r = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, role }) });
  const d = await r.json();
  if (!r.ok) { msg.className = 'adm-msg err'; msg.textContent = d.error; return; }
  closeModal(); loadUsers();
}

function openEditUser(id, username, currentRole) {
  getRoles().then(roles => {
    showModal(`<h3>Edit User — ${esc(username)}</h3>
      <div class="field-row"><label>Role</label><select class="adm-input" id="m-role">
        ${roles.map(r => `<option value="${esc(r.name)}" ${r.name===currentRole?'selected':''}>${esc(r.label)}</option>`).join('')}
      </select></div>
      <div class="field-row"><label>New Password <span style="color:var(--muted)">(leave blank to keep)</span></label>
        <input class="adm-input" type="password" id="m-password" /></div>
      <div id="m-msg" class="adm-msg"></div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="btn" onclick="submitEditUser('${id}')">Save</button>
      </div>`);
  });
}

async function submitEditUser(id) {
  const role     = document.getElementById('m-role').value;
  const password = document.getElementById('m-password').value;
  const msg      = document.getElementById('m-msg');
  const body     = { role };
  if (password) body.password = password;
  const r = await fetch(`/api/admin/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) { msg.className = 'adm-msg err'; msg.textContent = d.error; return; }
  closeModal(); loadUsers();
}

async function deleteUser(id, username) {
  if (!confirm(`Delete user "${username}"?`)) return;
  const r = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  const d = await r.json();
  if (!r.ok) { showToast(d.error); return; }
  loadUsers();
}

async function resetUserTFA(id) {
  if (!confirm('Reset 2FA for this user?')) return;
  await fetch(`/api/admin/users/${id}/reset-2fa`, { method: 'POST' });
  loadUsers();
}

// ── Roles ─────────────────────────────────────────────────────────
async function loadRoles() {
  const r    = await fetch('/api/admin/roles');
  const roles = await r.json();
  const el   = document.getElementById('adm-roles-list');
  el.innerHTML = `<table class="adm-table">
    <thead><tr><th>Name</th><th>Label</th><th>Features</th><th>Can Manage Users</th><th></th></tr></thead>
    <tbody>${roles.map(role => `<tr>
      <td><code style="font-size:12px">${esc(role.name)}</code></td>
      <td>${esc(role.label)}</td>
      <td><div class="feat-grid">${role.features.map(f => `<span class="feat-chip">${esc(FEATURE_LABELS[f]||f)}</span>`).join('')}</div></td>
      <td>${role.canManageUsers ? '<span class="tfa-on">✓</span>' : '<span class="tfa-off">—</span>'}</td>
      <td style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn btn-sm" onclick='openEditRole(${JSON.stringify(role)})'>Edit</button>
        ${role.name !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteRole('${esc(role.name)}')">Delete</button>` : ''}
      </td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function openCreateRole() {
  showModal(`<h3>Create Role</h3>
    <div class="field-row"><label>Role Name <span style="color:var(--muted)">(no spaces)</span></label><input class="adm-input" id="m-rname" /></div>
    <div class="field-row"><label>Label</label><input class="adm-input" id="m-rlabel" /></div>
    <div class="field-row"><label>Features</label><div class="feat-check-grid" id="m-feats">
      ${Object.entries(FEATURE_LABELS).map(([k,v]) => `<label class="feat-check"><input type="checkbox" value="${k}" />${v}</label>`).join('')}
    </div></div>
    <div id="m-msg" class="adm-msg"></div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="submitCreateRole()">Create</button>
    </div>`);
}

async function submitCreateRole() {
  const name  = document.getElementById('m-rname').value.trim().replace(/\s+/g,'_');
  const label = document.getElementById('m-rlabel').value.trim();
  const features = [...document.querySelectorAll('#m-feats input:checked')].map(i => i.value);
  const msg   = document.getElementById('m-msg');
  const r = await fetch('/api/admin/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, label, features }) });
  const d = await r.json();
  if (!r.ok) { msg.className = 'adm-msg err'; msg.textContent = d.error; return; }
  closeModal(); loadRoles();
}

function openEditRole(role) {
  showModal(`<h3>Edit Role — ${esc(role.label)}</h3>
    <div class="field-row"><label>Label</label><input class="adm-input" id="m-rlabel" value="${esc(role.label)}" /></div>
    <div class="field-row"><label>Features</label><div class="feat-check-grid" id="m-feats">
      ${Object.entries(FEATURE_LABELS).map(([k,v]) => `<label class="feat-check"><input type="checkbox" value="${k}" ${role.features.includes(k)?'checked':''}/>${v}</label>`).join('')}
    </div></div>
    ${role.name !== 'admin' ? `<div class="field-row"><label class="feat-check"><input type="checkbox" id="m-can-manage" ${role.canManageUsers?'checked':''}/> Can manage users</label></div>` : ''}
    <div id="m-msg" class="adm-msg"></div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="submitEditRole('${esc(role.name)}')">Save</button>
    </div>`);
}

async function submitEditRole(name) {
  const label    = document.getElementById('m-rlabel').value.trim();
  const features = [...document.querySelectorAll('#m-feats input:checked')].map(i => i.value);
  const canM     = document.getElementById('m-can-manage');
  const msg      = document.getElementById('m-msg');
  const body     = { label, features, canManageUsers: canM ? canM.checked : true };
  const r = await fetch(`/api/admin/roles/${name}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) { msg.className = 'adm-msg err'; msg.textContent = d.error; return; }
  closeModal(); loadRoles();
}

async function deleteRole(name) {
  if (!confirm(`Delete role "${name}"?`)) return;
  const r = await fetch(`/api/admin/roles/${name}`, { method: 'DELETE' });
  const d = await r.json();
  if (!r.ok) { showToast(d.error); return; }
  loadRoles();
}

// ── My Account ────────────────────────────────────────────────────
async function loadAccount() {
  const sec = document.getElementById('tfa-section');
  sec.innerHTML = '<span style="color:var(--muted);font-size:13px">Loading…</span>';
  try {
    const { data: me } = await apiFetch('/api/auth/me');
    if (me.tfaEnabled) {
      sec.innerHTML = `
        <p class="adm-muted">✓ 2FA is <strong style="color:var(--success)">enabled</strong> on your account.</p>
        <button class="btn btn-danger" onclick="disable2FA()">Disable 2FA</button>
        <div id="tfa-msg" class="adm-msg"></div>`;
    } else {
      sec.innerHTML = `
        <p class="adm-muted">2FA is currently <strong style="color:var(--muted)">disabled</strong>.</p>
        <button class="btn" onclick="setup2FA()">Enable 2FA</button>
        <div id="tfa-setup-area" style="margin-top:14px"></div>
        <div id="tfa-msg" class="adm-msg"></div>`;
    }
  } catch (e) {
    sec.innerHTML = `<p style="color:var(--error);font-size:13px">Failed to load account info: ${esc(e.message)}</p>`;
  }
}

async function changePassword() {
  const current = document.getElementById('pwd-current').value;
  const newPwd  = document.getElementById('pwd-new').value;
  const confirm = document.getElementById('pwd-confirm').value;
  const msg     = document.getElementById('pwd-msg');
  if (newPwd !== confirm) { msg.className='adm-msg err'; msg.textContent='Passwords do not match'; return; }
  const r = await fetch('/api/auth/change-password', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ current, newPassword: newPwd }) });
  const d = await r.json();
  msg.className = r.ok ? 'adm-msg ok' : 'adm-msg err';
  msg.textContent = r.ok ? 'Password updated!' : d.error;
  if (r.ok) { document.getElementById('pwd-current').value=''; document.getElementById('pwd-new').value=''; document.getElementById('pwd-confirm').value=''; }
}

async function setup2FA() {
  const msg = document.getElementById('tfa-msg');
  try {
    const { ok, data: d } = await apiFetch('/api/auth/setup-2fa', { method: 'POST' });
    if (!ok) { msg.className='adm-msg err'; msg.textContent = d.error; return; }
    document.getElementById('tfa-setup-area').innerHTML = `
      <div class="tfa-qr"><img src="${d.qr}" alt="QR Code" /></div>
      <p class="adm-muted">Scan with your authenticator app, or enter this key manually:</p>
      <div class="tfa-secret">${esc(d.secret)}</div>
      <div class="field-row" style="margin-top:12px">
        <label>Enter 6-digit code to confirm</label>
        <input class="adm-input" id="tfa-confirm-code" maxlength="6" inputmode="numeric" placeholder="000000" />
      </div>
      <button class="btn" style="margin-top:8px" onclick="confirm2FA()">Confirm &amp; Enable</button>`;
  } catch (e) { msg.className='adm-msg err'; msg.textContent = 'Error: ' + e.message; }
}

async function confirm2FA() {
  const totp = document.getElementById('tfa-confirm-code').value.trim();
  const msg  = document.getElementById('tfa-msg');
  if (!totp) { msg.className='adm-msg err'; msg.textContent='Enter the 6-digit code'; return; }
  try {
    const { ok, data: d } = await apiFetch('/api/auth/confirm-2fa', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ totp }) });
    if (!ok) { msg.className='adm-msg err'; msg.textContent = d.error; return; }
    showToast('2FA enabled successfully!');
    loadAccount();
  } catch (e) { msg.className='adm-msg err'; msg.textContent = 'Error: ' + e.message; }
}

async function disable2FA() {
  if (!confirm('Disable 2FA? Your account will be less secure.')) return;
  try {
    const r = await fetch('/api/auth/disable-2fa', { method: 'POST' });
    if (r.ok) { showToast('2FA disabled'); loadAccount(); }
  } catch (e) { showToast('Error: ' + e.message); }
}

// ── Modal helper ──────────────────────────────────────────────────
function showModal(html) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.id = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
}
function closeModal() {
  const el = document.getElementById('modal-bg');
  if (el) el.remove();
}

// ── Syntax Validator ──────────────────────────────────────────────────────
function detectFormat(code) {
  const t = code.trim();
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  if (/^<\?xml/i.test(t)) return 'xml';
  if (/<!doctype html/i.test(t) || /^<html/i.test(t)) return 'html';
  if (/^apiVersion:/m.test(t) && /^kind:/m.test(t)) return 'k8s';
  if (/^version:/m.test(t) && /^services:/m.test(t)) return 'compose';
  if (/^FROM\s+\S/m.test(t)) return 'dockerfile';
  if (/^[A-Z_][A-Z0-9_]*\s*=/m.test(t) && !/[{}()\[\]]/.test(t)) return 'env';
  if (/^(def |class |import |from |async def )/m.test(t)) return 'python';
  if (/^---/m.test(t) || (/:\s+\S/.test(t) && !/[{};]/.test(t.slice(0, 200)))) return 'yaml';
  if (/[{};]/.test(t) && /<\w/.test(t)) return 'html';
  if (/[{};]/.test(t)) return 'javascript';
  return 'json';
}

function valJSON(code) {
  try {
    JSON.parse(code);
    return { valid: true, info: `Valid JSON — ${code.split('\n').length} lines` };
  } catch (e) {
    const m = e.message.match(/position (\d+)/);
    if (m) {
      const pos = parseInt(m[1]);
      const before = code.substring(0, pos);
      const line = before.split('\n').length;
      const col = before.split('\n').pop().length + 1;
      return { valid: false, line, col, message: e.message };
    }
    return { valid: false, message: e.message };
  }
}
function valYAML(code) {
  if (typeof jsyaml === 'undefined') return { valid: false, message: 'YAML library not loaded' };
  try {
    jsyaml.load(code);
    return { valid: true, info: 'Valid YAML' };
  } catch (e) {
    return { valid: false, line: (e.mark?.line ?? 0) + 1, col: (e.mark?.column ?? 0) + 1, message: e.message };
  }
}
function valHTML(code) {
  const doc = new DOMParser().parseFromString(code, 'text/html');
  const err = doc.querySelector('parsererror');
  return err ? { valid: false, message: err.textContent } : { valid: true, info: 'Valid HTML' };
}
function valXML(code) {
  const doc = new DOMParser().parseFromString(code, 'text/xml');
  const err = doc.querySelector('parsererror');
  return err ? { valid: false, message: err.textContent.trim() } : { valid: true, info: 'Valid XML' };
}
function valJS(code) {
  try { new Function(code); return { valid: true, info: 'Valid JavaScript syntax' }; }
  catch (e) { return { valid: false, message: e.message }; }
}
function valCSS(code) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(code);
    return { valid: true, info: `Valid CSS — ${sheet.cssRules.length} rules`, warning: 'Note: browsers silently drop invalid CSS rules' };
  } catch (e) { return { valid: true, info: 'CSS loaded', warning: 'Browsers silently ignore invalid CSS rules' }; }
}
function valDockerfile(code) {
  const VALID = new Set(['FROM','RUN','CMD','LABEL','EXPOSE','ENV','ADD','COPY','ENTRYPOINT','VOLUME','USER','WORKDIR','ARG','ONBUILD','STOPSIGNAL','HEALTHCHECK','SHELL','#']);
  let hasFrom = false;
  for (let i = 0; i < code.split('\n').length; i++) {
    const line = code.split('\n')[i].trim();
    if (!line || line.startsWith('#')) continue;
    const instr = line.split(/\s/)[0].toUpperCase();
    if (instr === 'FROM') hasFrom = true;
    if (!VALID.has(instr)) return { valid: false, line: i + 1, message: `Unknown Dockerfile instruction: ${instr}` };
  }
  if (!hasFrom) return { valid: false, message: 'Missing FROM instruction' };
  return { valid: true, info: 'Valid Dockerfile' };
}
function valEnv(code) {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || l.startsWith('#')) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(l)) return { valid: false, line: i + 1, message: `Invalid ENV format: "${l}"` };
  }
  return { valid: true, info: 'Valid ENV file' };
}
function valK8s(code) {
  const r = valYAML(code);
  if (!r.valid) return r;
  try {
    const obj = jsyaml.load(code);
    const missing = ['apiVersion','kind','metadata'].filter(k => !obj[k]);
    if (missing.length) return { valid: false, message: `Missing required fields: ${missing.join(', ')}` };
    return { valid: true, info: `Valid Kubernetes — kind: ${obj.kind}, apiVersion: ${obj.apiVersion}` };
  } catch (e) { return { valid: false, message: e.message }; }
}
function valCompose(code) {
  const r = valYAML(code);
  if (!r.valid) return r;
  try {
    const obj = jsyaml.load(code);
    if (!obj.services) return { valid: false, message: 'Missing required "services" key' };
    const n = Object.keys(obj.services).length;
    return { valid: true, info: `Valid Docker Compose — ${n} service${n !== 1 ? 's' : ''}` };
  } catch (e) { return { valid: false, message: e.message }; }
}
async function valPython(code) {
  try {
    const r = await fetch('/api/validator/python', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    return await r.json();
  } catch (e) { return { valid: false, message: 'Server error: ' + e.message }; }
}

async function runValidate() {
  const code = document.getElementById('val-input').value;
  const sel = document.getElementById('val-format').value;
  const out = document.getElementById('val-result');
  if (!code.trim()) { out.innerHTML = '<div class="val-placeholder">Paste code and click Validate…</div>'; return; }

  out.innerHTML = '<div class="val-placeholder">Validating…</div>';
  const fmt = sel === 'auto' ? detectFormat(code) : sel;
  const fmtNames = { json:'JSON', yaml:'YAML', javascript:'JavaScript', html:'HTML', xml:'XML', css:'CSS', python:'Python', dockerfile:'Dockerfile', env:'ENV File', k8s:'Kubernetes YAML', compose:'Docker Compose' };

  let result;
  switch (fmt) {
    case 'json':       result = valJSON(code); break;
    case 'yaml':       result = valYAML(code); break;
    case 'html':       result = valHTML(code); break;
    case 'xml':        result = valXML(code); break;
    case 'javascript': result = valJS(code); break;
    case 'css':        result = valCSS(code); break;
    case 'dockerfile': result = valDockerfile(code); break;
    case 'env':        result = valEnv(code); break;
    case 'k8s':        result = valK8s(code); break;
    case 'compose':    result = valCompose(code); break;
    case 'python':     result = await valPython(code); break;
    default:           result = { valid: false, message: 'Unknown format' };
  }

  const name = fmtNames[fmt] || fmt;
  const auto = sel === 'auto';
  let html = `<div class="val-badge ${result.valid ? 'valid' : 'invalid'}">
    ${result.valid ? '✓ Valid' : '✗ Invalid'} ${esc(name)}
    ${auto ? `<span class="val-auto-badge">auto-detected</span>` : ''}
  </div>`;
  if (result.valid) {
    if (result.info) html += `<div class="val-info">${esc(result.info)}</div>`;
    if (result.warning) html += `<div class="val-warning">⚠ ${esc(result.warning)}</div>`;
  } else {
    html += `<div class="val-error-detail">`;
    if (result.line) html += `<div class="val-error-loc">Line ${result.line}${result.col ? `, Col ${result.col}` : ''}</div>`;
    html += `<div class="val-error-msg">${esc(result.message || 'Syntax error')}</div></div>`;
  }
  out.innerHTML = html;
}

document.getElementById('val-input').addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); runValidate(); }
});



// ── Case Converter ────────────────────────────────────────────────────────
const TITLE_SMALL = new Set(['a','an','the','and','but','or','nor','for','so','yet','at','by','in','of','on','to','up','as','is','it']);

function convertCase(type) {
  const input = document.getElementById('cc-input').value;
  if (!input.trim()) return;

  let result = '';
  switch (type) {
    case 'sentence':
      result = input.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase());
      break;
    case 'lower':
      result = input.toLowerCase();
      break;
    case 'upper':
      result = input.toUpperCase();
      break;
    case 'capitalized':
      result = input.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      break;
    case 'alternating':
      result = input.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
      break;
    case 'title':
      result = input.toLowerCase().split(' ').map((word, i) => {
        const clean = word.replace(/^\W+|\W+$/g, '');
        if (i !== 0 && TITLE_SMALL.has(clean)) return word;
        return word.replace(/\b\w/, c => c.toUpperCase());
      }).join(' ');
      if (result.length) result = result[0].toUpperCase() + result.slice(1);
      break;
    case 'inverse':
      result = input.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
      break;
  }

  const labels = {
    sentence: 'Sentence case', lower: 'lower case', upper: 'UPPER CASE',
    capitalized: 'Capitalized Case', alternating: 'aLtErNaTiNg cAsE',
    title: 'Title Case', inverse: 'InVeRsE CaSe',
  };

  document.getElementById('cc-output').value = result;
  document.getElementById('cc-output-label').textContent = labels[type];
  document.getElementById('cc-output-wrap').style.display = 'block';
  document.getElementById('cc-copy-btn').textContent = 'Copy';
  document.getElementById('cc-copy-btn').classList.remove('copied');

  document.querySelectorAll('.cc-btn').forEach(b => b.classList.remove('active'));
  event.currentTarget.classList.add('active');
}

function copyCaseResult() {
  const text = document.getElementById('cc-output').value;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('cc-copy-btn');
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}


// ── CF Email Check ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('cfe-input');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') runCFEmail(); });
});

async function runCFEmail() {
  const domain = (document.getElementById('cfe-input').value || '').trim();
  const el = document.getElementById('cfe-results');
  if (!domain) return;
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p>Looking up…</p></div>`;
  try {
    const { ok, data } = await apiFetch(`/api/cfemail?domain=${encodeURIComponent(domain)}`);
    if (!ok) { el.innerHTML = `<div class="empty-state">${esc(data.error || 'Error')}</div>`; return; }
    renderCFEmail(data, el);
  } catch (e) { el.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; }
}

function renderCFEmail(data, el) {
  const nsChips = (data.nameservers || []).map(n => `<span class="cfe-ns-chip">${esc(n)}</span>`).join('');
  if (data.found) {
    el.innerHTML = `<div class="cfe-found">
      <div class="cfe-domain">${esc(data.domain)}</div>
      <div class="cfe-email-row">
        <span class="cfe-email-label">Contact Email</span>
        <span class="cfe-email-value">${esc(data.email)}</span>
        <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${esc(data.email)}').then(()=>showToast('Email copied!'))">Copy</button>
      </div>
      ${data.label ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Mapping: ${esc(data.label)}</div>` : ''}
      <div class="cfe-email-label" style="margin-bottom:6px">Name Servers</div>
      <div class="cfe-ns-list">${nsChips}</div>
    </div>`;
  } else {
    el.innerHTML = `<div class="cfe-unknown">
      <div class="cfe-domain">${esc(data.domain)}</div>
      <div class="cfe-unknown-msg">${esc(data.message || 'Unknown')}</div>
      ${nsChips ? `<div class="cfe-email-label" style="margin-bottom:6px">Name Servers</div><div class="cfe-ns-list">${nsChips}</div>` : ''}
    </div>`;
  }
}

// ── CF Mappings (Admin) ───────────────────────────────────────────────────
async function loadCFMappings() {
  const el = document.getElementById('adm-cfmappings-list');
  el.innerHTML = '<div style="color:var(--muted);font-size:13px">Loading…</div>';
  const r = await fetch('/api/admin/cf-mappings');
  const mappings = await r.json();
  if (!mappings.length) { el.innerHTML = '<div class="empty-state">No mappings yet. Click + New Mapping to add one.</div>'; return; }
  el.innerHTML = `<table class="adm-table">
    <thead><tr><th>Label</th><th>Name Servers</th><th>Email</th><th></th></tr></thead>
    <tbody>${mappings.map(m => `<tr>
      <td>${esc(m.label)}</td>
      <td><div class="cfe-ns-list">${(m.nameservers||[]).map(n=>`<span class="cfe-ns-chip">${esc(n)}</span>`).join('')}</div></td>
      <td><span style="font-family:var(--mono);font-size:12px">${esc(m.email)}</span></td>
      <td style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn btn-sm" onclick='openEditCFMapping(${JSON.stringify(m)})'>Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCFMapping('${esc(m.id)}')">Delete</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function openCreateCFMapping() {
  showModal(`<h3>New CF Mapping</h3>
    <div class="field-row"><label>Label</label><input class="adm-input" id="m-cflabel" placeholder="Client A" /></div>
    <div class="field-row"><label>Email</label><input class="adm-input" id="m-cfemail" type="email" placeholder="client@example.com" /></div>
    <div class="field-row"><label>Name Servers <span style="color:var(--muted)">(one per line)</span></label>
      <textarea class="adm-input" id="m-cfns" rows="4" placeholder="ada.ns.cloudflare.com&#10;elliot.ns.cloudflare.com" style="resize:vertical"></textarea></div>
    <div id="m-msg" class="adm-msg"></div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="submitCreateCFMapping()">Create</button>
    </div>`);
}

async function submitCreateCFMapping() {
  const label = document.getElementById('m-cflabel').value.trim();
  const email = document.getElementById('m-cfemail').value.trim();
  const nameservers = document.getElementById('m-cfns').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const msg = document.getElementById('m-msg');
  if (!label || !email || !nameservers.length) { msg.className='adm-msg err'; msg.textContent='All fields are required'; return; }
  const r = await fetch('/api/admin/cf-mappings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ label, email, nameservers }) });
  const d = await r.json();
  if (!r.ok) { msg.className='adm-msg err'; msg.textContent=d.error; return; }
  closeModal(); loadCFMappings();
}

function openEditCFMapping(m) {
  showModal(`<h3>Edit Mapping — ${esc(m.label)}</h3>
    <div class="field-row"><label>Label</label><input class="adm-input" id="m-cflabel" value="${esc(m.label)}" /></div>
    <div class="field-row"><label>Email</label><input class="adm-input" id="m-cfemail" type="email" value="${esc(m.email)}" /></div>
    <div class="field-row"><label>Name Servers <span style="color:var(--muted)">(one per line)</span></label>
      <textarea class="adm-input" id="m-cfns" rows="4" style="resize:vertical">${esc((m.nameservers||[]).join('\n'))}</textarea></div>
    <div id="m-msg" class="adm-msg"></div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="submitEditCFMapping('${esc(m.id)}')">Save</button>
    </div>`);
}

async function submitEditCFMapping(id) {
  const label = document.getElementById('m-cflabel').value.trim();
  const email = document.getElementById('m-cfemail').value.trim();
  const nameservers = document.getElementById('m-cfns').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const msg = document.getElementById('m-msg');
  const r = await fetch(`/api/admin/cf-mappings/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ label, email, nameservers }) });
  const d = await r.json();
  if (!r.ok) { msg.className='adm-msg err'; msg.textContent=d.error; return; }
  closeModal(); loadCFMappings();
}

async function deleteCFMapping(id) {
  if (!confirm('Delete this mapping?')) return;
  const r = await fetch(`/api/admin/cf-mappings/${id}`, { method: 'DELETE' });
  const d = await r.json();
  if (!r.ok) { showToast(d.error); return; }
  loadCFMappings();
}

// ── Boot ──────────────────────────────────────────────────────────────────
generatePasswords();
initAuth();
