import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createStore, providerConfig, NETWORKS } = require('../social-control-plane.js');

test('social store persists queue state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'savage-social-'));
  const file = path.join(dir, 'state.json');
  const store = createStore(file);
  const initial = store.read();
  assert.deepEqual(initial.accounts, []);
  assert.deepEqual(initial.posts, []);
  initial.posts.push({ id: 'post_1', status: 'queued' });
  store.write(initial);
  assert.equal(store.read().posts[0].id, 'post_1');
});

test('provider config is environment driven and secret-free', () => {
  const env = {
    SOCIAL_X_CLIENT_ID: 'configured',
    SOCIAL_X_CLIENT_SECRET: 'configured',
    SOCIAL_X_REDIRECT_URI: 'https://example.test/oauth/x/callback'
  };
  const cfg = providerConfig('x', env);
  assert.equal(cfg.clientIdConfigured, true);
  assert.equal(cfg.clientSecretConfigured, true);
  assert.equal(cfg.redirectUri, 'https://example.test/oauth/x/callback');
  assert.equal(Object.prototype.hasOwnProperty.call(cfg, 'clientSecret'), false);
});

test('supported network set covers the first-wave destinations', () => {
  assert.deepEqual(NETWORKS, ['instagram','youtube','x','linkedin','reddit']);
});
