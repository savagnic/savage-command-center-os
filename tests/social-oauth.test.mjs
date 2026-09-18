import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { oauthConfig, configReadiness, signState, verifyState, buildAuthorizationUrl, encrypt } = require('../social-oauth.js');

test('YouTube has official OAuth endpoint defaults', () => {
  const cfg = oauthConfig('youtube', {});
  assert.equal(cfg.authorizationUrl, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(cfg.tokenUrl, 'https://oauth2.googleapis.com/token');
  assert.ok(cfg.scopes.includes('https://www.googleapis.com/auth/youtube.upload'));
});

test('signed OAuth state verifies and detects tampering', () => {
  const env = { SOCIAL_OAUTH_STATE_SECRET: 'test-secret' };
  const token = signState({ network: 'youtube', ts: Date.now() }, env);
  assert.equal(verifyState(token, env).network, 'youtube');
  assert.equal(verifyState(token + 'x', env), null);
});

test('authorization URL is generated only when config is complete', () => {
  const env = {
    SOCIAL_OAUTH_STATE_SECRET: 'state-secret',
    SOCIAL_YOUTUBE_CLIENT_ID: 'client',
    SOCIAL_YOUTUBE_CLIENT_SECRET: 'secret',
    SOCIAL_YOUTUBE_REDIRECT_URI: 'https://example.test/api/social/oauth/youtube/callback'
  };
  const out = buildAuthorizationUrl('youtube', env);
  assert.equal(out.ready, true);
  const url = new URL(out.url);
  assert.equal(url.searchParams.get('client_id'), 'client');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.ok(url.searchParams.get('state'));
});

test('token envelopes use AES-256-GCM and never expose plaintext', () => {
  const key = crypto.randomBytes(32).toString('base64');
  const out = encrypt({ access_token: 'super-secret-token' }, { SOCIAL_TOKEN_ENCRYPTION_KEY: key });
  assert.equal(out.alg, 'A256GCM');
  assert.equal(JSON.stringify(out).includes('super-secret-token'), false);
});

test('X remains blocked until its app endpoints and scopes are configured', () => {
  const cfg = oauthConfig('x', { SOCIAL_X_CLIENT_ID: 'x', SOCIAL_X_CLIENT_SECRET: 's' });
  const readiness = configReadiness(cfg);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.includes('authorizationUrl'));
});
