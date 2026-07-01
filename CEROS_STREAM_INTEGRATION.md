# CEROS Stream Integration Guide

This document describes how to wire `ceros-stream.js` into the Savage Command Center UI.

## What it does

`ceros-stream.js` opens an `EventSource` connection to CEROS `GET /api/stream` and:

- Renders **orchestrator cycles** into `#ceros-status`
- Renders **founder decisions** (PROMOTE/HOLD/ESCALATE) into `#ceros-founder-queue`
- Renders **diamond promotions** into `#ceros-diamond-feed`
- Renders **spine:promotion events** into `#ceros-spine-log`
- Renders **fault detections** into `#ceros-fault-log`
- Displays the **CRI** (Constitutional Resilience Index) in `#ceros-cri-value`
- Auto-reconnects on disconnect with exponential backoff (2s → 30s max)

## Adding panels to index.html

Add these elements anywhere in `index.html` (e.g., inside a new tab panel):

```html
<!-- Connection status -->
<div id="ceros-connect-panel">
  <span id="ceros-connect-dot" class="ceros-dot ceros-dot--off"></span>
  <span id="ceros-connect-label">NOT CONNECTED</span>
</div>

<!-- Organism status -->
<div id="ceros-status" class="ceros-status-badge">Waiting for CEROS...</div>

<!-- CRI -->
<div>CRI: <span id="ceros-cri-value" class="ceros-cri">--</span></div>

<!-- Stats -->
<div id="ceros-stream-stats"></div>

<!-- Activity log -->
<div id="ceros-activity-log" class="ceros-log-box"></div>

<!-- Founder decisions -->
<div id="ceros-founder-queue" class="ceros-decision-list"></div>

<!-- Diamond feed -->
<div id="ceros-diamond-feed" class="ceros-diamond-list"></div>

<!-- Spine log -->
<div id="ceros-spine-log" class="ceros-log-box"></div>

<!-- Fault log -->
<div id="ceros-fault-log" class="ceros-log-box"></div>
```

## Script tags

At the bottom of `index.html`, before `</body>`:

```html
<script src="./ceros-stream.js"></script>
<script>
  // Set CEROS server URL (change for production)
  window.CEROS_BASE_URL = 'http://localhost:3000';
  CerosStream.init();
</script>
```

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `window.CEROS_BASE_URL` | `http://localhost:3000` | CEROS server base URL |

For production, set `CEROS_BASE_URL` to the deployed CEROS server URL before calling `CerosStream.init()`.

## Events consumed from CEROS /api/stream

| SSE event type | Rendered to | Notes |
|---|---|---|
| `orchestrator:cycle` | `#ceros-status`, CRI | Fires every 5s from CEROS eval loop |
| `founder:decision` | `#ceros-founder-queue` | PROMOTE/HOLD/ESCALATE decisions |
| `diamond:candidate` | `#ceros-diamond-feed` | Triadic PASS promotions |
| `spine:promotion` | `#ceros-spine-log` | CrossRepoOrchestrator GOLD promotions |
| `narrative:update` | `#ceros-activity-log` | Narrative text updates |
| `FAULT_DETECTED` | `#ceros-fault-log` | Governance interventions / errors |
| `AGENT_WIRING_PROPOSED` | `#ceros-activity-log` | Nano agent wiring proposals |

## CSS classes (add to style.css)

```css
.ceros-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.ceros-dot--on { background: var(--green, #00ff88); }
.ceros-dot--off { background: var(--red, #ff4444); }
.ceros-log-box { height: 200px; overflow-y: auto; font-size: 11px; font-family: monospace;
  background: #111; border: 1px solid #333; padding: 6px; }
.ceros-log-line { padding: 1px 0; border-bottom: 1px solid #1a1a1a; }
.ceros-log--fault { color: var(--red, #ff4444); }
.ceros-log--spine { color: var(--amber, #ffcc00); }
.ceros-log--diamond { color: #00cfff; }
.ceros-log--ok { color: var(--green, #00ff88); }
.ceros-log--warn { color: var(--amber, #ffcc00); }
.ceros-cri { font-weight: bold; }
.ceros-cri--healthy { color: var(--green, #00ff88); }
.ceros-cri--warn { color: var(--amber, #ffcc00); }
.ceros-cri--critical { color: var(--red, #ff4444); }
.ceros-decision-row { display: flex; gap: 12px; font-size: 12px;
  padding: 4px 6px; border-bottom: 1px solid #1a1a1a; }
.ceros-decision--promote { border-left: 3px solid var(--green, #00ff88); }
.ceros-decision--escalate { border-left: 3px solid #00cfff; }
.ceros-decision--hold { border-left: 3px solid var(--amber, #ffcc00); }
.ceros-decision--reject { border-left: 3px solid var(--red, #ff4444); }
.ceros-diamond-row { display: flex; gap: 12px; font-size: 12px;
  padding: 4px 6px; border-bottom: 1px solid #1a1a1a; }
.ceros-diamond--flawless { border-left: 3px solid #fff; color: #fff; }
.ceros-diamond--polished { border-left: 3px solid #00cfff; }
.ceros-diamond--cut { border-left: 3px solid var(--amber, #ffcc00); }
.ceros-diamond--rough { border-left: 3px solid #888; }
```
