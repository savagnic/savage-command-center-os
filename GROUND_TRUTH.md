# savage-command-center-os - Ground Truth

Last verified: 2026-09-17
Canonical branch: master
Working branch: feature/savage-social-control-plane
Pre-ground-truth main HEAD: f3fb418bf434ba5fbd7b71a4a112683f9563441e
Truth status: ACTIVE ESTATE RECORD

## Repository role

Implemented operator/UI donor for Savage Command Center and owned internal social-distribution control surface.

## Current verified state

- This is the implemented operator/UI donor and remains distinct from the Savage-Command-Center specification repository.
- The working branch contains a Savage-owned social control plane mounted at /api/social.
- The social slice persists an internal account registry, post queue, schedule state, configurable growth-metric weights, raw metric observations, and evidence receipts without requiring a paid scheduler as the source of truth.
- Supported destination slots are Instagram, YouTube, X, LinkedIn, and Reddit.
- A dedicated Savage-styled dashboard is present at /social.html using the parent gunmetal / seafoam / restrained-purple visual system.
- The dashboard now exposes operator actions to connect Instagram, YouTube, and X through the owned OAuth flow.
- OAuth state is HMAC-signed with a short validity window. OAuth access/refresh token payloads are stored only in an AES-256-GCM encrypted token store when SOCIAL_TOKEN_ENCRYPTION_KEY is configured.
- YouTube uses official Google OAuth web-server defaults with youtube.upload and youtube.readonly scopes.
- X and Instagram are fail-closed until their app-specific authorization URL, token URL, scopes, client ID, client secret, and redirect URI are explicitly configured. No guessed provider endpoints are treated as valid.
- OAuth client IDs/secrets are environment-only; passwords, plaintext access tokens, and plaintext refresh tokens are not committed.
- Publication is truth-locked: until official provider publishing adapters are configured, publish attempts produce blocked/connector-ready receipts and do not claim a platform post occurred.
- The canonical Video Studio launch slate was verified at savagnic/savage-video-studio/artifacts/video-studio/launch-slate.json with source blob d197942595ac3007ab0f226c6fa72cf0939885ab.
- That source contains 450 total briefs and a first wave of exactly 50 briefs: 10 each for YouTube, Instagram, X, Reddit, and LinkedIn.
- A portable copy of only those 50 canonical first-wave briefs is embedded at data/social-first-wave.json, and /api/social/imports/first-wave imports them idempotently into the owned queue.
- The growth-math engine supports hold, completion, rewatch, share, save, comment, follow, click, and revenue rates with editable normalized weights.
- Derived internal diagnostics include depth, signal density, commercial score, overall Savage Growth Score, and scale / iterate / test / cut decision bands.
- These decision bands are internal operating rules, not external benchmark claims.
- Tests cover social-state persistence, secret-free provider configuration, supported networks, deterministic bounded growth scoring, weight normalization, decision bands, composite score exposure, OAuth state signing/tamper resistance, YouTube OAuth defaults, authorization URL generation, and AES-GCM token envelopes.

## Brand inheritance

This repository inherits the Savage AI Studios parent brand authority from savagnic/Savage-AI-style/BRAND_SYSTEM.md: gunmetal/near-black base, seafoam primary signal, scarce purple authority accent, semantic motion where applicable, accessibility, and explicit evidence-state semantics. Product-specific design may differ without silently redefining the parent brand.

## Commercial / deployment state

Internal/operator product surface. The social control plane is an internal cost-reduction, owned-distribution, and growth-instrumentation capability, not a newly declared customer-facing product.

## Claim boundary

CODED, TESTED, PLATFORM-BUILT/DEPLOYED, LIVE/OBSERVED, CUSTOMER-USED, and REVENUE-VERIFIED are separate states. Repository activity, README text, automated miners, sibling-repo claims, and synthetic benchmarks do not promote a claim between those states.

## Open work

- Add the real platform application credentials and redirect URIs for the existing Savage AI Studios Instagram, YouTube, and X identities.
- Complete official provider publishing adapters after OAuth authorization succeeds.
- Add LinkedIn and Reddit OAuth/publishing adapters after account creation/authorization.
- Run /api/social/imports/first-wave in the deployed runtime and verify all 50 records are present in the owned queue.
- Connect platform analytics ingestion so raw metrics are collected automatically rather than entered through the API.
- Verify deployed dashboard/runtime behavior and record live publication receipts before claiming automated publication.
- Reconcile documentation when it disagrees with current source/runtime evidence.

## Estate hard rule

Whenever work is performed in this repository, the final repository update must be a full refresh of this GROUND_TRUTH.md.
