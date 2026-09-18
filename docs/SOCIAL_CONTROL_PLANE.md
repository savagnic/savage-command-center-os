# Savage Social Control Plane

Internal distribution surface for Savage AI Studios. This is part of Command Center, not a separate commercial product.

## Purpose

Own the queue, account registry, scheduling state, and evidence receipts for social distribution without depending on a paid scheduler as the source of truth.

Supported destination slots:
- Instagram
- YouTube
- X
- LinkedIn
- Reddit

## Security model

OAuth client IDs and secrets are environment variables only. Never commit access tokens, refresh tokens, passwords, or platform secrets.

Environment naming:
- SOCIAL_INSTAGRAM_CLIENT_ID / SOCIAL_INSTAGRAM_CLIENT_SECRET
- SOCIAL_YOUTUBE_CLIENT_ID / SOCIAL_YOUTUBE_CLIENT_SECRET
- SOCIAL_X_CLIENT_ID / SOCIAL_X_CLIENT_SECRET
- SOCIAL_LINKEDIN_CLIENT_ID / SOCIAL_LINKEDIN_CLIENT_SECRET
- SOCIAL_REDDIT_CLIENT_ID / SOCIAL_REDDIT_CLIENT_SECRET
- optional SOCIAL_<NETWORK>_REDIRECT_URI
- optional SOCIAL_STATE_PATH
- optional SOCIAL_TIMEZONE, default America/Los_Angeles

## API

Mounted at /api/social.

- GET /status
- GET/POST /accounts
- GET/POST /posts
- PATCH /posts/:id
- POST /posts/:id/publish-attempt
- GET /receipts

The publish-attempt endpoint is intentionally truth-locked. Until a real OAuth provider adapter is configured, it records a blocked or connector-ready receipt and does not claim publication.

## Next implementation slice

Add official OAuth flows and provider adapters one network at a time, beginning with the existing Savage AI Studios Instagram, YouTube, and X identities. Then import the Video Studio 50-post first wave into this queue.


## Savage growth math

The control plane stores raw normalized rates separately from the derived score. Current default inputs are hold rate, completion rate, rewatch rate, share rate, save rate, comment rate, follow rate, click rate, and revenue rate.

Weights are operator-editable and automatically normalized to sum to 1. The current default weighting intentionally emphasizes hold/completion, shares/saves, follows, and direct commercial signal more than comments.

The dashboard exposes three diagnostic composites: depth (hold + completion + rewatch), signal density (shares + saves + comments + follows + clicks), and commercial (clicks + revenue).

The overall Savage Growth Score is a 0-100 weighted score. Current operating bands are scale >= 70, iterate >= 50, test >= 30, cut < 30. These are internal decision rules, not external benchmark claims, and can be changed as evidence accumulates.

Metrics endpoints:
- GET /api/social/metrics/config
- PUT /api/social/metrics/config
- GET /api/social/metrics
- POST /api/social/metrics
