/* ================================================================
   CEROS STREAM BRIDGE — savage-command-center
   Consumes GET /api/stream from SIA-V6-CEROS and renders
   orchestrator cycles, founder decisions, diamond promotions,
   and spine events into the command center UI.

   Usage (in index.html):
     <script src="./ceros-stream.js"></script>
     <script>CerosStream.init();</script>

   Or with custom CEROS URL:
     window.CEROS_BASE_URL = 'http://192.168.1.100:3000';
     CerosStream.init();

   DOM targets (add these elements to index.html to activate panels):
     #ceros-status          — organism status badge
     #ceros-activity-log    — raw event stream log
     #ceros-founder-queue   — founder decision list
     #ceros-diamond-feed    — diamond promotion feed
     #ceros-spine-log       — spine promotion events
     #ceros-fault-log       — fault detections
     #ceros-cri-value       — CRI number display
     #ceros-connect-dot     — connection status dot
     #ceros-connect-label   — connection status label
   ================================================================ */
'use strict';

(function (global) {

  // ----------------------------------------------------------------
  // Config
  // ----------------------------------------------------------------
  const DEFAULT_BASE = 'http://localhost:3000';
  const MAX_LOG_LINES = 200;
  const MAX_DECISION_ROWS = 100;
  const MAX_DIAMOND_ROWS = 50;
  const RECONNECT_INITIAL_MS = 2000;
  const RECONNECT_MAX_MS = 30000;

  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  let _es = null;
  let _reconnectDelay = RECONNECT_INITIAL_MS;
  let _reconnectTimer = null;
  let _stats = {
    cycles: 0,
    decisions: 0,
    promotions: 0,
    faults: 0,
    connected: false,
  };

  // ----------------------------------------------------------------
  // DOM helpers
  // ----------------------------------------------------------------
  function el(id) { return document.getElementById(id); }

  function setConnectStatus(connected, label) {
    const dot = el('ceros-connect-dot');
    const lbl = el('ceros-connect-label');
    if (dot) dot.className = 'ceros-dot ' + (connected ? 'ceros-dot--on' : 'ceros-dot--off');
    if (lbl) lbl.textContent = label;
    _stats.connected = connected;
  }

  function appendLog(targetId, text, cssClass) {
    const log = el(targetId);
    if (!log) return;
    const line = document.createElement('div');
    line.className = 'ceros-log-line ' + (cssClass || '');
    line.textContent = '[' + new Date().toISOTimeString() + '] ' + text;
    log.appendChild(line);
    // Trim to max lines
    while (log.children.length > MAX_LOG_LINES) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  // Compact time string HH:MM:SS
  Date.prototype.toISOTimeString = function () {
    return this.toTimeString().slice(0, 8);
  };

  function updateStatusBadge(data) {
    const s = el('ceros-status');
    if (!s) return;
    const idle = data.idle ? ' [IDLE]' : '';
    s.textContent =
      'Cycles: ' + (data.cerosCycle || 0) +
      '  Evaluated: ' + (data.candidatesEvaluated || 0) +
      '  Queued: ' + (data.candidatesQueued || 0) +
      '  Decisions: ' + (data.founderDecisionsPending || 0) +
      idle;
  }

  function updateCRI(cri) {
    const criEl = el('ceros-cri-value');
    if (!criEl) return;
    const pct = Math.round((cri || 0) * 100);
    criEl.textContent = pct + '%';
    criEl.className = 'ceros-cri'
      + (pct >= 60 ? ' ceros-cri--healthy'
       : pct >= 35 ? ' ceros-cri--warn'
       : ' ceros-cri--critical');
  }

  function prependDecisionRow(decision) {
    const queue = el('ceros-founder-queue');
    if (!queue) return;
    const row = document.createElement('div');
    row.className = 'ceros-decision-row ceros-decision--' + (decision.decision || 'HOLD').toLowerCase();
    row.innerHTML =
      '<span class="ceros-decision-id">' + (decision.candidateId || '?').slice(0, 12) + '</span>' +
      '<span class="ceros-decision-type">' + (decision.decision || '—') + '</span>' +
      '<span class="ceros-decision-score">' +
        (decision.weightedScore !== undefined ? decision.weightedScore.toFixed(3) : '—') +
      '</span>' +
      '<span class="ceros-decision-repo">' + (decision.repo || '') + '</span>';
    queue.insertBefore(row, queue.firstChild);
    while (queue.children.length > MAX_DECISION_ROWS) queue.removeChild(queue.lastChild);
  }

  function prependDiamondRow(data) {
    const feed = el('ceros-diamond-feed');
    if (!feed) return;
    const tier = data.diamondTier || data.tier || '?';
    const composite = data.triadicScore?.composite ?? data.payload?.triadicScore?.composite ?? '?';
    const cid = (data.candidateId || data.id || '?').slice(0, 12);
    const row = document.createElement('div');
    row.className = 'ceros-diamond-row ceros-diamond--' + tier.toLowerCase();
    row.innerHTML =
      '<span class="ceros-diamond-tier">' + tier + '</span>' +
      '<span class="ceros-diamond-id">' + cid + '</span>' +
      '<span class="ceros-diamond-score">composite:' + composite + '</span>';
    feed.insertBefore(row, feed.firstChild);
    while (feed.children.length > MAX_DIAMOND_ROWS) feed.removeChild(feed.lastChild);
  }

  // ----------------------------------------------------------------
  // Event handlers
  // ----------------------------------------------------------------
  function handleEvent(type, raw) {
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }

    appendLog('ceros-activity-log', type + ' ' + JSON.stringify(data).slice(0, 120), 'ceros-log--' + type.replace(/[^a-z]/gi, '-').toLowerCase());

    switch (type) {

      case 'orchestrator:cycle':
        _stats.cycles++;
        updateStatusBadge(data);
        if (data.cri !== undefined) updateCRI(data.cri);
        break;

      case 'founder:decision':
        _stats.decisions++;
        prependDecisionRow(data);
        break;

      case 'diamond:candidate':
        _stats.promotions++;
        prependDiamondRow(data);
        appendLog('ceros-diamond-feed-log', '💎 ' + (data.candidateId || '?').slice(0, 12) + ' | ' + (data.diamondTier || '?'), 'ceros-log--diamond');
        break;

      case 'spine:promotion':
        _stats.promotions++;
        prependDiamondRow(data);
        appendLog('ceros-spine-log',
          'SPINE PROMOTION ' + (data.eventId || '?').slice(0, 16) +
          ' | ' + (data.sourceRepo || '?') +
          ' | CRI:' + (data.cri !== undefined ? (data.cri * 100).toFixed(0) + '%' : '?'),
          'ceros-log--spine'
        );
        break;

      case 'narrative:update':
        appendLog('ceros-activity-log', '📖 ' + (data.message || data.text || raw).slice(0, 160), 'ceros-log--narrative');
        break;

      case 'FAULT_DETECTED':
        _stats.faults++;
        appendLog('ceros-fault-log', '⚠ ' + (data.fault || data.message || raw).slice(0, 200), 'ceros-log--fault');
        appendLog('ceros-activity-log', '⚠ FAULT: ' + (data.fault || data.message || '').slice(0, 100), 'ceros-log--fault');
        break;

      case 'AGENT_WIRING_PROPOSED':
        appendLog('ceros-activity-log', '🔌 WIRING: ' + (data.agent || data.proposal || raw).slice(0, 120), 'ceros-log--wiring');
        break;

      default:
        // unknown event type — just log it
        break;
    }

    // Update stats display
    const statEl = el('ceros-stream-stats');
    if (statEl) {
      statEl.textContent =
        'Cycles:' + _stats.cycles +
        ' Decisions:' + _stats.decisions +
        ' Promotions:' + _stats.promotions +
        ' Faults:' + _stats.faults;
    }
  }

  // ----------------------------------------------------------------
  // Fetch organism status on demand
  // ----------------------------------------------------------------
  async function fetchOrganismStatus(baseUrl) {
    try {
      const r = await fetch(baseUrl + '/api/organism/status', {
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) return;
      const data = await r.json();
      updateStatusBadge(data);
      if (data.cri !== undefined) updateCRI(data.cri);
    } catch { /* ignore */ }
  }

  // ----------------------------------------------------------------
  // Connection
  // ----------------------------------------------------------------
  function connect() {
    const baseUrl = (global.CEROS_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
    const streamUrl = baseUrl + '/api/stream';

    setConnectStatus(false, 'CONNECTING...');
    appendLog('ceros-activity-log', 'Connecting to ' + streamUrl, 'ceros-log--info');

    if (_es) { try { _es.close(); } catch {} }

    _es = new EventSource(streamUrl);

    _es.onopen = () => {
      _reconnectDelay = RECONNECT_INITIAL_MS;
      setConnectStatus(true, 'LIVE — ' + baseUrl);
      appendLog('ceros-activity-log', '✓ Connected to CEROS stream', 'ceros-log--ok');
      fetchOrganismStatus(baseUrl);
    };

    _es.onmessage = (e) => {
      // Default message event (no type)
      handleEvent('message', e.data);
    };

    // Named event types from CEROS /api/stream
    const NAMED_EVENTS = [
      'orchestrator:cycle',
      'founder:decision',
      'diamond:candidate',
      'spine:promotion',
      'narrative:update',
      'FAULT_DETECTED',
      'AGENT_WIRING_PROPOSED',
    ];

    NAMED_EVENTS.forEach((type) => {
      _es.addEventListener(type, (e) => handleEvent(type, e.data));
    });

    _es.onerror = () => {
      setConnectStatus(false, 'DISCONNECTED — reconnecting in ' + (_reconnectDelay / 1000).toFixed(0) + 's...');
      appendLog('ceros-activity-log', 'SSE connection lost. Reconnecting in ' + (_reconnectDelay / 1000).toFixed(0) + 's.', 'ceros-log--warn');
      _es.close();
      _es = null;
      clearTimeout(_reconnectTimer);
      _reconnectTimer = setTimeout(() => {
        _reconnectDelay = Math.min(_reconnectDelay * 2, RECONNECT_MAX_MS);
        connect();
      }, _reconnectDelay);
    };
  }

  function disconnect() {
    clearTimeout(_reconnectTimer);
    if (_es) { _es.close(); _es = null; }
    setConnectStatus(false, 'DISCONNECTED');
  }

  function getStats() { return Object.assign({}, _stats); }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------
  global.CerosStream = {
    /**
     * init(options?)
     * options.baseUrl  — override CEROS base URL (default: window.CEROS_BASE_URL or http://localhost:3000)
     * options.autoConnect — connect immediately (default: true)
     */
    init(options) {
      const opts = options || {};
      if (opts.baseUrl) global.CEROS_BASE_URL = opts.baseUrl;
      if (opts.autoConnect !== false) connect();
    },
    connect,
    disconnect,
    getStats,
    fetchOrganismStatus: () => fetchOrganismStatus(global.CEROS_BASE_URL || DEFAULT_BASE),
  };

})(window);
