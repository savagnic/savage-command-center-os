import test from 'node:test';
import assert from 'node:assert/strict';

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    setTimeout(() => {
      if (url.includes('127.0.0.1')) {
        this.readyState = 1; // OPEN
        if (this.onopen) this.onopen();
      } else {
        this.readyState = 3; // CLOSED
        if (this.onerror) this.onerror(new Error('Connection Failed'));
      }
    }, 10);
  }
  send(data) { this.lastSent = data; }
  close() { this.readyState = 3; }
}

test('Terminal Suite - Primary WebSocket Connection Success', async () => {
  const socket = new MockWebSocket('ws://127.0.0.1:8080');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(socket.readyState, 1);
});

// NOTE: WebAssembly failover does not exist in this codebase.
// This test validates only that the mock socket reaches CLOSED state
// on connection failure — it does NOT test any real WebAssembly path.
test('Terminal Suite - Mock socket reaches CLOSED state on connection failure [NO REAL WASM]', async () => {
  const socket = new MockWebSocket('ws://invalid-host:9999');
  await new Promise(resolve => setTimeout(resolve, 25));
  // The mock closes (readyState 3) on error — no WebAssembly is involved
  assert.equal(socket.readyState, 3, 'socket should be in CLOSED state after failed connection');
});
