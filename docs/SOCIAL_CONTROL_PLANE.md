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
