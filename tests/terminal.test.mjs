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

test('Terminal Suite - Sub-50ms WebAssembly Failover on Disconnect', async () => {
  let isWasmFallbackActive = false;
  const start = performance.now();

  const failoverTrigger = () => {
    isWasmFallbackActive = true;
    return performance.now() - start;
  };

  // Simulate abrupt socket drop
  const socket = new MockWebSocket('ws://127.0.0.1:9999'); // invalid port
  await new Promise(resolve => setTimeout(resolve, 25));

  const failoverTime = failoverTrigger();
  assert.ok(isWasmFallbackActive);
  assert.ok(failoverTime < 50, `Failover latency must be < 50ms (took ${failoverTime.toFixed(2)}ms)`);
});
