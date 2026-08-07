// Integration test: boots the real server.js with ADMIN_TOKEN set and
// exercises the live WebSocket path — auth, nonce enforcement, replay
// rejection, and capability-gated actions. No mocks of the security layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3891;
const TOKEN = 'test-only-token-' + randomUUID();

let server;

function wsRequest(ws, payload) {
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

test.before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), ADMIN_TOKEN: TOKEN },
    stdio: 'ignore',
  });
  // wait for the port to accept connections
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('server did not start');
});

test.after(() => { if (server) server.kill(); });

async function openAuthedSocket() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const auth = await wsRequest(ws, { type: 'auth', token: TOKEN });
  assert.equal(auth.success, true);
  assert.ok(auth.session_id, 'auth_response must include session_id');
  return ws;
}

test('Substrate WS - wrong token is rejected', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const auth = await wsRequest(ws, { type: 'auth', token: 'wrong' });
  assert.equal(auth.success, false);
  ws.close();
});

test('Substrate WS - action without nonce is rejected', async () => {
  const ws = await openAuthedSocket();
  const res = await wsRequest(ws, { type: 'list_files' });
  assert.equal(res.code, 'NONCE_REJECTED');
  ws.close();
});

test('Substrate WS - action with fresh nonce succeeds, replay is rejected', async () => {
  const ws = await openAuthedSocket();
  const nonce = randomUUID();
  const ts = Date.now();
  const ok = await wsRequest(ws, { type: 'list_files', nonce, ts });
  assert.equal(ok.type, 'list_files_response');
  assert.ok(Array.isArray(ok.files));
  const replay = await wsRequest(ws, { type: 'list_files', nonce, ts });
  assert.equal(replay.code, 'NONCE_REJECTED', 'same nonce must not be accepted twice');
  ws.close();
});

test('Substrate WS - stale timestamp is rejected', async () => {
  const ws = await openAuthedSocket();
  const res = await wsRequest(ws, { type: 'list_files', nonce: randomUUID(), ts: Date.now() - 60000 });
  assert.equal(res.code, 'NONCE_REJECTED');
  ws.close();
});

test('Substrate WS - exec is capability-denied when ENABLE_EXEC is unset', async () => {
  const ws = await openAuthedSocket();
  const res = await wsRequest(ws, { type: 'exec', command: 'echo hi', nonce: randomUUID(), ts: Date.now() });
  assert.equal(res.code, 'CAPABILITY_DENIED', 'exec_privileged must not be granted without ENABLE_EXEC=1');
  ws.close();
});

test('Substrate WS - read/write file round-trip under capability grant', async () => {
  const ws = await openAuthedSocket();
  const filepath = `tmp-test-${randomUUID()}.txt`;
  const w = await wsRequest(ws, { type: 'write_file', filepath, content: 'hello-caps', nonce: randomUUID(), ts: Date.now() });
  assert.equal(w.success, true);
  const r = await wsRequest(ws, { type: 'read_file', filepath, nonce: randomUUID(), ts: Date.now() });
  assert.equal(r.content, 'hello-caps');
  const d = await wsRequest(ws, { type: 'delete_file', filepath, nonce: randomUUID(), ts: Date.now() });
  assert.equal(d.success, true);
  ws.close();
});
