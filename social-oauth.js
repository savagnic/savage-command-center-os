'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const YOUTUBE_DEFAULTS = Object.freeze({
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
  ]
});

function envPrefix(network) {
  return 'SOCIAL_' + String(network).toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function oauthConfig(network, env = process.env) {
  const prefix = envPrefix(network);
  const defaults = network === 'youtube' ? YOUTUBE_DEFAULTS : {};
  const scopes = String(env[prefix + '_SCOPES'] || (defaults.scopes || []).join(' '))
    .split(/[ ,]+/).map((x) => x.trim()).filter(Boolean);
  return {
    network,
    clientId: env[prefix + '_CLIENT_ID'] || null,
    clientSecret: env[prefix + '_CLIENT_SECRET'] || null,
    redirectUri: env[prefix + '_REDIRECT_URI'] || null,
    authorizationUrl: env[prefix + '_AUTHORIZATION_URL'] || defaults.authorizationUrl || null,
    tokenUrl: env[prefix + '_TOKEN_URL'] || defaults.tokenUrl || null,
    scopes
  };
}

function configReadiness(config) {
  const required = ['clientId','clientSecret','redirectUri','authorizationUrl','tokenUrl'];
  const missing = required.filter((key) => !config[key]);
  if (!config.scopes.length) missing.push('scopes');
  return { ready: missing.length === 0, missing };
}

function stateSecret(env = process.env) {
  return env.SOCIAL_OAUTH_STATE_SECRET || env.ADMIN_TOKEN || null;
}

function signState(payload, env = process.env) {
  const secret = stateSecret(env);
  if (!secret) throw new Error('SOCIAL_OAUTH_STATE_SECRET or ADMIN_TOKEN is required');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}

function verifyState(token, env = process.env, maxAgeMs = 10 * 60 * 1000) {
  const secret = stateSecret(env);
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.', 2);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload?.ts || Date.now() - Number(payload.ts) > maxAgeMs) return null;
  return payload;
}

function buildAuthorizationUrl(network, env = process.env) {
  const cfg = oauthConfig(network, env);
  const readiness = configReadiness(cfg);
  if (!readiness.ready) return { ready: false, missing: readiness.missing, config: cfg };
  const state = signState({ network, ts: Date.now(), nonce: crypto.randomUUID() }, env);
  const url = new URL(cfg.authorizationUrl);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', cfg.scopes.join(' '));
  url.searchParams.set('state', state);
  if (network === 'youtube') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
  }
  return { ready: true, url: url.toString(), state, config: cfg };
}

function encryptionKey(env = process.env) {
  const raw = env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  let buf;
  try { buf = Buffer.from(raw, 'base64'); } catch { return null; }
  return buf.length === 32 ? buf : null;
}

function encrypt(value, env = process.env) {
  const key = encryptionKey(env);
  if (!key) throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'A256GCM',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function createTokenStore(filePath, env = process.env) {
  function ensure() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify({ version: 1, tokens: {} }, null, 2));
  }
  function write(network, tokenPayload) {
    ensure();
    const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    state.tokens[network] = {
      encrypted: encrypt(tokenPayload, env),
      updatedAt: new Date().toISOString()
    };
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, filePath);
    return { network, stored: true, updatedAt: state.tokens[network].updatedAt };
  }
  return { write };
}

async function exchangeCode(network, code, env = process.env) {
  const cfg = oauthConfig(network, env);
  const readiness = configReadiness(cfg);
  if (!readiness.ready) throw new Error('OAuth config incomplete: ' + readiness.missing.join(', '));
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri
  });
  const response = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  if (!response.ok) {
    const err = new Error('OAuth token exchange failed with HTTP ' + response.status);
    err.status = response.status;
    err.details = parsed;
    throw err;
  }
  return parsed;
}

module.exports = {
  YOUTUBE_DEFAULTS,
  oauthConfig,
  configReadiness,
  signState,
  verifyState,
  buildAuthorizationUrl,
  encryptionKey,
  encrypt,
  createTokenStore,
  exchangeCode
};
