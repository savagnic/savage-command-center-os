'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { DEFAULT_WEIGHTS, evaluateCreative, normalizeWeights } = require('./social-metrics.js');

const NETWORKS = Object.freeze(['instagram','youtube','x','linkedin','reddit']);
const DEFAULT_STATE = Object.freeze({ version: 1, accounts: [], posts: [], receipts: [], metricWeights: DEFAULT_WEIGHTS, metrics: [] });

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso() { return new Date().toISOString(); }
function id(prefix) { return prefix + '_' + crypto.randomUUID(); }

function createStore(filePath) {
  function ensure() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(DEFAULT_STATE, null, 2));
  }
  function read() {
    ensure();
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  function write(state) {
    ensure();
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, filePath);
    return state;
  }
  return { read, write };
}

function providerConfig(network, env = process.env) {
  const prefix = 'SOCIAL_' + network.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return {
    network,
    clientIdConfigured: Boolean(env[prefix + '_CLIENT_ID']),
    clientSecretConfigured: Boolean(env[prefix + '_CLIENT_SECRET']),
    redirectUri: env[prefix + '_REDIRECT_URI'] || null
  };
}

function createSocialControlPlane(options = {}) {
  const statePath = options.statePath || process.env.SOCIAL_STATE_PATH || path.join(__dirname, 'data', 'social-control-plane.json');
  const store = createStore(statePath);
  const router = express.Router();

  router.get('/status', (_req, res) => {
    const state = store.read();
    res.json({
      service: 'savage-social-control-plane',
      brand: 'Savage AI Studios',
      timezone: process.env.SOCIAL_TIMEZONE || 'America/Los_Angeles',
      networks: NETWORKS.map((network) => providerConfig(network)),
      counts: {
        accounts: state.accounts.length,
        queued: state.posts.filter((p) => p.status === 'queued').length,
        scheduled: state.posts.filter((p) => p.status === 'scheduled').length,
        published: state.posts.filter((p) => p.status === 'published').length,
        failed: state.posts.filter((p) => p.status === 'failed').length
      }
    });
  });

  router.get('/accounts', (_req, res) => res.json(store.read().accounts));

  router.post('/accounts', (req, res) => {
    const network = String(req.body?.network || '').toLowerCase();
    if (!NETWORKS.includes(network)) return res.status(400).json({ error: 'unsupported network' });
    const state = store.read();
    const account = {
      id: id('acct'),
      network,
      label: String(req.body?.label || 'Savage AI Studios'),
      handle: req.body?.handle ? String(req.body.handle) : null,
      loginEmail: req.body?.loginEmail ? String(req.body.loginEmail) : null,
      connectionStatus: 'needs_oauth',
      createdAt: nowIso()
    };
    state.accounts.push(account);
    store.write(state);
    res.status(201).json(account);
  });

  router.post('/imports/first-wave', (_req, res) => {
    const seedPath = path.join(__dirname, 'data', 'social-first-wave.json');
    if (!fs.existsSync(seedPath)) return res.status(404).json({ error: 'first-wave seed not found' });
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const firstWave = Array.isArray(seed.firstWave) ? seed.firstWave : [];
    const state = store.read();
    const existing = new Set(state.posts.map((p) => p.sourceId).filter(Boolean));
    let imported = 0;
    for (const brief of firstWave) {
      if (!brief?.id || existing.has(brief.id)) continue;
      const network = String(brief.platform || '').toLowerCase();
      if (!NETWORKS.includes(network)) continue;
      state.posts.push({
        id: id('post'),
        sourceId: brief.id,
        title: brief.cutId || brief.id,
        text: String(brief.voiceover || ''),
        media: [],
        networks: [network],
        scheduledFor: null,
        status: 'queued',
        source: 'savage-video-studio:firstWave',
        creative: {
          durationSeconds: brief.durationSeconds ?? null,
          aspectRatio: brief.aspectRatio ?? null,
          resolution: brief.resolution ?? null,
          overlays: Array.isArray(brief.overlays) ? brief.overlays : [],
          cta: brief.cta || null,
          proofRefs: Array.isArray(brief.proofRefs) ? brief.proofRefs : [],
          score: brief.score || null
        },
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      existing.add(brief.id);
      imported++;
    }
    store.write(state);
    res.json({
      imported,
      firstWaveCount: firstWave.length,
      queueSize: state.posts.length,
      sourceBlobSha: seed.sourceBlobSha || null
    });
  });

  router.get('/posts', (_req, res) => res.json(store.read().posts));

  router.post('/posts', (req, res) => {
    const networks = Array.isArray(req.body?.networks) ? req.body.networks.map((x) => String(x).toLowerCase()) : [];
    const invalid = networks.filter((n) => !NETWORKS.includes(n));
    if (!networks.length || invalid.length) return res.status(400).json({ error: 'valid networks required', invalid });
    const state = store.read();
    const post = {
      id: id('post'),
      title: String(req.body?.title || 'Untitled post'),
      text: String(req.body?.text || ''),
      media: Array.isArray(req.body?.media) ? req.body.media : [],
      networks,
      scheduledFor: req.body?.scheduledFor || null,
      status: req.body?.scheduledFor ? 'scheduled' : 'queued',
      source: req.body?.source || 'manual',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    state.posts.push(post);
    store.write(state);
    res.status(201).json(post);
  });

  router.patch('/posts/:id', (req, res) => {
    const state = store.read();
    const post = state.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'post not found' });
    for (const key of ['title','text','media','scheduledFor','status']) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) post[key] = req.body[key];
    }
    post.updatedAt = nowIso();
    store.write(state);
    res.json(post);
  });

  router.post('/posts/:id/publish-attempt', (req, res) => {
    const state = store.read();
    const post = state.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'post not found' });
    const missing = post.networks.filter((network) => {
      const cfg = providerConfig(network);
      return !cfg.clientIdConfigured || !cfg.clientSecretConfigured;
    });
    const receipt = {
      id: id('receipt'),
      postId: post.id,
      attemptedAt: nowIso(),
      result: missing.length ? 'blocked_missing_oauth_config' : 'connector_ready_not_published',
      networks: clone(post.networks),
      missingOAuthConfig: missing
    };
    state.receipts.push(receipt);
    if (missing.length) post.status = 'blocked';
    post.updatedAt = nowIso();
    store.write(state);
    res.status(missing.length ? 409 : 202).json(receipt);
  });

  router.get('/metrics/config', (_req, res) => {
    const state = store.read();
    res.json({ weights: normalizeWeights(state.metricWeights || DEFAULT_WEIGHTS) });
  });

  router.put('/metrics/config', (req, res) => {
    const state = store.read();
    state.metricWeights = normalizeWeights(req.body?.weights || {});
    store.write(state);
    res.json({ weights: state.metricWeights });
  });

  router.post('/metrics', (req, res) => {
    const state = store.read();
    const postId = String(req.body?.postId || '');
    const post = state.posts.find((p) => p.id === postId);
    if (!post) return res.status(404).json({ error: 'post not found' });
    const evaluation = evaluateCreative(req.body?.metrics || {}, state.metricWeights || DEFAULT_WEIGHTS);
    const record = {
      id: id('metric'),
      postId,
      network: req.body?.network ? String(req.body.network).toLowerCase() : null,
      capturedAt: nowIso(),
      evaluation
    };
    state.metrics = Array.isArray(state.metrics) ? state.metrics : [];
    state.metrics.push(record);
    store.write(state);
    res.status(201).json(record);
  });

  router.get('/metrics', (_req, res) => {
    const state = store.read();
    const items = Array.isArray(state.metrics) ? state.metrics : [];
    res.json(items);
  });

  router.get('/receipts', (_req, res) => res.json(store.read().receipts));

  return { router, store, NETWORKS };
}

module.exports = { createSocialControlPlane, createStore, providerConfig, NETWORKS };
