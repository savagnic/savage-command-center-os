"""
security_audit_harness.py
Automated adversarial test suite for the capability gateway + nonce ledger.
Run before every deploy per issue #16 Phase 5 ("treat privileged bridge as root").
Exit code 0 == PASS, non-zero == FAIL, block deploy on failure.
"""
import sys
import random


def fuzz_replay_attack(authorize_fn, session_id: str, cap: str, attempts: int = 1000) -> dict:
    successes = sum(1 for _ in range(attempts) if authorize_fn(session_id, cap))
    return {"attempts": attempts, "unauthorized_successes": successes}


def fuzz_privilege_escalation(request_action_fn, low_priv_action: str, attempts: int = 500) -> dict:
    escalations = 0
    for _ in range(attempts):
        forged_nonce = f"forged-{random.randint(0, 999999)}"
        if request_action_fn(low_priv_action, "attacker", forged_nonce, False):
            escalations += 1
    return {"attempts": attempts, "escalations_succeeded": escalations}


def audit_report(results: list) -> str:
    total_failures = sum(
        r.get("unauthorized_successes", 0) + r.get("escalations_succeeded", 0) for r in results
    )
    return "PASS" if total_failures == 0 else f"FAIL: {total_failures} security violations detected"


if __name__ == "__main__":
      # FAIL CLOSED: this harness has no real authorize()/requestAction() bindings
      # wired yet. Until the Node service exposes a subprocess/HTTP test hook and
      # the fuzz functions above run against it, this harness must NOT report PASS.
      # Exit non-zero so any CI gate using it blocks the deploy instead of
      # silently green-lighting unverified security.
      print(
          "security_audit_harness.py: FAIL (no real bindings wired). "
          "Wire authorize()/requestAction() from the Node service before this "
          "harness can pass.",
          file=sys.stderr,
      )
      sys.exit(1)
    