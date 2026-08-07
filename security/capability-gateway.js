// capability-gateway.js — CommonJS runtime port of capability-gateway.ts
// Scoped, revocable, time-boxed capability grants for the Substrate Agent
// WebSocket. The .ts file remains the typed specification; this module is
// what server.js actually loads.
'use strict';

const CAPABILITIES = Object.freeze([
  'read_file',
  'list_files',
  'write_file',
  'exec_sandboxed',
  'exec_privileged',
  'delete_file',
]);

class CapabilityGateway {
  constructor() {
    /** @type {Map<string, {sessionId:string, capabilities:Set<string>, expiresAt:number}>} */
    this.grants = new Map();
  }

  grant(sessionId, caps, ttlMs = 15 * 60 * 1000) {
    for (const cap of caps) {
      if (!CAPABILITIES.includes(cap)) {
        throw new Error(`Unknown capability: ${cap}`);
      }
    }
    this.grants.set(sessionId, {
      sessionId,
      capabilities: new Set(caps),
      expiresAt: Date.now() + ttlMs,
    });
  }

  revoke(sessionId) {
    this.grants.delete(sessionId);
  }

  authorize(sessionId, cap) {
    const grant = this.grants.get(sessionId);
    if (!grant || Date.now() > grant.expiresAt) return false;
    return grant.capabilities.has(cap);
  }

  sweepExpired() {
    const now = Date.now();
    let removed = 0;
    for (const [id, g] of this.grants) {
      if (now > g.expiresAt) {
        this.grants.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

module.exports = { CapabilityGateway, CAPABILITIES };
