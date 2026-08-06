// nonce-ledger.ts
// Closes the measured 1000/1000 replay-to-exec vulnerability in the current
// static ADMIN_TOKEN auth model (server.js). Every privileged WS message must
// carry a fresh nonce + timestamp validated here before authorize() is checked.

export class NonceLedger {
  private seen = new Map<string, number>();
  private readonly windowMs = 5000;

  verify(nonce: string, timestampMs: number): boolean {
    const now = Date.now();
    if (Math.abs(now - timestampMs) > this.windowMs) return false;
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, now);
    this.sweep(now);
    return true;
  }

  private sweep(now: number): void {
    for (const [nonce, seenAt] of this.seen) {
      if (now - seenAt > this.windowMs * 2) this.seen.delete(nonce);
    }
  }
}
