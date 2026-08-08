/**
 * Nonce Ledger — production implementation
 *
 * Prevents replay attacks by tracking consumed single-use nonces.
 * Each nonce is valid for one use within its TTL window.
 *
 * - Nonces are opaque strings (UUIDs or random hex)
 * - After consume() returns true, the nonce is burned and can never be reused
 * - Expired nonces are pruned automatically on each consume() call
 * - Singleton pattern — use NonceLedger.getInstance()
 *
 * Usage:
 *   const ledger = NonceLedger.getInstance();
 *   const nonce = ledger.issue();         // server-side: issue a nonce
 *   const ok = ledger.consume(nonce);    // server-side: validate + burn
 */

import { randomBytes } from 'crypto';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_LEDGER_SIZE = 10_000;       // prevent unbounded growth

export class NonceLedger {
  static _instance = null;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    /** @type {Map<string, number>} nonce -> expiry epoch ms */
    this._issued = new Map();
    this._ttlMs = ttlMs;
  }

  static getInstance() {
    if (!NonceLedger._instance) {
      NonceLedger._instance = new NonceLedger();
    }
    return NonceLedger._instance;
  }

  /**
   * Issues a new single-use nonce valid for ttlMs.
   * @returns {string} hex nonce
   */
  issue(ttlMs) {
    this._prune();
    if (this._issued.size >= MAX_LEDGER_SIZE) {
      // Evict oldest 10% to keep memory bounded
      const entries = [...this._issued.entries()].sort((a, b) => a[1] - b[1]);
      entries.slice(0, Math.ceil(MAX_LEDGER_SIZE * 0.1)).forEach(([k]) => this._issued.delete(k));
    }
    const nonce = randomBytes(24).toString('hex');
    this._issued.set(nonce, Date.now() + (ttlMs ?? this._ttlMs));
    return nonce;
  }

  /**
   * Validates and burns a nonce.
   * @param {string} nonce
   * @returns {boolean} true if valid and not yet consumed; false if invalid, expired, or replayed
   */
  consume(nonce) {
    if (!nonce || typeof nonce !== 'string') return false;
    this._prune();
    const expiry = this._issued.get(nonce);
    if (expiry === undefined) return false; // unknown or already consumed
    if (Date.now() > expiry) {
      this._issued.delete(nonce);
      return false; // expired
    }
    this._issued.delete(nonce); // burn
    return true;
  }

  /**
   * Checks if a nonce is valid without consuming it. Useful for preflight checks.
   */
  peek(nonce) {
    if (!nonce) return false;
    const expiry = this._issued.get(nonce);
    return expiry !== undefined && Date.now() <= expiry;
  }

  /** Total number of live (unexpired) nonces in the ledger. */
  get size() {
    this._prune();
    return this._issued.size;
  }

  /** Removes expired nonces. Called automatically by consume() and issue(). */
  _prune() {
    const now = Date.now();
    for (const [k, expiry] of this._issued) {
      if (now > expiry) this._issued.delete(k);
    }
  }

  /** Clears all nonces. Useful for testing. */
  reset() {
    this._issued.clear();
  }
}

export default NonceLedger;
