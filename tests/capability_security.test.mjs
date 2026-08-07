import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CapabilityGateway, CAPABILITIES } = require('../security/capability-gateway.js');
const { NonceLedger } = require('../security/nonce-ledger.js');

test('CapabilityGateway - grant authorizes only granted capabilities', () => {
  const gw = new CapabilityGateway();
  gw.grant('s1', ['read_file', 'list_files']);
  assert.equal(gw.authorize('s1', 'read_file'), true);
  assert.equal(gw.authorize('s1', 'list_files'), true);
  assert.equal(gw.authorize('s1', 'exec_privileged'), false);
  assert.equal(gw.authorize('unknown-session', 'read_file'), false);
});

test('CapabilityGateway - revoke removes all access', () => {
  const gw = new CapabilityGateway();
  gw.grant('s1', ['write_file']);
  gw.revoke('s1');
  assert.equal(gw.authorize('s1', 'write_file'), false);
});

test('CapabilityGateway - grants expire after TTL and sweep removes them', async () => {
  const gw = new CapabilityGateway();
  gw.grant('s1', ['read_file'], 20); // 20ms TTL
  assert.equal(gw.authorize('s1', 'read_file'), true);
  await new Promise(r => setTimeout(r, 40));
  assert.equal(gw.authorize('s1', 'read_file'), false);
  assert.equal(gw.sweepExpired(), 1);
});

test('CapabilityGateway - rejects unknown capability names at grant time', () => {
  const gw = new CapabilityGateway();
  assert.throws(() => gw.grant('s1', ['root_everything']));
  assert.ok(CAPABILITIES.includes('exec_privileged'));
});

test('NonceLedger - accepts fresh nonce, rejects replay', () => {
  const nl = new NonceLedger(5000);
  const now = Date.now();
  assert.equal(nl.verify('nonce-abc-123', now), true);
  assert.equal(nl.verify('nonce-abc-123', now), false, 'replayed nonce must be rejected');
  assert.equal(nl.verify('nonce-def-456', now), true);
});

test('NonceLedger - rejects stale and future timestamps outside window', () => {
  const nl = new NonceLedger(5000);
  const now = Date.now();
  assert.equal(nl.verify('nonce-stale-001', now - 6000), false);
  assert.equal(nl.verify('nonce-future-01', now + 6000), false);
});

test('NonceLedger - rejects malformed nonce/ts', () => {
  const nl = new NonceLedger(5000);
  assert.equal(nl.verify(undefined, Date.now()), false);
  assert.equal(nl.verify('short', Date.now()), false);
  assert.equal(nl.verify('nonce-valid-len', 'not-a-number'), false);
});
