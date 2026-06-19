# OMEGA ORCHESTRATOR — Savage Command Center

## Quick Start

### 1. Configure API Keys (in browser console or via the UI)
```js
window.OMEGA.configure({
  NVIDIA_API_KEY: 'nvapi-your-key-here',
  OPENROUTER_API_KEY: 'sk-or-your-key-here'
});
```

### 2. Call a Single Agent
```js
// Ask Nemotron a question
const result = await OMEGA.ask('nemotron-super', 'Explain symplectic integration in 3 sentences.');
console.log(result.text);

// Search the web with Perplexity
const search = await OMEGA.search('NVIDIA Blackwell B200 thermal performance 2026');
console.log(search.text);
```

### 3. Run the Full Council (all agents concurrently)
```js
const { results, consensus } = await OMEGA.council(
  'What is the optimal architecture for a deterministic HFT system?',
  ['nemotron-super', 'claude-sonnet', 'gemini-flash', 'perplexity-sonar']
);
results.forEach(r => console.log(`[${r.agentId}]:`, r.text?.slice(0, 200)));
```

### 4. Build Code (DeepSeek → Nemotron → Claude pipeline)
```js
const pipeline = await OMEGA.build(
  'Create a TypeScript class for SHA-256 proof-chain verification compatible with SIA V6 Foundry schemas.',
  { proposeMutation: true, targetPath: 'src/ceros/ProofChain.ts' }
);
// Final verified code is in pipeline[pipeline.length-1].output
// A mutation is queued in FileHypervisor awaiting FOUNDER_C10 approval
```

### 5. Multi-Turn Chat with an Agent
```js
await OMEGA.chat('claude-sonnet', 'I am building a sovereign AI system. What are the key governance risks?');
await OMEGA.chat('claude-sonnet', 'How do I mitigate those using constitutional law schemas?'); // Has memory
```

### 6. Agent Relay (sequential pipeline)
```js
// Perplexity searches → Gemini analyzes → Nemotron synthesizes
const relay = await OMEGA.relay(
  'Find the latest NVIDIA NIM API documentation changes',
  ['perplexity-sonar', 'gemini-flash', 'nemotron-super']
);
```

### 7. Task Queue (background execution)
```js
OMEGA.queue({
  type: 'CODE_BUILD',
  specification: 'Build a FastAPI tollbooth endpoint for the SCA agent.',
  options: { proposeMutation: true, targetPath: 'tollbooth/sca_endpoint.py' },
  onComplete: (result) => console.log('Build complete:', result),
  onError: (err) => console.error('Build failed:', err)
});
```

### 8. Approve or Reject AI Mutations
```js
// See what mutations are queued
console.log(window.OMEGA.FileHypervisor.getPending());

// Approve (FOUNDER_C10 handshake required)
await window.OMEGA.FileHypervisor.authorize('FOUNDER_C10_VALIDATED');

// Reject all
window.OMEGA.FileHypervisor.reject();
```

### 9. Listen to All Events (NarrativeZetaBus)
```js
window.OMEGA.NarrativeZetaBus.subscribe('*', (event) => {
  console.log(`[${event.source}] ${event.type}`, event.payload);
});
```

## Available Agents

| ID | Name | Role | Provider | Capabilities |
|---|---|---|---|---|
| `nemotron-super` | Nemotron 70B Super | REASONING | NVIDIA NIM | reasoning, code, math |
| `nemotron-nano` | Nemotron Nano | FAST_REASONING | NVIDIA NIM | fast classification, routing |
| `claude-sonnet` | Claude Sonnet 4.5 | VERIFICATION | OpenRouter | verification, code review, web |
| `gemini-flash` | Gemini Flash 2.0 | TELEOLOGY | OpenRouter | drift detection, multimodal |
| `deepseek-coder` | DeepSeek Coder V3 | CODE_GENERATION | OpenRouter | code gen, debugging |
| `perplexity-sonar` | Perplexity Sonar Pro | WEB_INTELLIGENCE | OpenRouter | real-time web search |
| `qwen-coder` | Qwen 2.5 Coder 32B | CODE_BUILDER | OpenRouter | multi-language builds |
| `sia-path-a` | SIA Path-A | ENTROPY_GATE | Internal | thermodynamic proof |
| `sia-path-b` | SIA Path-B | TOPOLOGY_GATE | Internal | Betti flow |
| `sia-path-c` | SIA Path-C | RG_GATE | Internal | RG fixed-point |

## Security Architecture

- **OCP Gate**: Every external AI call goes through `OCPGate` — no raw fetch allowed anywhere else
- **Ledger Ring**: Every call is SHA-256 hashed and logged with outcome status
- **FileHypervisor**: All AI-generated code mutations are buffered pending `FOUNDER_C10_VALIDATED` handshake
- **NarrativeZetaBus**: All inter-agent events are observable — full audit trail
- **API Keys**: Stored in-memory only, never in localStorage or committed to git

## WebSocket Bridge (for local deployment)
When running with the Node.js bridge (`npm run bridge`), the WebSocket on port 8080 handles:
- `EXEC_COMMAND` → `SovereignShell.execute(command)` → `EXEC_RESULT`
- `LIST_FILES` → filesystem tree → `FILE_TREE`
- `AGENT_CALL` → routes to `CouncilOrchestrator` → streams back result

All WebSocket connections require the `X-Omega-Token` header matching `process.env.OMEGA_BRIDGE_TOKEN`.
