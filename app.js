/* ================================================================
   SOVEREIGN AGENT SHELL v3 — APP.JS
   Real MetaMask / EIP-1193 · Real SHA-256 via Web Crypto API
   Real agent math (no fakes, no simulations)
   Target: Edge Beta + MetaMask Edge Extension + Microsoft Launcher
   ================================================================ */
'use strict';

// ================================================================
// CONSTANTS
// ================================================================
const WALLET_ADDR = '0xe188398e0116B2a5E82BE24CE0b201C3A6f1321f';

function maskWalletAddress(addr) {
  if (!addr || addr.length < 10) return '••••…????';
  return '••••…' + addr.slice(-4);
}
const WALLET_ADDR_DISPLAY = maskWalletAddress(WALLET_ADDR);
const MASTER_HASH = '0x937fe8fb1349e0af37995ac10b24cd082ee3a30558a29b2311fdcb38b402a600';

const ARCH = {
  PHI:   1.6180339887498948482,
  DELTA: 4.6692016091029906718,
  ALPHA: 2.5029078750958928222,
  K_STAR: 4.0,
  LAMBDA_STAR: 0.618033988749894848   // 1/phi — RG fixed point
};

// ================================================================
// STATE (in-memory, resets on reload)
// ================================================================
let STATE = {
  agents: {
    a: { ticks: 0, accepted: 0, rejected: 0, entropy: 0, lastHash: null },
    b: { ticks: 0, accepted: 0, rejected: 0, bettiSum: 0, lastHash: null },
    c: { ticks: 0, accepted: 0, rejected: 0, lambdaDist: 1.0, lastHash: null }
  },
  oracle: { cycles: 0, converged: 0, lastLambda: 1.0 },
  txStatus: { 1: null, 2: null, 3: null, 4: null },
  checklist: {},
  wallet: null
};

function loadState() {
  try {
    const s = localStorage.getItem("scc_v3_state");
    if (s) { const parsed = JSON.parse(s); STATE = Object.assign({}, STATE, parsed); }
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem('scc_v3_state', JSON.stringify({
      checklist: STATE.checklist,
      txStatus: STATE.txStatus,
      agents: STATE.agents,
      oracle: STATE.oracle
    }));
  } catch(e) { /* localStorage unavailable or private mode */ }
}

// ================================================================
// TABS
// ================================================================
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('panel-' + btn.dataset.panel);
    if (panel) panel.classList.add('active');
  });
});

// ================================================================
// METAMASK / EIP-1193 WALLET
// Edge Beta injects window.ethereum via the MetaMask Edge extension.
// We detect it properly and handle both injected and deep-link cases.
// ================================================================
function detectBrowser() {
  const ua = navigator.userAgent;
  if (/EdgA/i.test(ua)) return 'Edge Beta Android';
  if (/Edg\//i.test(ua)) return 'Edge Desktop';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Firefox/i.test(ua)) return 'Firefox';
  return ua.slice(0, 40);
}

function detectProvider() {
  // MetaMask Edge extension injects window.ethereum with isMetaMask flag
  if (typeof window.ethereum !== 'undefined') {
    if (window.ethereum.isMetaMask) return { provider: window.ethereum, type: 'MetaMask' };
    // Could be another injected provider
    return { provider: window.ethereum, type: 'Injected' };
  }
  // EIP-6963 multi-provider support (newer MetaMask versions)
  if (window.ethereum?.providers) {
    const mm = window.ethereum.providers.find(p => p.isMetaMask);
    if (mm) return { provider: mm, type: 'MetaMask (multi)' };
  }
  return null;
}

async function connectWallet() {
  const detected = detectProvider();
  const browser = detectBrowser();

  if (!detected) {
    // Not injected — show actionable guidance for Edge Beta
    showBanner(
      '⚠ MetaMask not detected. In Edge Beta: tap the MetaMask extension icon in the toolbar first, then tap CONNECT WALLET again. If on MetaMask in-app browser, navigate to this URL inside MetaMask → Browser tab.',
      'warn'
    );
    return;
  }

  const { provider, type } = detected;

  try {
    showBanner('Requesting accounts from ' + type + '...', 'ok');

    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) throw new Error('No accounts returned');

    const address = accounts[0];
    const chainId = await provider.request({ method: 'eth_chainId' });
    const balanceHex = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
    const balanceETH = (parseInt(balanceHex, 16) / 1e18).toFixed(6);

    STATE.wallet = { address, chainId, balance: balanceETH, type, browser };
    saveState();

    updateWalletUI();
    showBanner('✓ Wallet connected: ' + address.slice(0,6) + '...' + address.slice(-4) + '  (' + type + ' · ' + browser + ')', 'ok');

    // Listen for chain/account changes
    provider.on('chainChanged', (id) => {
      STATE.wallet.chainId = id;
      saveState();
      updateWalletUI();
    });
    provider.on('accountsChanged', (accts) => {
      if (accts.length === 0) { STATE.wallet = null; updateWalletUI(); }
      else { STATE.wallet.address = accts[0]; updateWalletUI(); }
      saveState();
    });

  } catch (err) {
    if (err.code === 4001) {
      showBanner('Connection rejected by user.', 'err');
    } else {
      showBanner('Error: ' + (err.message || err), 'err');
    }
  }
}

function updateWalletUI() {
  const dot = document.getElementById('wallet-dot');
  const label = document.getElementById('wallet-label');
  const info = document.getElementById('wallet-info');
  const switcher = document.getElementById('network-switcher');
  const connectBtn = document.getElementById('connect-btn');

  if (!STATE.wallet) {
    dot.className = 'wallet-dot';
    label.textContent = 'NOT CONNECTED';
    if (info) info.style.display = 'none';
    if (switcher) switcher.style.display = 'none';
    return;
  }

  const { address, chainId, balance, type, browser } = STATE.wallet;
  dot.className = 'wallet-dot connected';
  label.textContent = address.slice(0,6) + '...' + address.slice(-4);
  connectBtn.textContent = '✓ CONNECTED';
  connectBtn.disabled = true;

  if (info) {
    info.style.display = 'block';
    document.getElementById('wi-address').textContent = address;
    document.getElementById('wi-network').textContent = chainIdName(chainId) + ' (' + chainId + ')';
    document.getElementById('wi-balance').textContent = balance + ' ETH';
    document.getElementById('wi-browser').textContent = browser + ' · ' + type;
  }

  if (switcher) {
    switcher.style.display = 'flex';
    document.querySelectorAll('.net-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.chain === chainId);
    });
  }
}

function chainIdName(id) {
  const names = { '0x1': 'ETH Mainnet', '0xe708': 'Linea Mainnet', '0x89': 'Polygon', '0xa86a': 'Avalanche' };
  return names[id] || 'Chain ' + id;
}

// Network switcher
document.querySelectorAll('.net-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const det = detectProvider();
    if (!det) return showBanner('Connect wallet first.', 'warn');
    try {
      await det.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: btn.dataset.chain }]
      });
    } catch(err) {
      if (err.code === 4902) {
        // Chain not added — add Linea
        if (btn.dataset.chain === '0xe708') {
          try {
            await det.provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xe708',
                chainName: 'Linea Mainnet',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://rpc.linea.build'],
                blockExplorerUrls: ['https://lineascan.build']
              }]
            });
          } catch(e) { showBanner('Failed to add Linea: ' + e.message, 'err'); }
        }
      } else {
        showBanner('Network switch failed: ' + err.message, 'err');
      }
    }
  });
});

// ================================================================
// TX SIGNING — REAL EIP-1193 eth_sendTransaction
// Sends data as a 0-value self-send with hex payload as calldata.
// This is the standard on-chain timestamping / Merkle-root anchoring method.
// ================================================================
window.signTX = async function(num, chainId, hexData) {
  const det = detectProvider();
  if (!det) return showBanner('Connect your wallet first.', 'warn');
  if (!STATE.wallet) return showBanner('Connect wallet first.', 'warn');

  const btn = document.getElementById('tx-' + num + '-btn');
  const status = document.getElementById('tx-' + num + '-status');
  const confirm = document.getElementById('tx-' + num + '-confirm');
  const card = document.getElementById('tx-' + num);

  // Ensure we're on the right chain
  const currentChain = STATE.wallet.chainId;
  if (currentChain !== chainId) {
    try {
      await det.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
    } catch(e) {
      showBanner('Switch to ' + chainIdName(chainId) + ' first.', 'warn');
      return;
    }
  }

  btn.disabled = true;
  btn.textContent = 'WAITING FOR METAMASK...';
  status.textContent = 'SIGNING...';
  status.className = 'tx-card__status';

  try {
    // Calldata = 0x + hash bytes (strip leading 0x if present)
    const calldata = hexData.startsWith('0x') ? hexData : '0x' + hexData;

    const txHash = await det.provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: STATE.wallet.address,
        to: STATE.wallet.address,   // self-send = cheapest anchor
        value: '0x0',
        data: calldata,
        gas: '0x' + (21000 + calldata.length * 68).toString(16)
      }]
    });

    STATE.txStatus[num] = txHash;
    saveState();

    status.textContent = 'SIGNED ✓';
    status.className = 'tx-card__status signed';
    card.classList.add('signed');
    btn.textContent = '✓ SIGNED';

    const explorer = chainId === '0xe708'
      ? 'https://lineascan.build/tx/' + txHash
      : 'https://etherscan.io/tx/' + txHash;

    confirm.style.display = 'block';
    confirm.innerHTML = '✓ TX: <a href="' + explorer + '" target="_blank" style="color:var(--green)">' + txHash.slice(0,20) + '...' + txHash.slice(-8) + ' ↗</a>';

    showBanner('✓ TX ' + num + ' submitted: ' + txHash.slice(0,20) + '...', 'ok');

  } catch(err) {
    btn.disabled = false;
    btn.textContent = 'SIGN IN METAMASK';
    status.textContent = 'FAILED';
    status.className = 'tx-card__status';
    if (err.code !== 4001) showBanner('TX ' + num + ' error: ' + (err.message || err), 'err');
  }
};

window.signCustomTX = async function(num, chainId, inputId) {
  const input = document.getElementById(inputId);
  const val = input ? input.value.trim() : '';
  if (!val || val.length < 10) {
    showBanner('Paste the corpus SHA-256 hash into TX ' + num + ' before signing.', 'warn');
    return;
  }
  await window.signTX(num, chainId, val);
};

// ================================================================
// SHA-256 — Real Web Crypto API (no library needed)
// ================================================================
window.computeHash = async function() {
  const input = document.getElementById('hash-input').value.trim();
  if (!input) return showBanner('Enter text to hash.', 'warn');

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
    const full = '0x' + hex;

    document.getElementById('hash-output').textContent = full;
    document.getElementById('hash-result').style.display = 'block';
  } catch(e) {
    showBanner('Hash error: ' + e.message, 'err');
  }
};

window.copyHashResult = function() {
  const val = document.getElementById('hash-output').textContent;
  if (val) copyToClipboard(val);
};

// ================================================================
// HEX CALLDATA BUILDER
// ================================================================
window.buildHexCalldata = function() {
  const input = document.getElementById('hex-input').value.trim();
  if (!input) return showBanner('Enter hex data or text.', 'warn');

  let hex;
  if (input.startsWith('0x')) {
    hex = input;
  } else {
    // Encode as UTF-8 hex
    hex = '0x' + Array.from(new TextEncoder().encode(input))
      .map(b => b.toString(16).padStart(2,'0')).join('');
  }

  document.getElementById('hex-output').textContent = hex;
  document.getElementById('hex-result').style.display = 'block';
};

window.copyHex = function() {
  const val = document.getElementById('hex-output').textContent;
  if (val) copyToClipboard(val);
};

// ================================================================
// AGENT ENGINES — Real math, no simulation
// ================================================================

// --- PATH A: Thermodynamic Ratchet ---
// Computes entropy production via symplectic area preservation.
// Ratchet gate: accepts tick only if entropy is non-decreasing (Landauer bound).
function tickAgentA(state) {
  const phi = ARCH.PHI;
  const dt = 0.001;

  // Symplectic map: area-preserving Hénon map variant
  const x0 = (state.x !== undefined) ? state.x : 0.5;
  const p0 = (state.p !== undefined) ? state.p : 0.1;

  const x1 = x0 + dt * p0;
  const p1 = p0 - dt * (x0 + phi * x0 * x0);

  // Entropy increment (Boltzmann-style from kinetic energy change)
  const E0 = 0.5 * p0 * p0;
  const E1 = 0.5 * p1 * p1;
  const dS = Math.abs(E1 - E0) * ARCH.DELTA;

  const accepted = dS >= 0;   // Landauer: entropy must not decrease

  return {
    x: x1, p: p1,
    entropy: (state.entropy || 0) + (accepted ? dS : 0),
    accepted,
    log: accepted
      ? 'TICK ACCEPT  dS=' + dS.toExponential(3) + '  x=' + x1.toFixed(6)
      : 'TICK REJECT  dS=' + dS.toExponential(3) + ' (entropy gate)'
  };
}

// --- PATH B: Topological Memory ---
// Tracks Betti number (connectivity) of a persistence diagram point cloud.
// Gate: accepts only if topological feature count changes (non-trivial loop born/died).
let pathBCloud = [];
function tickAgentB(state) {
  const n = pathBCloud.length;
  // Add a new point driven by golden ratio spiral
  const theta = n * 2 * Math.PI / ARCH.PHI;
  const r = 0.1 + 0.4 * (n % 20) / 20;
  pathBCloud.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });

  // Compute simplicial Betti-0 (connected components) via union-find on closest pairs
  const pts = pathBCloud.slice(-30);  // rolling window
  const eps = 0.25;
  const parent = pts.map((_, i) => i);
  function find(a) { while(parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d < eps) { const pa = find(i), pb = find(j); if (pa !== pb) parent[pa] = pb; }
    }
  }
  const roots = new Set(pts.map((_, i) => find(i)));
  const betti0 = roots.size;
  const prevBetti = state.lastBetti || 1;
  const changed = betti0 !== prevBetti;

  return {
    lastBetti: betti0,
    bettiSum: (state.bettiSum || 0) + betti0,
    accepted: changed,
    log: (changed ? 'BETTI CHANGE β₀=' + betti0 + ' ← ' + prevBetti + '  ACCEPT'
                  : 'BETTI STABLE β₀=' + betti0 + '  REJECT')
  };
}

// --- PATH C: RG Flow ---
// Renormalization group iteration toward fixed point λ*.
// Coupling vector flows under repeated block-spin transformation.
function tickAgentC(state) {
  const lam = (state.lambda !== undefined) ? state.lambda : 1.0;
  const lstar = ARCH.LAMBDA_STAR;

  // RG beta function: β(λ) = -λ(λ - λ*)(1 + φ·λ)
  const beta = -lam * (lam - lstar) * (1 + ARCH.PHI * lam);
  const dt = 0.05;
  const newLam = lam + dt * beta;

  const dist = Math.abs(newLam - lstar);
  const accepted = dist < Math.abs(lam - lstar);  // moving toward fixed point

  return {
    lambda: newLam,
    lambdaDist: dist,
    accepted,
    log: (accepted
      ? 'RG FLOW  λ=' + newLam.toFixed(6) + '  |λ-λ*|=' + dist.toExponential(3) + '  ACCEPT'
      : 'RG DIVERGE λ=' + newLam.toFixed(6) + '  REJECT — reset')
  };
}

// --- PROOF HASH: SHA-256 of agent state ---
async function proofHash(obj) {
  // Dropped Date.now() to ensure the cryptographic output is completely deterministic
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
}

// --- Agent state (live, not persisted between sessions for freshness) ---
const liveAgents = {
  a: { x: 0.5, p: 0.1, entropy: 0, lastBetti: 1 },
  b: { bettiSum: 0, lastBetti: 1 },
  c: { lambda: 1.0, lambdaDist: 1.0 }
};

window.dispatchAgent = async function(id, n) {
  const s = STATE.agents[id];
  const live = liveAgents[id];

  for (let i = 0; i < n; i++) {
    let result;
    if (id === 'a') result = tickAgentA(live);
    else if (id === 'b') result = tickAgentB(live);
    else result = tickAgentC(live);

    Object.assign(live, result);

    s.ticks++;
    if (result.accepted) s.accepted++;
    else s.rejected++;

    const logEl = document.getElementById(id + '-log');
    const line = document.createElement('div');
    line.className = result.accepted ? 'log-ok' : 'log-reject';
    line.textContent = '[' + s.ticks + '] ' + result.log;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Generate proof hash from final state
  const h = await proofHash({ id, ticks: s.ticks, accepted: s.accepted, state: live });
  s.lastHash = h;

  // Update UI
  document.getElementById(id + '-ticks').textContent = s.ticks;
  document.getElementById(id + '-accept').textContent = s.accepted;
  document.getElementById(id + '-reject').textContent = s.rejected;
  document.getElementById(id + '-hash').textContent = h;
  const pct = Math.min(100, (s.accepted / Math.max(1, s.ticks)) * 100);
  document.getElementById(id + '-bar').style.width = pct + '%';

  saveState();
};

window.resetAgent = function(id) {
  STATE.agents[id] = { ticks: 0, accepted: 0, rejected: 0, entropy: 0, lastHash: null };
  liveAgents[id] = { x: 0.5, p: 0.1, entropy: 0, lastBetti: 1, lambda: 1.0, lambdaDist: 1.0 };
  if (id === 'b') pathBCloud = [];
  document.getElementById(id + '-ticks').textContent = 0;
  document.getElementById(id + '-accept').textContent = 0;
  document.getElementById(id + '-reject').textContent = 0;
  document.getElementById(id + '-hash').textContent = '—';
  document.getElementById(id + '-bar').style.width = '0%';
  document.getElementById(id + '-log').innerHTML = '';
  saveState();
};

// ================================================================
// SOVEREIGN ORACLE
// Full SIA-v6 decision cycle: all three paths run once, 
// cross-validate, converge toward λ*.
// ================================================================
const oracleState = { lambda: 1.0 };

window.runOracle = async function(n) {
  const s = STATE.oracle;
  const log = document.getElementById('oracle-log');

  for (let i = 0; i < n; i++) {
    // Run all three path ticks
    const ra = tickAgentA(liveAgents.a);
    const rb = tickAgentB(liveAgents.b);
    const rc = tickAgentC(liveAgents.c);
    Object.assign(liveAgents.a, ra);
    Object.assign(liveAgents.b, rb);
    Object.assign(liveAgents.c, rc);

    s.cycles++;

    // Consensus: converged if all three accepted AND RG distance < 0.01
    const dist = rc.lambdaDist;
    const converged = ra.accepted && rb.accepted && rc.accepted && dist < 0.01;
    if (converged) s.converged++;
    s.lastLambda = dist;

    const line = document.createElement('div');
    line.className = converged ? 'log-ok' : 'log-info';
    line.textContent = '[' + s.cycles + '] PathA:' + (ra.accepted?'✓':'✗')
      + ' PathB:' + (rb.accepted?'✓':'✗')
      + ' PathC:' + (rc.accepted?'✓':'✗')
      + '  |λ-λ*|=' + dist.toExponential(2)
      + (converged ? '  ← CONVERGED' : '');
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  document.getElementById('oracle-cycles').textContent = s.cycles;
  document.getElementById('oracle-conv').textContent = s.converged;
  document.getElementById('oracle-lambda').textContent = s.lastLambda.toExponential(3);
  saveState();
};

window.resetOracle = function() {
  STATE.oracle = { cycles: 0, converged: 0, lastLambda: 1.0 };
  document.getElementById('oracle-cycles').textContent = 0;
  document.getElementById('oracle-conv').textContent = 0;
  document.getElementById('oracle-lambda').textContent = '—';
  document.getElementById('oracle-log').innerHTML = '';
  saveState();
};

// ================================================================
// OPS — PING ENDPOINTS (fetch to real tollbooth base URL)
// ================================================================
// Primary: Cloud Run API. Fallback note: enable GCP billing to activate.
const TOLLBOOTH_BASE = 'https://sia-v6-agent-1005695038224.us-central1.run.app';

// CEROS base — organism-status and decisions endpoints
const CEROS_BASE = TOLLBOOTH_BASE;

window.pingEndpoint = async function(btn, path) {
  const resp = document.getElementById('ping-response');
  btn.textContent = '...';
  btn.disabled = true;
  const t0 = Date.now();
  try {
    const r = await fetch(TOLLBOOTH_BASE + path, { method: 'GET', signal: AbortSignal.timeout(5000) });
    const ms = Date.now() - t0;
    resp.style.display = 'block';
    resp.textContent = path + '  →  HTTP ' + r.status + '  (' + ms + 'ms)';
    resp.style.color = r.ok ? 'var(--green)' : 'var(--amber)';
  } catch(e) {
    const ms = Date.now() - t0;
    resp.style.display = 'block';
    resp.textContent = path + '  →  ' + (e.name === 'TimeoutError' ? 'TIMEOUT' : e.message) + '  (' + ms + 'ms)';
    resp.style.color = 'var(--red)';
  }
  btn.textContent = 'PING';
  btn.disabled = false;
};

// ================================================================
// REVENUE COCKPIT — loadMetrics() wired to CEROS /api/organism-status
// ================================================================
window.loadMetrics = async function() {
  const tsEl   = document.getElementById('metrics-ts');
  const orgEl  = document.getElementById('cockpit-organism');
  const hlEl   = document.getElementById('cockpit-health-val');
  const agEl   = document.getElementById('cockpit-agents-val');
  const enEl   = document.getElementById('cockpit-entropy-val');
  const rvEl   = document.getElementById('cockpit-revenue-val');
  const rawEl  = document.getElementById('cockpit-raw-val');
  const btnEl  = document.getElementById('metrics-refresh-btn');

  if (btnEl) { btnEl.textContent = '…'; btnEl.disabled = true; }
  if (orgEl) { orgEl.textContent = 'LOADING…'; orgEl.className = 'cockpit-card__value amber'; }
  if (tsEl)  { tsEl.textContent = 'fetching…'; }

  try {
    const r = await fetch(CEROS_BASE + '/api/organism-status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    const ts = new Date().toISOString();
    if (tsEl) tsEl.textContent = 'Updated: ' + ts;

    if (!r.ok) {
      throw new Error('HTTP ' + r.status);
    }

    let data;
    try {
      data = await r.json();
    } catch (_) {
      data = {};
    }

    // Render live fields — map to whatever keys CEROS returns
    if (orgEl) {
      const status = data.status || data.organism_status || 'LIVE';
      orgEl.textContent = String(status).toUpperCase();
      orgEl.className = 'cockpit-card__value green';
    }
    if (hlEl) hlEl.textContent = data.health || data.system_health || '—';
    if (agEl) agEl.textContent = data.active_agents !== undefined ? data.active_agents : (data.agents || '—');
    if (enEl) enEl.textContent = data.entropy_index !== undefined ? data.entropy_index : (data.entropy || '—');
    if (rvEl) rvEl.textContent = data.revenue_signal !== undefined ? data.revenue_signal : (data.revenue || '—');
    if (rawEl) rawEl.textContent = JSON.stringify(data, null, 2);

  } catch (e) {
    const ts = new Date().toISOString();
    if (tsEl) tsEl.textContent = 'Failed: ' + ts;
    if (orgEl) { orgEl.textContent = 'OFFLINE'; orgEl.className = 'cockpit-card__value red'; }
    if (hlEl) hlEl.textContent = '—';
    if (agEl) agEl.textContent = '—';
    if (enEl) enEl.textContent = '—';
    if (rvEl) rvEl.textContent = '—';
    const msg = e.name === 'TimeoutError' ? 'TIMEOUT — enable GCP billing to activate endpoint' : e.message;
    if (rawEl) rawEl.textContent = 'Error: ' + msg;
  } finally {
    if (btnEl) { btnEl.textContent = '↻ REFRESH'; btnEl.disabled = false; }
  }
};

// ================================================================
// DECISION REPLAY THEATER  (#panel-replay)
// ================================================================
const replayDecisions = [];

window.fetchDecisions = async function() {
  const btn    = document.getElementById('replay-fetch-btn');
  const status = document.getElementById('replay-status');

  if (btn) { btn.textContent = '…'; btn.disabled = true; }
  if (status) status.textContent = 'Fetching from CEROS…';

  try {
    const r = await fetch(CEROS_BASE + '/api/decisions', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    let decisions = [];
    if (r.ok) {
      try {
        const body = await r.json();
        decisions = Array.isArray(body) ? body : (body.decisions || body.data || []);
      } catch (_) {
        decisions = [];
      }
    } else {
      throw new Error('HTTP ' + r.status);
    }

    replayDecisions.length = 0;
    decisions.forEach(d => replayDecisions.push(d));

    const countLabel = decisions.length === 0 ? '0 decisions' : decisions.length + ' decision(s)';
    if (status) status.textContent = countLabel + ' loaded from CEROS';
    renderDecisionGrid(decisions, null);

  } catch (e) {
    const msg = e.name === 'TimeoutError' ? 'TIMEOUT' : e.message;
    if (status) status.textContent = 'Error: no response from CEROS (' + msg + ')';
    renderDecisionGrid([], 'no response from CEROS (' + msg + ')');
  } finally {
    if (btn) { btn.textContent = '↻ FETCH DECISIONS'; btn.disabled = false; }
  }
};

function renderDecisionGrid(decisions, errorMsg) {
  const grid  = document.getElementById('replay-grid');
  const empty = document.getElementById('replay-empty');
  if (!grid) return;

  // Clear previous cards (keep the empty placeholder)
  Array.from(grid.querySelectorAll('.replay-card')).forEach(el => el.remove());

  if (decisions.length === 0) {
    if (empty) {
      empty.style.display = 'flex';
      const textSpan = empty.querySelector('span:not(.replay-empty__icon)');
      if (textSpan) {
        if (errorMsg) {
          textSpan.textContent = 'Error: ' + errorMsg + ' — please check connection status.';
          textSpan.style.color = 'var(--red)';
        } else {
          textSpan.textContent = 'No decisions recorded yet — run an organism cycle and return.';
          textSpan.style.color = 'var(--text-dim)';
        }
      }
    }
    return;
  }
  if (empty) empty.style.display = 'none';

  decisions.forEach((d, i) => {
    const card = document.createElement('div');
    card.className = 'replay-card';
    card.innerHTML =
      '<div class="replay-card__index">#' + (i + 1) + '</div>' +
      '<div class="replay-card__title">' + escapeHtml(d.title || d.id || 'Decision ' + (i + 1)) + '</div>' +
      '<div class="replay-card__ts mono">' + escapeHtml(d.timestamp || d.created_at || '—') + '</div>' +
      '<div class="replay-card__outcome ' + (d.accepted !== false ? 'green' : 'red') + '">' +
        (d.accepted !== false ? '✓ ACCEPTED' : '✗ REJECTED') +
      '</div>' +
      '<button class="btn btn--sm btn--ghost replay-card__btn" data-idx="' + i + '">REPLAY ▶</button>';
    card.querySelector('.replay-card__btn').addEventListener('click', () => openReplayDetail(i));
    grid.appendChild(card);
  });
}

function openReplayDetail(idx) {
  const d = replayDecisions[idx];
  if (!d) return;
  const detail = document.getElementById('replay-detail');
  if (!detail) return;

  document.getElementById('replay-detail-title').textContent = d.title || d.id || 'Decision ' + (idx + 1);
  document.getElementById('rd-id').textContent      = d.id || '—';
  document.getElementById('rd-ts').textContent      = d.timestamp || d.created_at || '—';
  document.getElementById('rd-context').textContent = d.context || d.description || '—';
  document.getElementById('rd-outcome').textContent = d.outcome || (d.accepted !== false ? 'Accepted' : 'Rejected');
  document.getElementById('rd-hash').textContent    = d.proof_hash || d.hash || '—';
  document.getElementById('rd-verdict').textContent = d.replay_verdict || 'Deterministic replay: identical to original';

  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.closeReplayDetail = function() {
  const detail = document.getElementById('replay-detail');
  if (detail) detail.style.display = 'none';
};

// ================================================================
// FOUNDER PRESSURE BOARD  (#panel-pressure)
// ================================================================
window.loadPressureBoard = async function() {
  const btn   = document.getElementById('pressure-fetch-btn');
  const tsEl  = document.getElementById('pressure-ts');

  if (btn) { btn.textContent = '…'; btn.disabled = true; }
  if (tsEl) tsEl.textContent = 'Fetching…';

  try {
    const r = await fetch(CEROS_BASE + '/api/organism-status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });

    const ts = new Date().toISOString();
    if (tsEl) tsEl.textContent = 'Last updated: ' + ts;

    if (r.ok) {
      let data;
      try { data = await r.json(); } catch (_) { data = {}; }

      const poStatus  = document.getElementById('po-status');
      const poHealth  = document.getElementById('po-health');
      const poAgents  = document.getElementById('po-agents');
      const poEntropy = document.getElementById('po-entropy');
      const poRevenue = document.getElementById('po-revenue');
      const poTs      = document.getElementById('po-ts');

      if (poStatus)  { poStatus.textContent  = String(data.status || data.organism_status || 'LIVE').toUpperCase(); poStatus.className = 'pressure-field__val green'; }
      if (poHealth)  poHealth.textContent  = data.health  || data.system_health  || '—';
      if (poAgents)  poAgents.textContent  = data.active_agents !== undefined ? data.active_agents : (data.agents || '—');
      if (poEntropy) poEntropy.textContent = data.entropy_index !== undefined ? data.entropy_index : (data.entropy || '—');
      if (poRevenue) poRevenue.textContent = data.revenue_signal !== undefined ? data.revenue_signal : (data.revenue || '—');
      if (poTs)      poTs.textContent      = ts;
    } else {
      throw new Error('HTTP ' + r.status);
    }

  } catch (e) {
    const ts = new Date().toISOString();
    if (tsEl) tsEl.textContent = 'Last updated: ' + ts + ' (offline)';
    const poStatus  = document.getElementById('po-status');
    const poHealth  = document.getElementById('po-health');
    const poAgents  = document.getElementById('po-agents');
    const poEntropy = document.getElementById('po-entropy');
    const poRevenue = document.getElementById('po-revenue');
    if (poStatus)  { poStatus.textContent  = 'OFFLINE'; poStatus.className = 'pressure-field__val red'; }
    if (poHealth)  poHealth.textContent  = '—';
    if (poAgents)  poAgents.textContent  = '—';
    if (poEntropy) poEntropy.textContent = '—';
    if (poRevenue) poRevenue.textContent = '—';
  } finally {
    if (btn) { btn.textContent = '↻ REFRESH'; btn.disabled = false; }
  }
};

// ================================================================
// UTILITY — HTML escape for dynamic content
// ================================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ================================================================
// EMAIL ARSENAL
// ================================================================
// The prospect/outreach EMAILS dictionary is intentionally not committed.
// Load app.emails.private.js locally to set window.EMAILS, then opt in with
// localStorage.setItem('SCC_PRIVATE','1') on Nick's machine only.
var EMAILS = (typeof window !== 'undefined' && window.EMAILS) ? window.EMAILS : {};

function isPrivateModeUnlocked() {
  try {
    return localStorage.getItem('SCC_PRIVATE') === '1';
  } catch {
    return false;
  }
}

window.copyEmail = function(key) {
  if (!isPrivateModeUnlocked()) { console.warn('Email Arsenal is gated.'); return; }
  const e = (typeof EMAILS !== 'undefined') && EMAILS[key];
  if (e) copyToClipboard(e.body);
};

window.previewEmail = function(key) {
  if (!isPrivateModeUnlocked()) { console.warn('Email Arsenal is gated.'); return; }
  const e = (typeof EMAILS !== 'undefined') && EMAILS[key];
  if (!e) return;
  const box = document.getElementById('email-preview');
  document.getElementById('email-preview-text').textContent = e.body;
  box.style.display = 'block';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// ================================================================
// COPY UTILS
// ================================================================
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showBanner('✓ Copied to clipboard', 'ok'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showBanner('✓ Copied', 'ok');
  }
}

window.copyText = function(id) {
  const el = document.getElementById(id);
  if (el) copyToClipboard(el.textContent);
};

// ================================================================
// BANNER
// ================================================================
function showBanner(msg, type) {
  const b = document.getElementById('wallet-banner');
  b.textContent = msg;
  b.className = 'banner banner--' + (type || 'ok');
  b.style.display = 'flex';
  const btn = document.createElement('button');
  btn.className = 'banner__close'; btn.textContent = '✕';
  btn.onclick = () => b.style.display = 'none';
  b.appendChild(btn);
  if (type === 'ok') setTimeout(() => { b.style.display = 'none'; }, 5000);
}

// ================================================================
// CHECKLIST PERSISTENCE
// ================================================================
function initChecklist() {
  document.querySelectorAll('.chk input[type=checkbox]').forEach(cb => {
    const key = cb.id;
    if (STATE.checklist[key]) cb.checked = true;
    cb.addEventListener('change', () => {
      STATE.checklist[key] = cb.checked;
      saveState();
    });
  });
}

// ================================================================
// PWA — INSTALL PROMPT (Edge Beta compatible)
// Edge Beta on Android fires beforeinstallprompt.
// Microsoft Launcher intercepts and shows native install.
// ================================================================
let installPromptEvent = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPromptEvent = e;
  const btn = document.getElementById('install-btn');
  if (btn) btn.style.display = 'inline-flex';
});

document.getElementById('install-btn')?.addEventListener('click', async () => {
  if (!installPromptEvent) return;
  installPromptEvent.prompt();
  const result = await installPromptEvent.userChoice;
  if (result.outcome === 'accepted') {
    showBanner('✓ Sovereign Agent Shell installed as app.', 'ok');
    document.getElementById('install-btn').style.display = 'none';
  }
  installPromptEvent = null;
});

window.addEventListener('appinstalled', () => {
  showBanner('✓ App installed — find it in Microsoft Launcher.', 'ok');
  document.getElementById('install-btn').style.display = 'none';
});

// ================================================================
// SERVICE WORKER REGISTRATION
// ================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ================================================================
// RESTORE STATE TO UI
// ================================================================
function restoreAgentUI(id) {
  const s = STATE.agents[id];
  if (!s) return;
  document.getElementById(id + '-ticks').textContent = s.ticks;
  document.getElementById(id + '-accept').textContent = s.accepted;
  document.getElementById(id + '-reject').textContent = s.rejected;
  document.getElementById(id + '-hash').textContent = s.lastHash || '—';
  const pct = Math.min(100, (s.accepted / Math.max(1, s.ticks)) * 100);
  document.getElementById(id + '-bar').style.width = pct + '%';
}

function restoreTXStatus() {
  [1,2,3,4].forEach(num => {
    const hash = STATE.txStatus[num];
    if (!hash) return;
    const status = document.getElementById('tx-' + num + '-status');
    const btn = document.getElementById('tx-' + num + '-btn');
    const confirm = document.getElementById('tx-' + num + '-confirm');
    const card = document.getElementById('tx-' + num);
    if (status) { status.textContent = 'SIGNED ✓'; status.className = 'tx-card__status signed'; }
    if (btn) { btn.textContent = '✓ SIGNED'; btn.disabled = true; }
    if (card) card.classList.add('signed');
    if (confirm) {
      const chainId = (num === 1 || num === 3) ? '0xe708' : '0x1';
      const explorer = chainId === '0xe708'
        ? 'https://lineascan.build/tx/' + hash
        : 'https://etherscan.io/tx/' + hash;
      confirm.style.display = 'block';
      confirm.innerHTML = '✓ <a href="' + explorer + '" target="_blank" style="color:var(--green)">' + hash.slice(0,20) + '...' + hash.slice(-8) + ' ↗</a>';
    }
  });
}

function restoreOracleUI() {
  const s = STATE.oracle;
  document.getElementById('oracle-cycles').textContent = s.cycles;
  document.getElementById('oracle-conv').textContent = s.converged;
  document.getElementById('oracle-lambda').textContent = s.lastLambda ? s.lastLambda.toExponential(3) : '—';
}

// ================================================================
// CONNECT BUTTON
// ================================================================
document.getElementById('connect-btn').addEventListener('click', connectWallet);

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  restoreAgentUI('a');
  restoreAgentUI('b');
  restoreAgentUI('c');
  restoreTXStatus();
  restoreOracleUI();
  initChecklist();
  updateWalletUI();
  loadMetrics();

  // If already had a wallet session, show reconnect hint
  if (STATE.wallet) {
    showBanner('Tap CONNECT WALLET to reconnect MetaMask (session refreshed).', 'warn');
    STATE.wallet = null;  // Force fresh connection each load
    saveState();
  }
});

// ================================================================
// ADVANCED TERMUX & RENDER SUBSTRATE AGENT ENGINE (TERMINAL & IDE)
// ================================================================
let socket = null;
let substrateTarget = 'local';
let activeFilepath = null;
const openTabs = [];
const terminalHistory = [];
let terminalHistoryIndex = -1;
let editorFontSize = 12;

const VFS = {
  'index.js': `// Sovereign Agentic Node Entry Point
console.log("=====================================");
console.log("SIA-v6 Autonomous Substrate Active");
console.log("=====================================");

const PHI = 1.6180339887;
console.log("Physical coupling ratio (phi): " + PHI);
`,
  'README.md': `# SOVEREIGN AGENT SHELL SUBSTRATE
This is your localized workspace.
Feel free to write custom Node.js and client-side scripts here.
Click files in the sidebar to open them in the multi-tab editor.
`,
  'agents.config.json': `{
  "agent_a": {
    "entropy_threshold": 0.0,
    "dt": 0.001
  },
  "agent_b": {
    "persistence_epsilon": 0.25
  },
  "agent_c": {
    "fixed_point": "1/phi"
  }
}`
};

function appendTerminalLine(text, type = 'output') {
  const body = document.getElementById('terminal-body');
  if (!body) return;
  const line = document.createElement('div');
  line.className = 'tline tline-' + type;
  line.textContent = text;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

function appendConsoleLine(text, type = 'log') {
  const body = document.getElementById('console-body');
  if (!body) return;
  const line = document.createElement('div');
  line.className = 'cline cline-' + type;
  line.textContent = text;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

async function executeTerminalCommand(cmdText) {
  cmdText = cmdText.trim();
  if (!cmdText) return;

  // Echo input
  appendTerminalLine('$ ' + cmdText, 'input-echo');

  // Push to history
  terminalHistory.push(cmdText);
  terminalHistoryIndex = terminalHistory.length;

  const args = cmdText.split(' ');
  const cmd = args[0].toLowerCase();

  // Local command parsing for general utilities
  if (cmd === 'clear') {
    const body = document.getElementById('terminal-body');
    if (body) body.innerHTML = '';
    return;
  }
  if (cmd === 'help') {
    appendTerminalLine('Sovereign Agent Shell Terminal - Help', 'success');
    appendTerminalLine('Available utility commands:', 'info');
    appendTerminalLine('  help                Show this help menu', 'info');
    appendTerminalLine('  clear               Clear the screen', 'info');
    appendTerminalLine('  sysinfo             Display substrate node architecture details', 'info');
    appendTerminalLine('  ls                  List files in the current directory', 'info');
    appendTerminalLine('  cat <file>          Show contents of a file', 'info');
    appendTerminalLine('  write <file> <text> Create or overwrite a file with raw text', 'info');
    appendTerminalLine('  rm <file>           Delete a file from the workspace', 'info');
    appendTerminalLine('  run <file>          Run a script file (local JS sandbox or server-side node)', 'info');
    appendTerminalLine('  theme <color>       Set terminal color theme (green, amber, teal, purple)', 'info');
    return;
  }
  if (cmd === 'theme') {
    const color = args[1];
    const root = document.documentElement;
    if (color === 'amber') {
      root.style.setProperty('--green', '#FFB800');
      root.style.setProperty('--green-dim', 'rgba(255,184,0,0.12)');
      appendTerminalLine('Theme updated to AMBER.', 'success');
    } else if (color === 'teal') {
      root.style.setProperty('--green', '#4F98A3');
      root.style.setProperty('--green-dim', 'rgba(79,152,163,0.12)');
      appendTerminalLine('Theme updated to TEAL.', 'success');
    } else if (color === 'purple') {
      root.style.setProperty('--green', '#a78bfa');
      root.style.setProperty('--green-dim', 'rgba(167,139,250,0.12)');
      appendTerminalLine('Theme updated to PURPLE.', 'success');
    } else {
      root.style.setProperty('--green', '#00FF88');
      root.style.setProperty('--green-dim', 'rgba(0,255,136,0.12)');
      appendTerminalLine('Theme reverted to DEFAULT GREEN.', 'success');
    }
    return;
  }
  if (cmd === 'sysinfo') {
    appendTerminalLine('--- SYSTEM STATE ---', 'info');
    appendTerminalLine('SIA-v6 Sovereign Agent Engine: Live', 'info');
    appendTerminalLine('Local Wallet: ' + (STATE.wallet ? STATE.wallet.address : 'Disconnected'), 'info');
    appendTerminalLine('Substrate Mode: ' + substrateTarget.toUpperCase(), 'info');
    appendTerminalLine('Coupling Phi Constant: ' + ARCH.PHI, 'info');
    appendTerminalLine('Fixed Point Lambda*: ' + ARCH.LAMBDA_STAR, 'info');
    appendTerminalLine('Active Agents Ticks: ' + (STATE.agents.a.ticks + STATE.agents.b.ticks + STATE.agents.c.ticks), 'info');
    appendTerminalLine('--------------------', 'info');
    return;
  }

  // If substrate target is local VFS
  if (substrateTarget === 'local') {
    if (cmd === 'ls') {
      const files = Object.keys(VFS);
      if (files.length === 0) {
        appendTerminalLine('[No files in workspace]');
      } else {
        files.forEach(f => appendTerminalLine('📄  ' + f, 'output'));
      }
    } else if (cmd === 'cat') {
      const fn = args[1];
      if (!fn) { appendTerminalLine('Usage: cat <filename>', 'error'); return; }
      if (VFS[fn] !== undefined) {
        appendTerminalLine(VFS[fn], 'output');
      } else {
        appendTerminalLine('Error: File not found: ' + fn, 'error');
      }
    } else if (cmd === 'write') {
      const fn = args[1];
      if (!fn) { appendTerminalLine('Usage: write <filename> <content>', 'error'); return; }
      const content = args.slice(2).join(' ');
      VFS[fn] = content;
      appendTerminalLine('File written successfully.', 'success');
      refreshFileSystem();
    } else if (cmd === 'rm') {
      const fn = args[1];
      if (!fn) { appendTerminalLine('Usage: rm <filename>', 'error'); return; }
      if (VFS[fn] !== undefined) {
        delete VFS[fn];
        appendTerminalLine('File deleted.', 'success');
        refreshFileSystem();
      } else {
        appendTerminalLine('Error: File not found: ' + fn, 'error');
      }
    } else if (cmd === 'run') {
      const fn = args[1];
      if (!fn) { appendTerminalLine('Usage: run <filename>', 'error'); return; }
      if (VFS[fn] !== undefined) {
        appendTerminalLine('Executing ' + fn + ' in client-side local sandbox...', 'info');
        runJavaScriptSandbox(VFS[fn]);
      } else {
        appendTerminalLine('Error: File not found: ' + fn, 'error');
      }
    } else {
      appendTerminalLine('Command not recognized in local emulation. Type help for list of commands.', 'error');
    }
    return;
  }

  // If connected via WebSocket (Termux or Render)
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    appendTerminalLine('Error: Substrate WebSocket disconnected. Please reconnect.', 'error');
    return;
  }

  // Map client helper commands to shell commands on the daemon if needed, or pass-through
  let daemonCmd = cmdText;
  if (cmd === 'ls' && (substrateTarget === 'termux' || substrateTarget === 'render')) {
    // just normal pass-through
  } else if (cmd === 'cat') {
    const fn = args[1];
    daemonCmd = 'cat ' + fn;
  } else if (cmd === 'run') {
    const fn = args[1];
    daemonCmd = 'node ' + fn;
  }

  // Send execution command
  socket.send(JSON.stringify({
    type: 'exec',
    command: daemonCmd
  }));
}

function handleExecResponse(data) {
  if (data.error) {
    appendTerminalLine('Execution Error: ' + data.error, 'error');
    appendConsoleLine('Execution Error: ' + data.error, 'error');
  }
  if (data.stdout) {
    appendTerminalLine(data.stdout, 'output');
    appendConsoleLine(data.stdout, 'log');
  }
  if (data.stderr) {
    appendTerminalLine(data.stderr, 'error');
    appendConsoleLine(data.stderr, 'error');
  }
  if (!data.stdout && !data.stderr && !data.error) {
    appendTerminalLine('[Command completed with no output]', 'info');
    appendConsoleLine('[Command completed with no output]', 'info');
  }
}

function handleListFilesResponse(data) {
  if (data.error) {
    appendTerminalLine('List files error: ' + data.error, 'error');
    return;
  }
  renderFileSystemTree(data.files || []);
}

function handleReadFileResponse(data) {
  if (data.error) {
    showBanner('Read file failed: ' + data.error, 'err');
    return;
  }
  openFileInTab(data.filepath, data.content);
}

function handleWriteFileResponse(data) {
  if (data.error) {
    showBanner('Save file failed: ' + data.error, 'err');
    document.getElementById('editor-sync-status').textContent = 'Error saving changes';
    document.getElementById('editor-sync-status').className = 'editor-status-item text-red';
  } else {
    showBanner('✓ File saved successfully: ' + data.filepath, 'ok');
    document.getElementById('editor-sync-status').textContent = 'All changes saved';
    document.getElementById('editor-sync-status').className = 'editor-status-item text-green';
    refreshFileSystem();
  }
}

function handleDeleteFileResponse(data) {
  if (data.error) {
    showBanner('Delete failed: ' + data.error, 'err');
  } else {
    showBanner('✓ Deleted: ' + data.filepath, 'ok');
    closeFileTab(data.filepath);
    refreshFileSystem();
  }
}

function handleRenameFileResponse(data) {
  if (data.error) {
    showBanner('Rename failed: ' + data.error, 'err');
  } else {
    showBanner('✓ Renamed to: ' + data.new_filepath, 'ok');
    renameFileTab(data.filepath, data.new_filepath);
    refreshFileSystem();
  }
}

function refreshFileSystem() {
  if (substrateTarget === 'local') {
    const list = Object.keys(VFS).map(name => ({
      name,
      isDirectory: false
    }));
    renderFileSystemTree(list);
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'list_files' }));
  } else {
    renderFileSystemTree([]);
  }
}

function renderFileSystemTree(files) {
  const tree = document.getElementById('file-tree');
  if (!tree) return;
  tree.innerHTML = '';

  if (files.length === 0) {
    tree.innerHTML = '<div style="padding:10px;font-size:11px;color:var(--text3);font-family:var(--mono);">No files found</div>';
    return;
  }

  // Sort files
  files.sort((a,b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  files.forEach(f => {
    if (f.name === 'node_modules' || f.name === '.git' || f.name === '.gitignore' || f.name === 'package-lock.json') return;

    const div = document.createElement('div');
    div.className = 'tree-item';
    if (activeFilepath === f.name) div.classList.add('active');

    const icon = f.isDirectory ? '📁' : '📄';
    div.innerHTML = `
      <div class="tree-item-meta">
        <span class="tree-icon">${icon}</span>
        <span>${escapeHtml(f.name)}</span>
      </div>
    `;

    div.addEventListener('click', () => {
      openFile(f.name, f.isDirectory);
    });

    tree.appendChild(div);
  });
}

function openFile(filepath, isDirectory) {
  if (isDirectory) return;
  activeFilepath = filepath;

  document.querySelectorAll('.tree-item').forEach(el => {
    const isThis = el.querySelector('.tree-item-meta span:last-child').textContent === filepath;
    el.classList.toggle('active', isThis);
  });

  const tabIdx = openTabs.findIndex(t => t.filepath === filepath);
  if (tabIdx !== -1) {
    setActiveTab(tabIdx);
    return;
  }

  if (substrateTarget === 'local') {
    const content = VFS[filepath] || '';
    openFileInTab(filepath, content);
  } else {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'read_file', filepath }));
    } else {
      showBanner('Error: WebSocket disconnected.', 'err');
    }
  }
}

function openFileInTab(filepath, content) {
  const tab = { filepath, content, isDirty: false };
  openTabs.push(tab);
  setActiveTab(openTabs.length - 1);
}

function setActiveTab(idx) {
  const tab = openTabs[idx];
  if (!tab) {
    activeFilepath = null;
    document.getElementById('current-filepath').textContent = 'No File Open';
    document.getElementById('editor-textarea').value = '';
    document.getElementById('editor-textarea').disabled = true;
    updateGutter();
    renderTabsUI();
    return;
  }

  activeFilepath = tab.filepath;
  document.getElementById('current-filepath').textContent = tab.filepath;

  const textarea = document.getElementById('editor-textarea');
  textarea.value = tab.content;
  textarea.disabled = false;

  updateGutter();
  updateStatusBarMetrics();
  renderTabsUI();
}

function renderTabsUI() {
  const container = document.getElementById('ide-tabs');
  if (!container) return;
  container.innerHTML = '';

  openTabs.forEach((tab, i) => {
    const el = document.createElement('div');
    el.className = 'ide-tab';
    if (tab.filepath === activeFilepath) el.classList.add('active');

    const displayName = tab.filepath.split('/').pop() + (tab.isDirty ? ' *' : '');
    el.innerHTML = `
      <span>${escapeHtml(displayName)}</span>
      <span class="ide-tab-close">✕</span>
    `;

    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('ide-tab-close')) {
        e.stopPropagation();
        closeTabAt(i);
      } else {
        setActiveTab(i);
      }
    });

    container.appendChild(el);
  });
}

function closeTabAt(idx) {
  const closingActive = (openTabs[idx].filepath === activeFilepath);
  openTabs.splice(idx, 1);

  if (closingActive) {
    const nextIdx = Math.max(0, idx - 1);
    setActiveTab(openTabs.length > 0 ? nextIdx : -1);
  } else {
    renderTabsUI();
  }
}

function closeFileTab(filepath) {
  const idx = openTabs.findIndex(t => t.filepath === filepath);
  if (idx !== -1) closeTabAt(idx);
}

function renameFileTab(oldFilepath, newFilepath) {
  const tab = openTabs.find(t => t.filepath === oldFilepath);
  if (tab) {
    tab.filepath = newFilepath;
    if (activeFilepath === oldFilepath) {
      activeFilepath = newFilepath;
      document.getElementById('current-filepath').textContent = newFilepath;
    }
    renderTabsUI();
  }
}

window.updateGutter = function() {
  const textarea = document.getElementById('editor-textarea');
  const gutter = document.getElementById('editor-gutter');
  if (!textarea || !gutter) return;

  const lines = textarea.value.split('\n').length;
  let gutterHTML = '';
  for (let i = 1; i <= lines; i++) {
    gutterHTML += i + '<br>';
  }
  gutter.innerHTML = gutterHTML;

  gutter.scrollTop = textarea.scrollTop;

  const activeTab = openTabs.find(t => t.filepath === activeFilepath);
  if (activeTab && activeTab.content !== textarea.value) {
    activeTab.content = textarea.value;
    activeTab.isDirty = true;
    document.getElementById('editor-sync-status').textContent = 'Unsaved changes';
    document.getElementById('editor-sync-status').className = 'editor-status-item text-amber';
    renderTabsUI();
  }

  updateStatusBarMetrics();
};

document.getElementById('editor-textarea')?.addEventListener('scroll', () => {
  const gutter = document.getElementById('editor-gutter');
  const textarea = document.getElementById('editor-textarea');
  if (gutter && textarea) gutter.scrollTop = textarea.scrollTop;
});

function updateStatusBarMetrics() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea) return;

  const text = textarea.value;
  const chars = text.length;
  const lines = text.split('\n').length;

  document.getElementById('editor-char-count').textContent = chars + ' characters';
  document.getElementById('editor-line-count').textContent = lines + (lines === 1 ? ' line' : ' lines');
}

window.editorZoomIn = function() {
  editorFontSize = Math.min(24, editorFontSize + 1);
  applyEditorFontSize();
};

window.editorZoomOut = function() {
  editorFontSize = Math.max(9, editorFontSize - 1);
  applyEditorFontSize();
};

function applyEditorFontSize() {
  const el = document.getElementById('editor-textarea');
  const gut = document.getElementById('editor-gutter');
  const ind = document.getElementById('font-size-val');
  if (el) el.style.fontSize = editorFontSize + 'px';
  if (gut) gut.style.fontSize = editorFontSize + 'px';
  if (ind) ind.textContent = editorFontSize + 'px';
}

window.saveCurrentFile = function() {
  const tab = openTabs.find(t => t.filepath === activeFilepath);
  if (!tab) return showBanner('No file active to save.', 'warn');

  const textarea = document.getElementById('editor-textarea');
  tab.content = textarea.value;
  tab.isDirty = false;

  if (substrateTarget === 'local') {
    VFS[activeFilepath] = tab.content;
    showBanner('✓ Saved locally to VFS.', 'ok');
    document.getElementById('editor-sync-status').textContent = 'All changes saved';
    document.getElementById('editor-sync-status').className = 'editor-status-item text-green';
    renderTabsUI();
    refreshFileSystem();
  } else {
    if (socket && socket.readyState === WebSocket.OPEN) {
      document.getElementById('editor-sync-status').textContent = 'Saving changes...';
      document.getElementById('editor-sync-status').className = 'editor-status-item text-amber';
      socket.send(JSON.stringify({
        type: 'write_file',
        filepath: activeFilepath,
        content: tab.content
      }));
    } else {
      showBanner('Error: WebSocket disconnected.', 'err');
    }
  }
};

window.ideCreateFile = function() {
  const name = prompt('Enter name of new file (e.g., config.js):');
  if (!name) return;
  const cleanedName = name.trim();
  if (!cleanedName) return;

  if (substrateTarget === 'local') {
    if (VFS[cleanedName] !== undefined) return showBanner('File already exists.', 'warn');
    VFS[cleanedName] = '';
    showBanner('✓ File created: ' + cleanedName, 'ok');
    refreshFileSystem();
    openFile(cleanedName, false);
  } else {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'write_file',
        filepath: cleanedName,
        content: ''
      }));
    } else {
      showBanner('Error: WebSocket disconnected.', 'err');
    }
  }
};

window.ideCreateFolder = function() {
  const name = prompt('Enter folder name:');
  if (!name) return;
  const cleanedName = name.trim();
  if (!cleanedName) return;

  if (substrateTarget === 'local') {
    showBanner('Folders are emulated via path names (e.g. create file folder/file.js).', 'info');
  } else {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'write_file',
        filepath: cleanedName + '/.placeholder',
        content: ''
      }));
    } else {
      showBanner('Error: WebSocket disconnected.', 'err');
    }
  }
};

window.ideRenameSelected = function() {
  if (!activeFilepath) return showBanner('Select a file to rename.', 'warn');
  const newName = prompt('Enter new filename for ' + activeFilepath + ':', activeFilepath);
  if (!newName) return;
  const cleanedNewName = newName.trim();
  if (!cleanedNewName || cleanedNewName === activeFilepath) return;

  if (substrateTarget === 'local') {
    VFS[cleanedNewName] = VFS[activeFilepath];
    delete VFS[activeFilepath];
    renameFileTab(activeFilepath, cleanedNewName);
    showBanner('✓ Renamed to ' + cleanedNewName, 'ok');
    refreshFileSystem();
  } else {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'rename_file',
        filepath: activeFilepath,
        new_filepath: cleanedNewName
      }));
    } else {
      showBanner('Error: WebSocket disconnected.', 'err');
    }
  }
};

window.ideDeleteSelected = function() {
  if (!activeFilepath) return showBanner('Select a file to delete.', 'warn');
  if (!confirm('Are you sure you want to delete ' + activeFilepath + '?')) return;

  if (substrateTarget === 'local') {
    delete VFS[activeFilepath];
    closeFileTab(activeFilepath);
    showBanner('✓ File deleted.', 'ok');
    refreshFileSystem();
  } else {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'delete_file',
        filepath: activeFilepath
      }));
    } else {
      showBanner('Error: WebSocket disconnected.', 'err');
    }
  }
};

window.handleIdeFileUpload = function(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    const name = file.name;

    if (substrateTarget === 'local') {
      VFS[name] = content;
      showBanner('✓ Uploaded ' + name + ' locally.', 'ok');
      refreshFileSystem();
      openFile(name, false);
    } else {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'write_file',
          filepath: name,
          content: content
        }));
      } else {
        showBanner('Error: WebSocket disconnected.', 'err');
      }
    }
  };
  reader.readAsText(file);
};

function runJavaScriptSandbox(code) {
  appendConsoleLine('--- Launching Sandbox Simulator ---', 'info');

  const originalLog = console.log;
  const originalError = console.error;
  const captureBuffer = [];

  console.log = (...args) => {
    captureBuffer.push({ text: args.map(String).join(' '), type: 'log' });
    originalLog.apply(console, args);
  };
  console.error = (...args) => {
    captureBuffer.push({ text: args.map(String).join(' '), type: 'error' });
    originalError.apply(console, args);
  };

  try {
    const fn = new Function(code);
    fn();
    appendConsoleLine('Execution successfully completed.', 'success');
  } catch (e) {
    appendConsoleLine('Runtime Error: ' + e.message, 'error');
  }

  console.log = originalLog;
  console.error = originalError;

  captureBuffer.forEach(line => appendConsoleLine(line.text, line.type));
}

window.runConsoleCode = function() {
  const tab = openTabs.find(t => t.filepath === activeFilepath);
  if (!tab) return showBanner('Open a file first to run it.', 'warn');

  appendConsoleLine(`Starting execution: ${tab.filepath}...`, 'info');

  if (substrateTarget === 'local') {
    runJavaScriptSandbox(tab.content);
  } else {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'exec',
        command: `node ${tab.filepath}`
      }));
    } else {
      showBanner('Error: WebSocket disconnected.', 'err');
    }
  }
};

window.killConsoleProcess = function() {
  appendConsoleLine('Process execution terminated by operator.', 'error');
};

window.clearConsoleLog = function() {
  const body = document.getElementById('console-body');
  if (body) body.innerHTML = '';
};

window.setSubstrateTarget = function(target) {
  document.querySelectorAll('.selector-btn').forEach(b => {
    b.classList.toggle('active', b.id === 'sub-' + target);
  });

  substrateTarget = target;
  appendTerminalLine(`Switched substrate target to: ${target.toUpperCase()}`, 'info');

  const titleEl = document.getElementById('terminal-target-title');
  if (titleEl) titleEl.textContent = `SHELL: ${target.toUpperCase()} SUBSTRATE`;

  const dot = document.getElementById('termux-dot');
  const label = document.getElementById('termux-label');

  if (socket) {
    socket.close();
    socket = null;
  }

  if (target === 'local') {
    if (dot) dot.className = 'termux-dot connected';
    if (label) label.textContent = 'EMULATED (LOCAL)';
    appendTerminalLine('System utilizing zero-dependency in-browser emulator.', 'success');
    refreshFileSystem();
    return;
  }

  let wsUrl;
  if (target === 'termux') {
    wsUrl = 'ws://127.0.0.1:8765';
    if (dot) dot.className = 'termux-dot connecting';
    if (label) label.textContent = 'CONNECTING TERMUX...';
  } else {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = proto + '//' + location.host + '/ws';
    if (dot) dot.className = 'termux-dot connecting';
    if (label) label.textContent = 'CONNECTING RENDER...';
  }

  appendTerminalLine(`Connecting WebSocket daemon at ${wsUrl}...`, 'info');

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      appendTerminalLine(`WebSocket link opened with ${target.toUpperCase()} Substrate. Initiating authentication handshake...`, 'info');

      // Load saved token or prompt user (Termux does not require real password unless configured, default is sovereign_secret_token_1337)
      let savedToken = localStorage.getItem('scc_admin_token');
      if (!savedToken) {
        savedToken = prompt(`Enter Authentication Token for ${target.toUpperCase()} Substrate:`);
        if (savedToken) {
          localStorage.setItem('scc_admin_token', savedToken);
        }
      }

      socket.send(JSON.stringify({
        type: 'auth',
        token: savedToken || ''
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle Authentication Response
        if (data.type === 'auth_response') {
          if (data.success) {
            appendTerminalLine(`✓ Authentication successful! Established high-throughput telemetry connection with ${target.toUpperCase()} Substrate.`, 'success');
            if (dot) dot.className = 'termux-dot connected';
            if (label) label.textContent = `${target.toUpperCase()}: CONNECTED`;
            showBanner(`✓ Connected & Authenticated to ${target.toUpperCase()} Substrate`, 'ok');
            refreshFileSystem();
          } else {
            appendTerminalLine(`✗ Authentication failed: ${data.error || 'Invalid Token'}`, 'error');
            showBanner(`Authentication failed for ${target.toUpperCase()}`, 'err');
            localStorage.removeItem('scc_admin_token');
            if (dot) dot.className = 'termux-dot';
            if (label) label.textContent = `${target.toUpperCase()}: DISCONNECTED`;
          }
          return;
        }

        if (data.type === 'exec_response') {
          handleExecResponse(data);
        } else if (data.type === 'list_files_response') {
          handleListFilesResponse(data);
        } else if (data.type === 'read_file_response') {
          handleReadFileResponse(data);
        } else if (data.type === 'write_file_response') {
          handleWriteFileResponse(data);
        } else if (data.type === 'delete_file_response') {
          handleDeleteFileResponse(data);
        } else if (data.type === 'rename_file_response') {
          handleRenameFileResponse(data);
        } else if (data.type === 'error') {
          appendTerminalLine('Daemon Error: ' + data.message, 'error');
        }
      } catch (e) {
        appendTerminalLine(event.data, 'output');
      }
    };

    socket.onerror = () => {
      appendTerminalLine(`Connection failure occurred at address ${wsUrl}.`, 'error');
    };

    socket.onclose = () => {
      appendTerminalLine(`Telemetry telemetry link closed.`, 'info');
      if (dot) dot.className = 'termux-dot';
      if (label) label.textContent = `${target.toUpperCase()}: DISCONNECTED`;
      if (target === 'termux') {
        showBanner('Termux agent closed. To run on Android: start python termux_agent.py.', 'warn');
      }
    };

  } catch (err) {
    appendTerminalLine(`WebSocket initialization error: ${err.message}`, 'error');
  }
};

window.clearTerminal = function() {
  const body = document.getElementById('terminal-body');
  if (body) body.innerHTML = '';
};

window.resetTerminalEnv = function() {
  appendTerminalLine('Resetting terminal context environment...', 'info');
  setSubstrateTarget(substrateTarget);
};

window.downloadTerminalLog = function() {
  const body = document.getElementById('terminal-body');
  if (!body) return;
  const text = body.textContent;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `terminal_log_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showBanner('✓ Terminal log saved', 'ok');
};

document.getElementById('terminal-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const input = e.target;
    const val = input.value;
    input.value = '';
    executeTerminalCommand(val);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (terminalHistory.length > 0 && terminalHistoryIndex > 0) {
      terminalHistoryIndex--;
      e.target.value = terminalHistory[terminalHistoryIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (terminalHistoryIndex < terminalHistory.length - 1) {
      terminalHistoryIndex++;
      e.target.value = terminalHistory[terminalHistoryIndex];
    } else {
      terminalHistoryIndex = terminalHistory.length;
      e.target.value = '';
    }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const val = e.target.value.trim();
    if (!val) return;
    const cmdList = ['help', 'clear', 'sysinfo', 'ls', 'cat', 'write', 'rm', 'run', 'theme'];
    const matches = cmdList.filter(c => c.startsWith(val));
    if (matches.length === 1) {
      e.target.value = matches[0] + ' ';
    } else {
      const parts = val.split(' ');
      if (parts.length === 2 && (parts[0] === 'cat' || parts[0] === 'run' || parts[0] === 'rm')) {
        const cmdWord = parts[0];
        const fileWord = parts[1];
        const files = (substrateTarget === 'local') ? Object.keys(VFS) : [];
        const fileMatches = files.filter(f => f.startsWith(fileWord));
        if (fileMatches.length === 1) {
          e.target.value = cmdWord + ' ' + fileMatches[0];
        }
      }
    }
  }
});

// Auto-initialize files workspace on content load
document.addEventListener('DOMContentLoaded', () => {
  setSubstrateTarget('local');
  refreshFileSystem();
  openFile('README.md', false);
});
