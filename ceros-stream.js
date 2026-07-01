/* ================================================================
   CEROS STREAM — Savage Command Center v3
   SSE client for the SIA-v6 CEROS (Cognitive Event & Response
   Orchestration Stream) endpoint.

   Backend: configure CEROS_BASE below to point at whatever host
   you deploy the SIA-v6 agent backend to.
   NOT Cloud Run. NOT Google Cloud. Any host with SSE support.
   ================================================================ */
'use strict';

// ── CONFIG ──────────────────────────────────────────────────────
// Replace with your actual backend host when ready.
// Examples:
//   const CEROS_BASE = 'https://api.savage-ai-studios.com';
//   const CEROS_BASE = 'https://your-vps.example.com:8080';
//   const CEROS_BASE = 'http://localhost:8080';  // local dev
const CEROS_BASE = 'https://api.savage-ai-studios.com';  // TODO: set real host
const CEROS_PATH = '/api/v6/ceros/stream';

// ── STATE ────────────────────────────────────────────────────────
let cerosES     = null;   // active EventSource
let cerosActive = false;
const cerosBuffer = [];   // ring buffer — last 500 events
const RING_MAX  = 500;

// ── DOM REFS (resolved lazily so this file is safe to load early)
function el(id) { return document.getElementById(id); }

// ── CONNECT ──────────────────────────────────────────────────────
export function cerosConnect() {
  if (cerosES) cerosDisconnect();

  const url = CEROS_BASE + CEROS_PATH;
  cerosLog('CONNECTING → ' + url, 'info');
  updateDot('connecting');

  cerosES = new EventSource(url);

  cerosES.addEventListener('open', () => {
    cerosActive = true;
    updateDot('live');
    cerosLog('STREAM OPEN', 'ok');
    updateBtn(true);
  });

  // Default message event (unnamed)
  cerosES.addEventListener('message', (e) => handleEvent('message', e.data));

  // Named event types the backend may emit
  ['cri', 'fault', 'diamond', 'heartbeat', 'status', 'ontology'].forEach(evtName => {
    cerosES.addEventListener(evtName, (e) => handleEvent(evtName, e.data));
  });

  cerosES.addEventListener('error', (e) => {
    cerosActive = false;
    updateDot('error');
    cerosLog('STREAM ERROR — will retry automatically via EventSource', 'err');
    updateBtn(false);
  });
}

// ── DISCONNECT ───────────────────────────────────────────────────
export function cerosDisconnect() {
  if (cerosES) { cerosES.close(); cerosES = null; }
  cerosActive = false;
  updateDot('off');
  updateBtn(false);
  cerosLog('DISCONNECTED', 'info');
}

// ── EVENT HANDLER ────────────────────────────────────────────────
function handleEvent(type, raw) {
  let data;
  try { data = JSON.parse(raw); } catch(_) { data = { raw }; }

  const evt = { type, data, ts: Date.now() };
  cerosBuffer.push(evt);
  if (cerosBuffer.length > RING_MAX) cerosBuffer.shift();

  cerosLog('[' + type.toUpperCase() + '] ' + JSON.stringify(data).slice(0, 140), 'ok');

  // Route to specialized renderers
  if (type === 'cri')       renderCRI(data);
  if (type === 'fault')     renderFault(data);
  if (type === 'diamond')   renderDiamond(data);
  if (type === 'heartbeat') renderHeartbeat(data);
  if (type === 'status')    renderStatus(data);
}

// ── RENDERERS ────────────────────────────────────────────────────
function renderCRI(d) {
  // d = { value: 0.0–1.0, label: string }
  const bar = el('ceros-cri-bar');
  const val = el('ceros-cri-val');
  const lbl = el('ceros-cri-label');
  if (!bar) return;
  const pct = Math.min(100, Math.max(0, (d.value || 0) * 100));
  bar.style.width = pct + '%';
  bar.className = 'cri-fill cri-' + criColor(d.value);
  if (val) val.textContent = (d.value || 0).toFixed(4);
  if (lbl) lbl.textContent = d.label || '';
}

function criColor(v) {
  if (v >= 0.9) return 'green';
  if (v >= 0.7) return 'amber';
  return 'red';
}

function renderFault(d) {
  // d = { code: string, msg: string, severity: 'low'|'med'|'high' }
  const feed = el('ceros-fault-feed');
  if (!feed) return;
  const item = document.createElement('div');
  item.className = 'fault-card fault-' + (d.severity || 'low');
  item.innerHTML = '<span class="fault-code">' + (d.code || '?') + '</span> ' +
                   '<span class="fault-msg">' + (d.msg || '') + '</span>';
  feed.prepend(item);
  // Keep last 20
  while (feed.children.length > 20) feed.lastChild.remove();
}

function renderDiamond(d) {
  // d = { path: string, value: number }
  const feed = el('ceros-diamond-feed');
  if (!feed) return;
  const row = document.createElement('div');
  row.className = 'diamond-row';
  row.innerHTML = '<span class="diamond-path">' + (d.path || '—') + '</span>' +
                  '<span class="diamond-val">' + (d.value !== undefined ? Number(d.value).toExponential(4) : '—') + '</span>';
  feed.prepend(row);
  while (feed.children.length > 30) feed.lastChild.remove();
}

function renderHeartbeat(d) {
  const hb = el('ceros-heartbeat');
  if (!hb) return;
  hb.textContent = '♥ ' + new Date().toISOString().slice(11, 19);
  hb.classList.add('beat');
  setTimeout(() => hb.classList.remove('beat'), 400);
}

function renderStatus(d) {
  // d = { lambda: number, cycles: number, converged: number }
  const lam = el('ceros-lambda');
  const cyc = el('ceros-cycles');
  const conv = el('ceros-converged');
  if (lam && d.lambda !== undefined) lam.textContent = Number(d.lambda).toExponential(3);
  if (cyc && d.cycles !== undefined) cyc.textContent = d.cycles;
  if (conv && d.converged !== undefined) conv.textContent = d.converged;
}

// ── UI HELPERS ───────────────────────────────────────────────────
function updateDot(state) {
  const dot = el('ceros-dot');
  if (!dot) return;
  dot.className = 'ceros-dot dot-' + state;
}

function updateBtn(connected) {
  const btnOn  = el('ceros-connect-btn');
  const btnOff = el('ceros-disconnect-btn');
  if (btnOn)  btnOn.disabled  = connected;
  if (btnOff) btnOff.disabled = !connected;
}

function cerosLog(msg, type) {
  const feed = el('ceros-log');
  if (!feed) return;
  const line = document.createElement('div');
  line.className = 'log-' + (type || 'info');
  line.textContent = '[' + new Date().toISOString().slice(11, 23) + '] ' + msg;
  feed.appendChild(line);
  feed.scrollTop = feed.scrollHeight;
  // Trim log to 200 lines
  while (feed.children.length > 200) feed.firstChild.remove();
}

// ── EXPORTS (called from index.html onclick)
window.cerosConnect    = cerosConnect;
window.cerosDisconnect = cerosDisconnect;
