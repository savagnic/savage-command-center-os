/* ================================================================
   CEROS STREAM — savage-command-center
   SSE client for SIA-v6 CEROS endpoint
   Wires into #panel-ceros DOM elements defined in index.html
   ================================================================ */
'use strict';

(function() {

  const CEROS_BASE = (typeof window.CEROS_BASE_URL !== 'undefined')
    ? window.CEROS_BASE_URL
    : 'https://sia-v6-agent-1005695038224.us-central1.run.app';

  let _es = null;
  let _stats = { received: 0, promotions: 0, faults: 0, cycles: 0 };

  // ── DOM helpers ────────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  function setDot(state) {
    // state: 'connecting' | 'live' | 'error' | 'closed'
    const dot   = el('ceros-connect-dot');
    const label = el('ceros-connect-label');
    if (!dot || !label) return;
    dot.className = 'ceros-dot ceros-dot--' + state;
    const labels = { connecting: 'CONNECTING…', live: 'LIVE', error: 'ERROR', closed: 'CLOSED' };
    label.textContent = labels[state] || state.toUpperCase();
  }

  function setStatus(text, cls) {
    const s = el('ceros-status');
    if (!s) return;
    s.textContent = text;
    s.className = 'ceros-status-val ' + (cls || '');
  }

  function appendLog(containerId, text, cls) {
    const box = el(containerId);
    if (!box) return;
    const line = document.createElement('div');
    line.className = cls || '';
    line.textContent = '[' + new Date().toISOString().slice(11,23) + '] ' + text;
    box.appendChild(line);
    // Rolling window — keep last 200 lines
    while (box.children.length > 200) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  function updateStats() {
    const s = el('ceros-stream-stats');
    if (s) s.textContent =
      'rx:' + _stats.received +
      '  promo:' + _stats.promotions +
      '  fault:' + _stats.faults +
      '  cycle:' + _stats.cycles;
  }

  // ── Event handlers ─────────────────────────────────────────────
  function onPromotion(data) {
    _stats.promotions++;
    try {
      const d = JSON.parse(data);
      appendLog('ceros-spine-log',
        (d.tier || '?') + ' ← ' + (d.agent || '?') + '  ' + (d.payload || ''),
        'log-ok');
      // Diamond feed
      const feed = el('ceros-diamond-feed');
      if (feed && d.tier) {
        const badge = document.createElement('span');
        badge.className = 'ceros-diamond ceros-diamond--' + (d.tier || 'base').toLowerCase();
        badge.textContent = d.tier;
        feed.prepend(badge);
        while (feed.children.length > 20) feed.removeChild(feed.lastChild);
      }
    } catch(e) {
      appendLog('ceros-spine-log', data, 'log-ok');
    }
  }

  function onFault(data) {
    _stats.faults++;
    try {
      const d = JSON.parse(data);
      appendLog('ceros-fault-log',
        (d.code || 'FAULT') + '  ' + (d.message || data),
        'log-reject');
    } catch(e) {
      appendLog('ceros-fault-log', data, 'log-reject');
    }
    setStatus('FAULT DETECTED', 'ceros-status--fault');
  }

  function onCycle(data) {
    _stats.cycles++;
    try {
      const d = JSON.parse(data);
      appendLog('ceros-stream-log',
        'cycle#' + (d.cycle || _stats.cycles) +
        '  cri=' + (d.cri !== undefined ? (+d.cri).toFixed(4) : '—') +
        '  agents=' + (d.agents || '—'),
        'log-info');
      // CRI value
      const cri = el('ceros-cri-value');
      if (cri && d.cri !== undefined) {
        const v = +d.cri;
        cri.textContent = v.toFixed(4);
        cri.className = 'ceros-cri-val ' +
          (v >= 0.8 ? 'cri-green' : v >= 0.5 ? 'cri-yellow' : 'cri-red');
      }
      setStatus('RUNNING', 'ceros-status--ok');
    } catch(e) {
      appendLog('ceros-stream-log', data, 'log-info');
    }
  }

  function onFounderDecision(data) {
    try {
      const d = JSON.parse(data);
      appendLog('ceros-founder-queue',
        (d.decision || 'DECISION') + '  ' + (d.rationale || data),
        'log-ok');
    } catch(e) {
      appendLog('ceros-founder-queue', data, 'log-ok');
    }
  }

  // ── Core SSE logic ─────────────────────────────────────────────
  function connect() {
    if (_es) return;   // already open
    setDot('connecting');
    setStatus('CONNECTING', '');

    _es = new EventSource(CEROS_BASE + '/api/v6/ceros/stream');

    _es.addEventListener('open', function() {
      setDot('live');
      setStatus('LIVE', 'ceros-status--ok');
      appendLog('ceros-stream-log', 'SSE connection opened → ' + CEROS_BASE, 'log-ok');
    });

    _es.addEventListener('error', function() {
      setDot('error');
      setStatus('ERROR — retrying', 'ceros-status--fault');
      appendLog('ceros-stream-log', 'SSE error / reconnecting…', 'log-reject');
    });

    // Named event types
    _es.addEventListener('spine:promotion',  function(e) { _stats.received++; onPromotion(e.data);       updateStats(); });
    _es.addEventListener('FAULT_DETECTED',   function(e) { _stats.received++; onFault(e.data);           updateStats(); });
    _es.addEventListener('cycle:complete',   function(e) { _stats.received++; onCycle(e.data);           updateStats(); });
    _es.addEventListener('founder:decision', function(e) { _stats.received++; onFounderDecision(e.data); updateStats(); });

    // Fallback: unnamed message events
    _es.addEventListener('message', function(e) {
      _stats.received++;
      appendLog('ceros-stream-log', e.data, 'log-info');
      updateStats();
    });
  }

  function destroy() {
    if (_es) { _es.close(); _es = null; }
    setDot('closed');
    setStatus('DISCONNECTED', '');
  }

  // ── Public API ─────────────────────────────────────────────────
  window.CerosStream = { init: connect, destroy: destroy };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }

})();
