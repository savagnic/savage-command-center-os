#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { createStore } = require('../social-control-plane.js');

const source = process.argv[2] || path.resolve(__dirname, '../../savage-video-studio/artifacts/video-studio/launch-slate.json');
const statePath = process.env.SOCIAL_STATE_PATH || path.resolve(__dirname, '../data/social-control-plane.json');

if (!fs.existsSync(source)) {
  console.error('Launch slate not found:', source);
  process.exit(2);
}

const slate = JSON.parse(fs.readFileSync(source, 'utf8'));
const firstWave = Array.isArray(slate.firstWave) ? slate.firstWave : [];
if (!firstWave.length) {
  console.error('No firstWave entries found in', source);
  process.exit(3);
}

const networkMap = { x: 'x', youtube: 'youtube', instagram: 'instagram', reddit: 'reddit', linkedin: 'linkedin' };
const store = createStore(statePath);
const state = store.read();
const existing = new Set(state.posts.map((p) => p.sourceId).filter(Boolean));
let imported = 0;

for (const brief of firstWave) {
  if (existing.has(brief.id)) continue;
  const network = networkMap[String(brief.platform || '').toLowerCase()];
  if (!network) continue;
  state.posts.push({
    id: 'post_' + brief.id,
    sourceId: brief.id,
    title: brief.title || brief.cutId || brief.id,
    text: brief.voiceover || '',
    media: [],
    networks: [network],
    scheduledFor: null,
    status: 'queued',
    source: 'savage-video-studio:firstWave',
    creative: {
      durationSeconds: brief.durationSeconds,
      aspectRatio: brief.aspectRatio,
      resolution: brief.resolution,
      overlays: brief.overlays || [],
      cta: brief.cta || null,
      proofRefs: brief.proofRefs || []
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  imported++;
}
store.write(state);
console.log(JSON.stringify({ imported, totalFirstWave: firstWave.length, queueSize: state.posts.length, source }, null, 2));
