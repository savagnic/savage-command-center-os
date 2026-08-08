/**
 * security_regression.test.mjs
 *
 * Regression tests for:
 *  (1) safeWorkspacePath — sibling-prefix traversal, absolute escape, normal cases
 *  (2) safeConnectorPath — connector ID whitelist, path injection prevention
 *  (3) WS integration — path traversal blocked end-to-end over live socket
 *  (4) WS integration — missing connector returns success:false (not a fake success)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Unit tests: safeWorkspacePath and safeConnectorPath ──────────────────────
const require = createRequire(import.meta.url);
const { safeWorkspacePath, safeConnectorPath, WORKSPACE_ROOT } = require('../server.js');

test('safeWorkspacePath - normal relative path resolves inside workspace', () => {
  const result = safeWorkspacePath('app.js');
  assert.ok(result !== null, 'normal path should resolve');
  assert.ok(result.startsWith(WORKSPACE_ROOT + path.sep), 'must be inside workspace');
});

test('safeWorkspacePath - workspace root itself is allowed', () => {
  const result = safeWorkspacePath('.');
  assert.ok(result !== null, 'workspace root itself should be allowed');
  assert.equal(result, WORKSPACE_ROOT);
});

test('safeWorkspacePath - simple path traversal ../ is blocked', () => {
  const result = safeWorkspacePath('../outside.txt');
  assert.equal(result, null, 'simple ../ traversal must be blocked');
});

test('safeWorkspacePath - sibling-prefix attack blocked (e.g. /app-evil when root is /app)', () => {
  // Craft a path that would resolve to a sibling directory sharing a prefix
  // with the workspace root.  e.g. if workspace=/some/path then
  // /some/path-evil must be rejected even though it starts with /some/path.
  const siblingPath = WORKSPACE_ROOT + '-evil/secret.txt';
  const result = safeWorkspacePath(siblingPath);
  assert.equal(result, null, 'sibling-prefix path must be blocked');
});

test('safeWorkspacePath - absolute path outside workspace is blocked', () => {
  const result = safeWorkspacePath('/etc/passwd');
  assert.equal(result, null, 'absolute path outside workspace must be blocked');
});

test('safeWorkspacePath - deeply nested traversal is blocked', () => {
  const result = safeWorkspacePath('sub/dir/../../../../etc/shadow');
  assert.equal(result, null, 'deep traversal must be blocked');
});

test('safeWorkspacePath - nested path inside workspace is allowed', () => {
  const result = safeWorkspacePath('security/audit.log');
  assert.ok(result !== null, 'nested path inside workspace should resolve');
  assert.ok(result.startsWith(WORKSPACE_ROOT + path.sep));
});

// ── Connector ID whitelist ──────────────────────────────────────────────────
test('safeConnectorPath - valid connector id resolves a path inside workspace', () => {
  const result = safeConnectorPath('github_mcp');
  assert.ok(result !== null);
  assert.ok(result.startsWith(WORKSPACE_ROOT + path.sep));
  assert.ok(result.endsWith('github_mcp.js'));
});

test('safeConnectorPath - connector id with path separators is rejected', () => {
  assert.equal(safeConnectorPath('../server'), null);
  assert.equal(safeConnectorPath('../../etc/passwd'), null);
  assert.equal(safeConnectorPath('sub/connector'), null);
});

test('safeConnectorPath - connector id with special chars is rejected', () => {
  assert.equal(safeConnectorPath('evil; rm -rf /'), null);
  assert.equal(safeConnectorPath('evil.js'), null);   // dot not allowed
  assert.equal(safeConnectorPath('UPPER'), null);      // uppercase not allowed
  assert.equal(safeConnectorPath('with-hyphen'), null);
});

test('safeConnectorPath - empty connector id is rejected', () => {
  assert.equal(safeConnectorPath(''), null);
});

test('safeConnectorPath - connector id too long is rejected', () => {
  const longId = 'a'.repeat(65);
  assert.equal(safeConnectorPath(longId), null);
});

// ── WS integration: path traversal blocked end-to-end ───────────────────────
const WS_PORT = 3897;
const WS_TOKEN = 'test-sec-reg-' + randomUUID();
let wsServer;

test.before(async () => {
  wsServer = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(WS_PORT), ADMIN_TOKEN: WS_TOKEN },
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${WS_PORT}/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('server did not start for regression tests');
});

test.after(() => { if (wsServer) wsServer.kill(); });

async function wsRequest(ws, payload) {
  return new Promise((resolve, reject) => {
    const onMessage = (raw) => {
      ws.off('message', onMessage);
      resolve(JSON.parse(raw.toString()));
    };
    ws.on('message', onMessage);
    ws.send(JSON.stringify(payload));
    setTimeout(() => reject(new Error('ws response timeout')), 4000);
  });
}

async function openAuthedSocket() {
  const ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}/ws`);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const auth = await wsRequest(ws, { type: 'auth', token: WS_TOKEN });
  assert.equal(auth.success, true);
  return ws;
}

test('WS security - read_file with ../ traversal is blocked', async () => {
  const ws = await openAuthedSocket();
  const res = await wsRequest(ws, {
    type: 'read_file',
    filepath: '../../../etc/passwd',
    nonce: randomUUID(),
    ts: Date.now()
  });
  assert.ok(res.error, 'must return an error');
  assert.ok(res.error.toLowerCase().includes('access denied') || res.error.toLowerCase().includes('path escapes'), 'error must mention access denied');
  ws.close();
});

test('WS security - write_file with sibling-prefix path is blocked', async () => {
  const ws = await openAuthedSocket();
  // Attempt to write to a sibling directory of WORKSPACE_ROOT
  const siblingPath = WORKSPACE_ROOT + '-evil/injected.txt';
  const res = await wsRequest(ws, {
    type: 'write_file',
    filepath: siblingPath,
    content: 'pwned',
    nonce: randomUUID(),
    ts: Date.now()
  });
  assert.ok(res.error, 'sibling-prefix write must return an error');
  ws.close();
});

test('WS security - delete_file with absolute escape is blocked', async () => {
  const ws = await openAuthedSocket();
  const res = await wsRequest(ws, {
    type: 'delete_file',
    filepath: '/tmp/important-file',
    nonce: randomUUID(),
    ts: Date.now()
  });
  assert.ok(res.error, 'absolute escape delete must return an error');
  ws.close();
});

test('WS security - rename_file with traversal in new_filepath is blocked', async () => {
  const ws = await openAuthedSocket();
  const res = await wsRequest(ws, {
    type: 'rename_file',
    filepath: 'app.js',
    new_filepath: '../evil.js',
    nonce: randomUUID(),
    ts: Date.now()
  });
  assert.ok(res.error, 'traversal in new_filepath must return an error');
  ws.close();
});

test('WS security - test_mcp_connection with invalid connector_id is rejected', async () => {
  const ws = await openAuthedSocket();
  const res = await wsRequest(ws, {
    type: 'test_mcp_connection',
    connector_id: '../server',
    primary: 'token',
    nonce: randomUUID(),
    ts: Date.now()
  });
  assert.equal(res.success, false, 'invalid connector_id must return success:false');
  ws.close();
});

test('WS security - test_mcp_connection for non-existent connector returns success:false', async () => {
  const ws = await openAuthedSocket();
  const res = await wsRequest(ws, {
    type: 'test_mcp_connection',
    connector_id: 'nonexistent_connector_abc',
    primary: 'token',
    nonce: randomUUID(),
    ts: Date.now()
  });
  assert.equal(res.success, false, 'missing connector must return success:false, not a fake success');
  assert.ok(res.error, 'must include an error message explaining the connector is missing');
  ws.close();
});

// ── Static serving security ──────────────────────────────────────────────────
test('HTTP - server.js is not served statically', async () => {
  const res = await fetch(`http://127.0.0.1:${WS_PORT}/server.js`);
  assert.notEqual(res.status, 200, 'server.js must not be served (expected 403 or 404, got ' + res.status + ')');
});

test('HTTP - termux_agent.py is not served statically', async () => {
  const res = await fetch(`http://127.0.0.1:${WS_PORT}/termux_agent.py`);
  assert.notEqual(res.status, 200, 'termux_agent.py must not be served');
});

test('HTTP - security/ directory is not served statically', async () => {
  const res = await fetch(`http://127.0.0.1:${WS_PORT}/security/audit.log`);
  assert.notEqual(res.status, 200, 'security/audit.log must not be served');
});

test('HTTP - index.html is served (required UI asset)', async () => {
  const res = await fetch(`http://127.0.0.1:${WS_PORT}/index.html`);
  assert.equal(res.status, 200, 'index.html must be served');
});

test('HTTP - app.js is served (required UI asset)', async () => {
  const res = await fetch(`http://127.0.0.1:${WS_PORT}/app.js`);
  assert.equal(res.status, 200, 'app.js must be served');
});

test('HTTP - style.css is served (required UI asset)', async () => {
  const res = await fetch(`http://127.0.0.1:${WS_PORT}/style.css`);
  assert.equal(res.status, 200, 'style.css must be served');
});
