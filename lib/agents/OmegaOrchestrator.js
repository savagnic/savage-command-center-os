/* ================================================================
   OMEGA ORCHESTRATOR v1.0 — SAVAGE COMMAND CENTER
   Multi-Agent Coordination Layer
   Supports: NVIDIA NIM API, OpenRouter (all models), SIA Internal Agents
   Architecture: OCP Gate → Council → NarrativeZetaBus → UI
   ================================================================ */
'use strict';

// ================================================================
// OCP GATE — Single ingress for ALL external AI calls
// No raw fetch to AI APIs is allowed outside this module.
// Every call is logged to the LedgerRing with SHA-256 proof.
// ================================================================
class OCPGate {
  constructor() {
    this.ledger = [];
    this.requestCount = 0;
  }

  async call({ provider, model, messages, stream = false, tools = null, apiKey, baseURL }) {
    this.requestCount++;
    const ref = `OCP-${Date.now()}-${this.requestCount}`;
    const promptHash = await sha256(JSON.stringify(messages));

    const entry = {
      ledgerRef: ref,
      provider,
      model,
      promptHash,
      timestamp: Date.now(),
      outcome: 'PENDING',
      via: provider === 'nvidia' ? 'NVIDIA_NIM' : 'OPENROUTER_API_KEY'
    };
    this.ledger.push(entry);
    NarrativeZetaBus.publish('OCP_CALL_INITIATED', 'OCPGate', { ref, provider, model });

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://savage-command-center.app';
        headers['X-Title'] = 'Savage Command Center';
      }

      const body = {
        model,
        messages,
        stream,
        max_tokens: 4096,
        temperature: 0.7
      };
      if (tools) body.tools = tools;

      const url = baseURL + '/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`HTTP ${response.status}: ${err.slice(0, 200)}`);
      }

      entry.outcome = 'CANDIDATE';
      NarrativeZetaBus.publish('OCP_CALL_SUCCESS', 'OCPGate', { ref, model });

      if (stream) return response; // Return raw response for streaming
      return await response.json();

    } catch (err) {
      entry.outcome = 'BLOCKED';
      NarrativeZetaBus.publish('OCP_CALL_FAILED', 'OCPGate', { ref, error: err.message });
      throw err;
    }
  }

  getLedger() { return [...this.ledger]; }
}

// ================================================================
// AGENT REGISTRY — All agents declared here
// Add new agents by pushing to AGENTS array.
// ================================================================
const AGENT_REGISTRY = [
  // ── NVIDIA NIM AGENTS ──────────────────────────────────────────
  {
    id: 'nemotron-super',
    name: 'Nemotron 70B Super',
    role: 'REASONING',
    provider: 'nvidia',
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKeyRef: 'NVIDIA_API_KEY',
    color: '#76b900',
    icon: '🟢',
    capabilities: ['reasoning', 'code', 'analysis', 'math'],
    systemPrompt: 'You are Nemotron, a deterministic reasoning agent within the SIA V6 Sovereign system. You enforce physical and mathematical consistency. Never hallucinate. If uncertain, say so explicitly.'
  },
  {
    id: 'nemotron-nano',
    name: 'Nemotron Nano',
    role: 'FAST_REASONING',
    provider: 'nvidia',
    model: 'nvidia/llama-3.2-nemo-instruct',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKeyRef: 'NVIDIA_API_KEY',
    color: '#4CAF50',
    icon: '⚡',
    capabilities: ['fast_reasoning', 'classification', 'routing'],
    systemPrompt: 'You are Nemotron Nano, a fast classification and routing agent. Be concise. Return structured JSON when asked.'
  },
  {
    id: 'nvidia-embed',
    name: 'NVIDIA Embeddings',
    role: 'EMBEDDING',
    provider: 'nvidia',
    model: 'nvidia/nv-embedqa-e5-v5',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKeyRef: 'NVIDIA_API_KEY',
    color: '#76b900',
    icon: '🔮',
    capabilities: ['embedding', 'semantic_search'],
    systemPrompt: null // Embeddings don't use chat
  },

  // ── OPENROUTER AGENTS ──────────────────────────────────────────
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4.5',
    role: 'VERIFICATION',
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4-5',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyRef: 'OPENROUTER_API_KEY',
    color: '#c97a3e',
    icon: '🔶',
    capabilities: ['verification', 'code_review', 'writing', 'analysis', 'web_search'],
    systemPrompt: 'You are Claude, the Verification agent in the SIA V6 Council. Your role is to audit proposals from other agents for correctness, safety, and 60-law compliance. Be thorough and critical.'
  },
  {
    id: 'gemini-flash',
    name: 'Gemini Flash 2.0',
    role: 'TELEOLOGY',
    provider: 'openrouter',
    model: 'google/gemini-flash-2.0',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyRef: 'OPENROUTER_API_KEY',
    color: '#4285f4',
    icon: '🔵',
    capabilities: ['teleology', 'drift_detection', 'multimodal', 'web_search'],
    systemPrompt: 'You are Gemini Flash, the Teleology agent. You detect contextual drift, regime changes, and future attractor states. Return structured analysis in JSON when asked.'
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder V3',
    role: 'CODE_GENERATION',
    provider: 'openrouter',
    model: 'deepseek/deepseek-coder',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyRef: 'OPENROUTER_API_KEY',
    color: '#6366f1',
    icon: '💎',
    capabilities: ['code_generation', 'debugging', 'architecture'],
    systemPrompt: 'You are DeepSeek Coder, the Code Generation agent. You write production-grade, deterministic code that adheres to SIA V6 architecture patterns. Always produce complete, runnable implementations.'
  },
  {
    id: 'perplexity-sonar',
    name: 'Perplexity Sonar',
    role: 'WEB_INTELLIGENCE',
    provider: 'openrouter',
    model: 'perplexity/sonar-pro',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyRef: 'OPENROUTER_API_KEY',
    color: '#20b2aa',
    icon: '🌐',
    capabilities: ['web_search', 'real_time_data', 'research'],
    systemPrompt: 'You are Perplexity Sonar, the Web Intelligence agent. You search the internet for real-time information. Always cite sources. Return findings with URLs when available.'
  },
  {
    id: 'qwen-coder',
    name: 'Qwen 2.5 Coder 32B',
    role: 'CODE_BUILDER',
    provider: 'openrouter',
    model: 'qwen/qwen-2.5-coder-32b-instruct',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyRef: 'OPENROUTER_API_KEY',
    color: '#9b59b6',
    icon: '🟣',
    capabilities: ['code_generation', 'refactoring', 'multi_language'],
    systemPrompt: 'You are Qwen Coder, the Build agent. You specialize in complete system implementations across all languages. Prioritize correctness and maintainability.'
  },

  // ── SIA INTERNAL AGENTS (deterministic, no API) ────────────────
  {
    id: 'sia-path-a',
    name: 'SIA Path-A (Thermodynamic)',
    role: 'ENTROPY_GATE',
    provider: 'internal',
    model: 'SYMPLECTIC_RATCHET_v1',
    color: '#00ff88',
    icon: '⚛️',
    capabilities: ['entropy_validation', 'thermodynamic_proof'],
    systemPrompt: null
  },
  {
    id: 'sia-path-b',
    name: 'SIA Path-B (Topological)',
    role: 'TOPOLOGY_GATE',
    provider: 'internal',
    model: 'BETTI_FLOW_v1',
    color: '#00bfff',
    icon: '🔷',
    capabilities: ['topological_proof', 'connectivity_analysis'],
    systemPrompt: null
  },
  {
    id: 'sia-path-c',
    name: 'SIA Path-C (RG Flow)',
    role: 'RG_GATE',
    provider: 'internal',
    model: 'RENORM_FLOW_v1',
    color: '#ffd700',
    icon: '🌀',
    capabilities: ['rg_flow', 'fixed_point_convergence'],
    systemPrompt: null
  }
];

// ================================================================
// NARRATIVE ZETA BUS — Event pub/sub between all agents
// ================================================================
class NarrativeZetaBusClass {
  constructor() { this._listeners = {}; }

  publish(type, source, payload) {
    const event = { type, source, payload, timestamp: Date.now() };
    const all = [...(this._listeners['*'] || []), ...(this._listeners[type] || [])];
    all.forEach(cb => { try { cb(event); } catch(e) {} });
    return event;
  }

  subscribe(typeOrStar, callback) {
    if (!this._listeners[typeOrStar]) this._listeners[typeOrStar] = [];
    this._listeners[typeOrStar].push(callback);
    return () => { this._listeners[typeOrStar] = this._listeners[typeOrStar].filter(c => c !== callback); };
  }
}
const NarrativeZetaBus = new NarrativeZetaBusClass();

// ================================================================
// FILE HYPERVISOR — Mutation gate (no writes without FOUNDER_C10)
// ================================================================
class FileHypervisorClass {
  constructor() { this._pending = []; }

  propose(mutation) {
    this._pending.push({ ...mutation, timestamp: Date.now(), status: 'PENDING' });
    NarrativeZetaBus.publish('MUTATION_PROPOSED', 'FileHypervisor', mutation);
  }

  getPending() { return [...this._pending]; }

  async authorize(handshake) {
    if (handshake !== 'FOUNDER_C10_VALIDATED') {
      NarrativeZetaBus.publish('MUTATION_BLOCKED', 'FileHypervisor', { reason: 'Invalid handshake' });
      return false;
    }
    const count = this._pending.length;
    this._pending = [];
    NarrativeZetaBus.publish('MUTATIONS_COMMITTED', 'FileHypervisor', { count });
    return true;
  }

  reject() {
    const count = this._pending.length;
    this._pending = [];
    NarrativeZetaBus.publish('MUTATIONS_REJECTED', 'FileHypervisor', { count });
  }
}
const FileHypervisor = new FileHypervisorClass();

// ================================================================
// SHA-256 HELPER
// ================================================================
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ================================================================
// COUNCIL ORCHESTRATOR — The heart of multi-agent coordination
// ================================================================
class CouncilOrchestratorClass {
  constructor() {
    this.sessions = new Map();
    this.apiKeys = {}; // Set via setAPIKeys()
  }

  setAPIKeys(keys) {
    this.apiKeys = { ...this.apiKeys, ...keys };
    NarrativeZetaBus.publish('API_KEYS_CONFIGURED', 'CouncilOrchestrator', {
      providers: Object.keys(keys).map(k => k.replace(/_API_KEY$/, ''))
    });
  }

  getAPIKey(ref) {
    return this.apiKeys[ref] || null;
  }

  getAgent(id) {
    return AGENT_REGISTRY.find(a => a.id === id);
  }

  getAgentsByCapability(capability) {
    return AGENT_REGISTRY.filter(a => a.capabilities?.includes(capability) && a.provider !== 'internal');
  }

  // ── Single Agent Call ──────────────────────────────────────────
  async callAgent(agentId, userMessage, options = {}) {
    const agent = this.getAgent(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    if (agent.provider === 'internal') throw new Error(`Use SIA internal engine for: ${agentId}`);

    const apiKey = this.getAPIKey(agent.apiKeyRef);
    if (!apiKey) {
      throw new Error(`API key not set for ${agent.apiKeyRef}. Call CouncilOrchestrator.setAPIKeys({ ${agent.apiKeyRef}: 'your-key' })`);
    }

    const messages = [
      { role: 'system', content: agent.systemPrompt || 'You are a helpful AI agent.' },
      ...(options.history || []),
      { role: 'user', content: userMessage }
    ];

    NarrativeZetaBus.publish('AGENT_CALL_START', agentId, { model: agent.model, messageCount: messages.length });

    const gate = new OCPGate();
    const response = await gate.call({
      provider: agent.provider,
      model: agent.model,
      messages,
      stream: options.stream || false,
      tools: options.tools || null,
      apiKey,
      baseURL: agent.baseURL
    });

    if (options.stream) return response; // Return raw for streaming

    const text = response.choices?.[0]?.message?.content || '';
    const usage = response.usage || {};
    const result = { agentId, model: agent.model, text, usage, role: agent.role };

    NarrativeZetaBus.publish('AGENT_CALL_COMPLETE', agentId, result);
    return result;
  }

  // ── Streaming Agent Call ───────────────────────────────────────
  async streamAgent(agentId, userMessage, onChunk, options = {}) {
    const agent = this.getAgent(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    const apiKey = this.getAPIKey(agent.apiKeyRef);
    if (!apiKey) throw new Error(`API key not set for ${agent.apiKeyRef}`);

    const messages = [
      { role: 'system', content: agent.systemPrompt },
      ...(options.history || []),
      { role: 'user', content: userMessage }
    ];

    const gate = new OCPGate();
    const response = await gate.call({
      provider: agent.provider,
      model: agent.model,
      messages,
      stream: true,
      apiKey,
      baseURL: agent.baseURL
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            onChunk(delta, fullText);
          }
        } catch (_) {}
      }
    }

    NarrativeZetaBus.publish('AGENT_STREAM_COMPLETE', agentId, { chars: fullText.length });
    return fullText;
  }

  // ── Council Consult — All agents on a task concurrently ────────
  async consult(prompt, agentIds, options = {}) {
    const sessionId = `council-${Date.now()}`;
    NarrativeZetaBus.publish('COUNCIL_SESSION_START', 'CouncilOrchestrator', { sessionId, agents: agentIds, prompt: prompt.slice(0, 100) });

    const tasks = agentIds.map(id => {
      const agent = this.getAgent(id);
      if (!agent || agent.provider === 'internal') return Promise.resolve({ agentId: id, skipped: true });
      return this.callAgent(id, prompt, options)
        .then(result => ({ ...result, success: true }))
        .catch(err => ({ agentId: id, error: err.message, success: false }));
    });

    const results = await Promise.allSettled(tasks);
    const settled = results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });

    // Cross-validate: check for consensus on key facts
    const consensus = this._buildConsensus(settled);

    NarrativeZetaBus.publish('COUNCIL_SESSION_COMPLETE', 'CouncilOrchestrator', { sessionId, consensus });
    return { sessionId, results: settled, consensus };
  }

  // ── Agent-to-Agent Relay — Chain agents sequentially ──────────
  async relay(prompt, agentChain, options = {}) {
    let currentPrompt = prompt;
    const outputs = [];

    for (const agentId of agentChain) {
      NarrativeZetaBus.publish('RELAY_STEP', 'CouncilOrchestrator', { agentId, inputLength: currentPrompt.length });
      try {
        const result = await this.callAgent(agentId, currentPrompt, {
          ...options,
          history: outputs.map(o => ({ role: 'user', content: o.input })).concat(
            outputs.map(o => ({ role: 'assistant', content: o.output }))
          )
        });
        outputs.push({ agentId, input: currentPrompt, output: result.text });
        // Next agent gets the output of this agent as its prompt
        currentPrompt = result.text;
      } catch (err) {
        outputs.push({ agentId, input: currentPrompt, error: err.message });
        NarrativeZetaBus.publish('RELAY_AGENT_FAILED', agentId, { error: err.message });
        if (options.stopOnError) break;
      }
    }

    return outputs;
  }

  // ── Web Search via Perplexity ──────────────────────────────────
  async webSearch(query, options = {}) {
    return this.callAgent('perplexity-sonar', query, options);
  }

  // ── Code Build Pipeline ────────────────────────────────────────
  // 1. DeepSeek generates → 2. Nemotron reviews → 3. Claude verifies
  async buildCode(specification, options = {}) {
    NarrativeZetaBus.publish('CODE_BUILD_START', 'CouncilOrchestrator', { spec: specification.slice(0, 100) });

    const chain = options.fast
      ? ['deepseek-coder', 'claude-sonnet']
      : ['deepseek-coder', 'nemotron-super', 'claude-sonnet'];

    const results = await this.relay(
      `You are building code for the SIA V6 system. Specification:\n\n${specification}\n\nProduce complete, production-ready code.`,
      chain,
      options
    );

    // Propose the final verified code as a mutation
    const finalOutput = results[results.length - 1]?.output || '';
    if (finalOutput && options.proposeMutation) {
      FileHypervisor.propose({
        path: options.targetPath || 'src/generated.ts',
        operation: 'WRITE',
        content: finalOutput,
        author: 'CouncilOrchestrator',
        chain: chain.join(' → ')
      });
    }

    NarrativeZetaBus.publish('CODE_BUILD_COMPLETE', 'CouncilOrchestrator', { steps: results.length });
    return results;
  }

  // ── Research + Synthesize Pipeline ────────────────────────────
  // 1. Perplexity searches → 2. Gemini analyzes → 3. Nemotron synthesizes
  async research(topic, options = {}) {
    NarrativeZetaBus.publish('RESEARCH_START', 'CouncilOrchestrator', { topic });

    const searchResult = await this.webSearch(topic, options);
    const analysisPrompt = `Based on this research:\n\n${searchResult.text}\n\nAnalyze the key insights relevant to the SIA V6 ecosystem and Darius Savage's sovereign intelligence architecture.`;

    const [geminiResult, nemotronResult] = await Promise.allSettled([
      this.callAgent('gemini-flash', analysisPrompt, options),
      this.callAgent('nemotron-super', analysisPrompt, options)
    ]);

    return {
      rawResearch: searchResult.text,
      geminiAnalysis: geminiResult.status === 'fulfilled' ? geminiResult.value.text : null,
      nemotronSynthesis: nemotronResult.status === 'fulfilled' ? nemotronResult.value.text : null
    };
  }

  _buildConsensus(results) {
    const successful = results.filter(r => r.success && r.text);
    if (successful.length === 0) return { agreement: 'NO_RESULTS', confidence: 0 };
    if (successful.length === 1) return { agreement: 'SINGLE_SOURCE', confidence: 0.6, source: successful[0].agentId };
    // Simple consensus: check if at least half have overlapping key terms
    const texts = successful.map(r => r.text.toLowerCase());
    const wordSets = texts.map(t => new Set(t.split(/\s+/).filter(w => w.length > 5)));
    let overlap = 0;
    if (wordSets.length >= 2) {
      wordSets[0].forEach(w => { if (wordSets.slice(1).every(s => s.has(w))) overlap++; });
    }
    const confidence = Math.min(0.99, 0.5 + (overlap / 100));
    return { agreement: confidence > 0.7 ? 'STRONG' : 'WEAK', confidence, overlap };
  }
}

const CouncilOrchestrator = new CouncilOrchestratorClass();

// ================================================================
// AGENT CHAT SESSION MANAGER
// Maintains multi-turn conversation history per agent
// ================================================================
class AgentChatManager {
  constructor() {
    this.sessions = new Map(); // agentId → message history
  }

  getHistory(agentId) {
    return this.sessions.get(agentId) || [];
  }

  addMessage(agentId, role, content) {
    if (!this.sessions.has(agentId)) this.sessions.set(agentId, []);
    this.sessions.get(agentId).push({ role, content, timestamp: Date.now() });
    // Keep last 20 turns to manage context
    const history = this.sessions.get(agentId);
    if (history.length > 40) history.splice(0, 2); // Remove oldest pair
  }

  clearHistory(agentId) {
    this.sessions.delete(agentId);
  }

  clearAll() {
    this.sessions.clear();
  }

  async sendMessage(agentId, userMessage) {
    const history = this.getHistory(agentId);
    this.addMessage(agentId, 'user', userMessage);
    const result = await CouncilOrchestrator.callAgent(agentId, userMessage, { history: history.slice(0, -1) });
    this.addMessage(agentId, 'assistant', result.text);
    return result;
  }
}

const AgentChat = new AgentChatManager();

// ================================================================
// TASK QUEUE — Sequential task execution with priority
// ================================================================
class TaskQueueClass {
  constructor() {
    this.queue = [];
    this.running = false;
    this.completed = [];
    this.failed = [];
  }

  enqueue(task) {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const entry = { id, ...task, status: 'QUEUED', enqueuedAt: Date.now() };
    this.queue.push(entry);
    NarrativeZetaBus.publish('TASK_QUEUED', 'TaskQueue', { id, type: task.type });
    if (!this.running) this._process();
    return id;
  }

  async _process() {
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      task.status = 'RUNNING';
      task.startedAt = Date.now();
      NarrativeZetaBus.publish('TASK_STARTED', 'TaskQueue', { id: task.id, type: task.type });

      try {
        let result;
        switch (task.type) {
          case 'AGENT_CALL':
            result = await CouncilOrchestrator.callAgent(task.agentId, task.prompt, task.options);
            break;
          case 'COUNCIL_CONSULT':
            result = await CouncilOrchestrator.consult(task.prompt, task.agentIds, task.options);
            break;
          case 'CODE_BUILD':
            result = await CouncilOrchestrator.buildCode(task.specification, task.options);
            break;
          case 'WEB_SEARCH':
            result = await CouncilOrchestrator.webSearch(task.query, task.options);
            break;
          case 'RESEARCH':
            result = await CouncilOrchestrator.research(task.topic, task.options);
            break;
          case 'RELAY':
            result = await CouncilOrchestrator.relay(task.prompt, task.agentChain, task.options);
            break;
          default:
            throw new Error(`Unknown task type: ${task.type}`);
        }
        task.result = result;
        task.status = 'COMPLETE';
        task.completedAt = Date.now();
        this.completed.push(task);
        NarrativeZetaBus.publish('TASK_COMPLETE', 'TaskQueue', { id: task.id, durationMs: task.completedAt - task.startedAt });
        if (task.onComplete) task.onComplete(result);
      } catch (err) {
        task.error = err.message;
        task.status = 'FAILED';
        task.failedAt = Date.now();
        this.failed.push(task);
        NarrativeZetaBus.publish('TASK_FAILED', 'TaskQueue', { id: task.id, error: err.message });
        if (task.onError) task.onError(err);
      }
    }
    this.running = false;
  }

  getStatus() {
    return {
      queued: this.queue.length,
      running: this.running,
      completed: this.completed.length,
      failed: this.failed.length
    };
  }
}

const TaskQueue = new TaskQueueClass();

// ================================================================
// EXPORTS — Attach everything to window for access from app.js
// and from the browser console (sovereign debug mode)
// ================================================================
if (typeof window !== 'undefined') {
  window.OMEGA = {
    // Core
    CouncilOrchestrator,
    AgentChat,
    TaskQueue,
    FileHypervisor,
    NarrativeZetaBus,

    // Registry
    AGENT_REGISTRY,

    // Quick API key setup
    configure(keys) {
      CouncilOrchestrator.setAPIKeys(keys);
      console.log('%c[OMEGA] API Keys configured. Agents online.', 'color: #00ff88; font-weight: bold');
      return this;
    },

    // One-liner shortcuts
    ask: (agentId, msg) => CouncilOrchestrator.callAgent(agentId, msg),
    council: (prompt, agentIds) => CouncilOrchestrator.consult(prompt, agentIds),
    build: (spec, opts) => CouncilOrchestrator.buildCode(spec, opts),
    search: (query) => CouncilOrchestrator.webSearch(query),
    research: (topic) => CouncilOrchestrator.research(topic),
    relay: (prompt, chain) => CouncilOrchestrator.relay(prompt, chain),
    chat: (agentId, msg) => AgentChat.sendMessage(agentId, msg),
    queue: (task) => TaskQueue.enqueue(task),

    // Agent list
    agents: () => AGENT_REGISTRY.map(a => ({ id: a.id, name: a.name, role: a.role, provider: a.provider })),

    // Status
    status: () => ({
      tasks: TaskQueue.getStatus(),
      pendingMutations: FileHypervisor.getPending().length,
      ledger: (new OCPGate()).getLedger().length,
      apiKeys: Object.keys(CouncilOrchestrator.apiKeys).map(k => k.replace(/_API_KEY$/, ''))
    })
  };

  console.log('%c[OMEGA ORCHESTRATOR] Loaded. Call window.OMEGA.configure({ NVIDIA_API_KEY: "...", OPENROUTER_API_KEY: "..." }) to activate agents.', 'color: #00ff88; font-weight: bold; font-size: 14px');
}
