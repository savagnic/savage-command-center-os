/* ================================================================
   DIAMOND FEED — Savage Command Center
   Live breakthrough promotion feed from the organism.
   Polls polygraph-v3 organism health + surfaces DiamondMiner results.
   ================================================================ */
'use strict';

// ================================================================
// DIAMOND FEED STATE
// ================================================================
const DIAMOND_STATE = {
  promotions: [],
  lastPoll: null,
  pollInterval: null,
  health: null
};

// Constitutional law tiers
const TIER_CONFIG = {
  FLAWLESS: { emoji: '💎', color: '#00ff88', label: 'FLAWLESS', minScore: 85 },
  POLISHED: { emoji: '✨', color: '#88aaff', label: 'POLISHED', minScore: 70 },
  CUT:      { emoji: '🔷', color: '#ffcc44', label: 'CUT',      minScore: 55 },
  ROUGH:    { emoji: '🪨', color: '#888888', label: 'ROUGH',    minScore: 0  }
};

function getTier(composite) {
  if (composite >= 85) return TIER_CONFIG.FLAWLESS;
  if (composite >= 70) return TIER_CONFIG.POLISHED;
  if (composite >= 55) return TIER_CONFIG.CUT;
  return TIER_CONFIG.ROUGH;
}

// ================================================================
// ORGANISM HEALTH POLL
// Polls the organism-core API health endpoint
// ================================================================
const ORGANISM_CORE_BASE = 'https://sia-v6-agent-1005695038224.us-central1.run.app';

async function pollOrganismHealth() {
  const el = document.getElementById('df-health-value');
  const tsEl = document.getElementById('df-health-ts');
  try {
    const r = await fetch(ORGANISM_CORE_BASE + '/system/health', {
      method: 'GET',
      signal: AbortSignal.timeout(4000)
    });
    const data = r.ok ? await r.json() : null;
    const score = data?.health ?? data?.score ?? data?.organism_health ?? null;
    if (el) {
      el.textContent = score !== null ? score.toFixed(3) : 'OFFLINE';
      el.style.color = score !== null && score >= 0.8 ? 'var(--green)' : 'var(--amber)';
    }
    if (tsEl) tsEl.textContent = new Date().toLocaleTimeString();
    DIAMOND_STATE.health = score;
  } catch (e) {
    if (el) { el.textContent = 'OFFLINE'; el.style.color = 'var(--red)'; }
    if (tsEl) tsEl.textContent = new Date().toLocaleTimeString();
  }
}

// ================================================================
// INJECT MOCK PROMOTIONS (seed the feed on load)
// In production these come from the organism event bus WebSocket.
// ================================================================
function seedDemoPromotions() {
  const demos = [
    {
      id: 'BT-' + Date.now() + '-001',
      title: 'Autonomous Agent Pay Loop — Zero-Trust Micropayment Rail',
      domain: 'agentic',
      origin: 'CEROS/agent-shell',
      score: 92,
      triadicScore: { novelty: 88, utility: 94, feasibility: 85, composite: 90 },
      timestamp: Date.now() - 120000,
      metadata: { language: 'typescript', runtimeTarget: 'organism-core' }
    },
    {
      id: 'BT-' + Date.now() + '-002',
      title: 'Constitutional Spine Self-Audit — Laws Verified at Runtime',
      domain: 'orchestration',
      origin: 'Breakthrough-System/constitutional',
      score: 87,
      triadicScore: { novelty: 82, utility: 88, feasibility: 90, composite: 87 },
      timestamp: Date.now() - 60000,
      metadata: { language: 'typescript', causalChain: true }
    },
    {
      id: 'BT-' + Date.now() + '-003',
      title: 'Triadic Scoring Auto-Calibration via GELE Feedback Loop',
      domain: 'ai',
      origin: 'Breakthrough-System/triadic',
      score: 76,
      triadicScore: { novelty: 72, utility: 78, feasibility: 74, composite: 75 },
      timestamp: Date.now() - 10000,
      metadata: { iterationCount: 12, language: 'typescript' }
    }
  ];
  demos.forEach(ingestPromotion);
}

// ================================================================
// INGEST PROMOTION
// Called when a DiamondMiner PASS event arrives
// ================================================================
function ingestPromotion(candidate) {
  // Deduplicate
  if (DIAMOND_STATE.promotions.find(p => p.id === candidate.id)) return;
  DIAMOND_STATE.promotions.unshift(candidate);
  // Keep last 50
  if (DIAMOND_STATE.promotions.length > 50) DIAMOND_STATE.promotions.pop();
  renderFeed();
  updateFeedBadge();
}

// ================================================================
// RENDER FEED
// ================================================================
function renderFeed() {
  const container = document.getElementById('df-feed-list');
  if (!container) return;
  container.innerHTML = '';

  if (DIAMOND_STATE.promotions.length === 0) {
    container.innerHTML = '<div class="df-empty">No promotions yet. Feed is live.</div>';
    return;
  }

  DIAMOND_STATE.promotions.forEach(c => {
    const tier = getTier(c.triadicScore?.composite ?? c.score);
    const age = formatAge(Date.now() - c.timestamp);
    const composite = c.triadicScore?.composite ?? c.score;
    const novelty = c.triadicScore?.novelty ?? '—';
    const utility = c.triadicScore?.utility ?? '—';
    const feasibility = c.triadicScore?.feasibility ?? '—';

    const card = document.createElement('div');
    card.className = 'df-card df-tier-' + tier.label.toLowerCase();
    card.innerHTML = `
      <div class="df-card__header">
        <span class="df-tier-badge" style="color:${tier.color}">${tier.emoji} ${tier.label}</span>
        <span class="df-card__age">${age}</span>
      </div>
      <div class="df-card__title">${escHtml(c.title)}</div>
      <div class="df-card__meta">
        <span class="df-meta-item">📦 ${escHtml(c.domain)}</span>
        <span class="df-meta-item">🔗 ${escHtml(c.origin)}</span>
      </div>
      <div class="df-card__scores">
        <span class="df-score" title="Composite">⚡ ${composite}</span>
        <span class="df-score" title="Novelty">🔬 N:${novelty}</span>
        <span class="df-score" title="Utility">💰 U:${utility}</span>
        <span class="df-score" title="Feasibility">🔧 F:${feasibility}</span>
      </div>
      <div class="df-card__id">${escHtml(c.id)}</div>
    `;
    container.appendChild(card);
  });
}

function formatAge(ms) {
  if (ms < 60000) return Math.round(ms / 1000) + 's ago';
  if (ms < 3600000) return Math.round(ms / 60000) + 'm ago';
  return Math.round(ms / 3600000) + 'h ago';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function updateFeedBadge() {
  const badge = document.getElementById('df-tab-badge');
  if (badge) badge.textContent = DIAMOND_STATE.promotions.length;
}

// ================================================================
// WEBSOCKET STUB — connects to organism event bus
// Replace ORGANISM_WS_URL with actual ws:// endpoint when live
// ================================================================
const ORGANISM_WS_URL = null; // set to 'ws://your-organism-bus/diamond-feed' when live

function connectDiamondWebSocket() {
  if (!ORGANISM_WS_URL) return; // not yet configured
  const ws = new WebSocket(ORGANISM_WS_URL);
  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      if (event.type === 'DIAMOND_PROMOTION' && event.candidate) {
        ingestPromotion(event.candidate);
      }
    } catch(_) {}
  };
  ws.onclose = () => setTimeout(connectDiamondWebSocket, 5000); // auto-reconnect
}

// ================================================================
// INIT
// ================================================================
window.initDiamondFeed = function() {
  seedDemoPromotions();
  renderFeed();
  updateFeedBadge();
  pollOrganismHealth();
  // Poll health every 30s
  DIAMOND_STATE.pollInterval = setInterval(pollOrganismHealth, 30000);
  // Connect WebSocket when available
  connectDiamondWebSocket();
  console.log('[DIAMOND-FEED] Initialized — ' + DIAMOND_STATE.promotions.length + ' promotions seeded');
};

// Manual refresh button
window.refreshDiamondFeed = function() {
  pollOrganismHealth();
  renderFeed();
  const btn = document.getElementById('df-refresh-btn');
  if (btn) { btn.textContent = '↻ REFRESHED'; setTimeout(() => btn.textContent = '↻ REFRESH', 1500); }
};

// Expose for external injection (e.g. from CEROS DiamondMiner)
window.ingestDiamondPromotion = ingestPromotion;
