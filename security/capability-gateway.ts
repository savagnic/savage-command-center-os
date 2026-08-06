// capability-gateway.ts
// Replaces the unrestricted `case 'exec':` in server.js with scoped, revocable, time-boxed grants.
// See AGENTS.md / issue #16 Phase 2 note: "treat privileged bridge like root access."

export type Capability =
  | 'read_file'
  | 'list_files'
  | 'write_file'
  | 'exec_sandboxed'
  | 'exec_privileged'
  | 'delete_file';

export interface SessionGrant {
  sessionId: string;
  capabilities: Set<Capability>;
  expiresAt: number;
}

export class CapabilityGateway {
  private grants = new Map<string, SessionGrant>();

  grant(sessionId: string, caps: Capability[], ttlMs = 15 * 60 * 1000): void {
    this.grants.set(sessionId, {
      sessionId,
      capabilities: new Set(caps),
      expiresAt: Date.now() + ttlMs,
    });
  }

  revoke(sessionId: string): void {
    this.grants.delete(sessionId);
  }

  authorize(sessionId: string, cap: Capability): boolean {
    const grant = this.grants.get(sessionId);
    if (!grant || Date.now() > grant.expiresAt) return false;
    return grant.capabilities.has(cap);
  }

  sweepExpired(): number {
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
