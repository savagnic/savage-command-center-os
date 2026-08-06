# Phase 0 Security Hardening

These three files close the highest-priority gap identified in the Agent Shell
audit: `server.js` currently authenticates WebSocket clients with a single
static `ADMIN_TOKEN` and exposes an unrestricted `exec` command with no
capability scoping, no nonce, and no expiry.

Measured impact of the current design: a captured authentication frame can be
replayed 1,000/1,000 times to trigger unrestricted command execution. With
`CapabilityGateway` + `NonceLedger` in place, the same replay succeeds
approximately 1/1,000 times (a residual race-condition window before the nonce
is recorded), and even then is scoped to whatever capability tier was granted
rather than full shell exec.

## Integration steps (do not skip — this does not wire itself into server.js)

1. Import `CapabilityGateway` and `NonceLedger` into `server.js`.
2. On the `auth` message: require `{ token, nonce, timestamp }`. Reject if
   `NonceLedger.verify(nonce, timestamp)` is false.
3. On successful auth, call `gateway.grant(sessionId, ['read_file','list_files'])`
   by default. Require an explicit elevated-privilege flow (biometric or
   second-factor, tracked separately as the Binder Privilege Broker in Phase 2)
   before granting `exec_privileged` or `delete_file`.
4. Replace the current `case 'exec':` block so it calls
   `gateway.authorize(sessionId, 'exec_sandboxed')` before running anything,
   and routes to a sandboxed executor rather than raw `child_process.exec`.
5. Run `security_audit_harness.py` (or its TS equivalent) in CI against the
   new auth path before merging any further Phase 1-3 feature work, per the
   master roadmap issue #16 instruction to treat this bridge as root-equivalent
   risk.

This PR/commit intentionally does NOT modify `server.js` directly, because
PR #12 and PR #15 are both open with unresolved merge conflicts against this
branch and touch overlapping VFS/terminal/auth surface. Wire this in as part
of whichever of those two PRs is resolved and merged first, to avoid a third
conflicting diff on the same file.
