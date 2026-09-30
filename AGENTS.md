# AGENTS.md — Agent Shell Production-Ready Governance Contract

## MISSION STATEMENT
Agent Shell is the flagship product of the Savage Command Center ecosystem: a sovereign control interface and integrated Shell/IDE for the SIA-v6 ecosystem. Every session must leave it more real — no fabricated data, no dead gates, no unverifiable claims. Build only what is meant to be built, and prove it runs.

---

## 1. MANDATORY EXECUTION & GATEKEEPING RULES
An agent MUST NOT mark a session complete, close a pull request, or hand off execution until ALL criteria in this document pass without a single failure or warning.

### A. Zero-Tolerance Code Cleanliness
- **Syntax Verification:** `node --check app.js && node --check server.js` MUST execute with zero exit code errors.
- **Test Suite:** `npm test` MUST pass with zero failures.
- **Brand Integrity:** "Savage Command Center" is the intentional ecosystem brand and MUST NOT be purged or renamed away. (The previous rule banning `savage|command center` was removed — it conflicted with the product identity and could never pass.)
- **No Fabricated Data:** Production code MUST NOT seed, hardcode, or invent metrics. When a real value is unavailable, report unavailability explicitly (e.g. HTTP 503 "not computed", an OFFLINE UI state) — never present invented numbers as live data. `Math.random()` is banned in production code (enforced in CI).
- **Scope Leakage:** Zero undeclared global variables or stray console debugging statements allowed in production builds.

### B. Functional Benchmarks (Pass/Fail)
1. **Terminal / WebSocket Bridge:**
   - `#terminal-input` and `#terminal-body` exist in `index.html` and are wired in `app.js`.
   - WebSocket and terminal behavior is covered by `tests/substrate_ws.test.mjs` and `tests/terminal.test.mjs`.
2. **Revenue Cockpit (CEROS):**
   - `loadMetrics()` fetches `CEROS_BASE + '/api/organism-status'` and renders `#cockpit-organism` plus the cockpit value cards.
   - When the endpoint is unreachable or reports "not computed" (503), the UI MUST show the OFFLINE/error state — never placeholder numbers.
3. **Decision Replay & Founder Pressure Board:**
   - `#panel-replay` and `#panel-pressure` exist in `index.html` and are implemented in `app.js`.
4. **Security Model:**
   - Capability gateway, nonce replay protection, and admin-token gates are covered by `tests/capability_security.test.mjs` and `tests/security_regression.test.mjs`.

---

## 2. AUTOMATED SELF-VERIFICATION PROTOCOL
Before submitting any task, execute the following verification loop sequentially:

```bash
# Step 1: Syntax check
node --check app.js && node --check server.js

# Step 2: Full test suite
npm test

# Step 3: DOM-to-JS Selector Binding Verification
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');
['panel-ide', 'panel-replay', 'panel-pressure', 'terminal-input', 'terminal-body', 'metrics-refresh-btn', 'cockpit-organism'].forEach(id => {
  if (!html.includes(id)) throw new Error('Missing DOM element #' + id);
  if (!js.includes(id)) throw new Error('Unbound JS reference #' + id);
});
console.log('DOM & JS IDs 100% synchronized');
"
```
