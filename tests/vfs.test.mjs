import test from 'node:test';
import assert from 'node:assert/strict';

// Mock IndexedDB / LocalStorage Engine
class LocalStorageMock {
  constructor() { this.store = {}; }
  clear() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
}

global.localStorage = new LocalStorageMock();

// VFS Implementation Module Mock
const VFS_DEFAULT = {
  'index.html': { content: '<h1>Agent Show</h1>' },
  'app.js': { content: 'console.log("init");' }
};

function getVFS() {
  try {
    const data = global.localStorage.getItem('agent_show_vfs');
    return data ? JSON.parse(data) : VFS_DEFAULT;
  } catch (e) {
    return VFS_DEFAULT;
  }
}

function saveVFSFile(filename, content) {
  const vfs = getVFS();
  vfs[filename] = { content, updatedAt: Date.now() };
  global.localStorage.setItem('agent_show_vfs', JSON.stringify(vfs));
  return vfs;
}

test('VFS Suite - Default Fallback on Empty Storage', () => {
  global.localStorage.clear();
  const vfs = getVFS();
  assert.equal(vfs['index.html'].content, '<h1>Agent Show</h1>');
});

test('VFS Suite - File Persistence and Write Latency', () => {
  const start = performance.now();
  saveVFSFile('style.css', 'body { background: #000; }');
  const duration = performance.now() - start;

  const updatedVFS = getVFS();
  assert.equal(updatedVFS['style.css'].content, 'body { background: #000; }');
  assert.ok(duration < 100, `Write latency must be under 100ms (took ${duration.toFixed(2)}ms)`);
});

test('VFS Suite - Safe Recovery on Corrupted VFS JSON', () => {
  global.localStorage.setItem('agent_show_vfs', 'INVALID_JSON_CORRUPTED');
  const vfs = getVFS();
  assert.equal(vfs['index.html'].content, '<h1>Agent Show</h1>');
});
