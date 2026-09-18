# savage-command-center-os - Ground Truth

Last verified: 2026-09-17
Canonical branch: master
Working branch: feature/savage-social-control-plane
Pre-ground-truth main HEAD: f3fb418bf434ba5fbd7b71a4a112683f9563441e
Truth status: ACTIVE ESTATE RECORD

## Repository role

Implemented operator/UI donor for Savage Command Center and owned internal social-distribution control surface.

## Current verified state

- This is the implemented operator/UI donor and is distinct from the Savage-Command-Center specification repository.
- The working branch now contains a Savage-owned social control-plane module mounted at /api/social.
- The social slice persists an internal account registry, post queue, schedule state, and evidence receipts without requiring a paid scheduler as the source of truth.
- Supported destination slots are Instagram, YouTube, X, LinkedIn, and Reddit.
- OAuth client IDs/secrets are environment-only; passwords, access tokens, and refresh tokens are not committed.
- Publication is truth-locked: until official provider OAuth adapters are configured, publish attempts produce blocked/connector-ready receipts and do not claim a platform post occurred.
- Tests cover persistence, secret-free provider configuration, and the five-network destination contract.
- Use this repository as the operational UI source where current code evidence supports it.

## Brand inheritance

This repository inherits the Savage AI Studios parent brand authority from savagnic/Savage-AI-style/BRAND_SYSTEM.md: gunmetal/near-black base, seafoam primary signal, scarce purple authority accent, semantic motion where applicable, accessibility, and explicit evidence-state semantics. Product-specific design may differ without silently redefining the parent brand.

## Commercial / deployment state

Internal/operator product surface. The social control plane is an internal cost-reduction and distribution capability, not a newly declared customer-facing product.

## Claim boundary

CODED, TESTED, PLATFORM-BUILT/DEPLOYED, LIVE/OBSERVED, CUSTOMER-USED, and REVENUE-VERIFIED are separate states. Repository activity, README text, automated miners, sibling-repo claims, and synthetic benchmarks do not promote a claim between those states.

## Open work

- Add official OAuth flows and provider adapters for the existing Savage AI Studios Instagram, YouTube, and X identities first.
- Add LinkedIn and Reddit adapters after account creation/authorization.
- Import the Video Studio first-wave 50-post slate into the owned queue.
- Add a dedicated Savage-styled social dashboard panel to the Command Center UI.
- Verify deployment/runtime behavior and record live receipts before claiming automated publication.
- Reconcile documentation when it disagrees with current source/runtime evidence.

## Estate hard rule

Whenever work is performed in this repository, the final repository update must be a full refresh of this GROUND_TRUTH.md.
