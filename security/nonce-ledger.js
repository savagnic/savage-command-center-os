// nonce-ledger.js — CommonJS runtime port of nonce-ledger.ts
// Closes the replay-to-exec vulnerability of the static ADMIN_TOKEN model:
// every privileged WS message must carry a fresh nonce + timestamp that is
// validated here before any capability check runs.
'use strict';

class NonceLedger {
  constructor(windowMs = 5000) {
    /** @type {Map<string, number>} */
    this.seen = new Map();
    this.windowMs = windowMs;
  }

  verify(nonce, timestampMs) {
    if (typeof nonce !== 'string' || nonce.length < 8) return false;
    if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) return false;
    const now = Date.now();
    if (Math.abs(now - timestampMs) > this.windowMs) return false;
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, now);
    this.sweep(now);
    return true;
  }

  sweep(now) {
    for (const [nonce, seenAt] of this.seen) {
      if (now - seenAt > this.windowMs * 2) this.seen.delete(nonce);
    }
  }
}

module.exports = { NonceLedger };
