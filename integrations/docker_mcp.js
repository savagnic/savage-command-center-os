import { execSync } from 'child_process';

/**
 * Docker MCP Integration — fully wired (CLI-based, no Docker socket required)
 * Operations: listContainers, startContainer, stopContainer,
 *             getLogs, inspectContainer, listImages, removeContainer
 */
export class DockerMCP {
  constructor() {
    this._connected = false;
    this.operations = {
      listContainers: (p) => this._listContainers(p),
      startContainer: (p) => this._startContainer(p),
      stopContainer: (p) => this._stopContainer(p),
      getLogs: (p) => this._getLogs(p),
      inspectContainer: (p) => this._inspectContainer(p),
      listImages: (p) => this._listImages(p),
      removeContainer: (p) => this._removeContainer(p),
    };
  }
  async connect() {
    try {
      execSync('docker version --format json', { timeout: 5000 });
      this._connected = true;
      return { connected: true };
    } catch (err) {
      throw new Error(`Docker connect failed: ${err.message}. Is Docker running?`);
    }
  }
  async disconnect() { this._connected = false; }
  isConnected() { return this._connected; }
  async _listContainers({ all = false } = {}) {
    const output = execSync(`docker ps ${all ? '-a' : ''} --format json`, { timeout: 10000 }).toString();
    return output.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  }
  async _startContainer({ container_id }) {
    if (!container_id) throw new Error('Docker startContainer: container_id required');
    execSync(`docker start ${container_id}`, { timeout: 15000 });
    return { started: true, container_id };
  }
  async _stopContainer({ container_id, timeout_seconds = 10 }) {
    if (!container_id) throw new Error('Docker stopContainer: container_id required');
    execSync(`docker stop --time=${timeout_seconds} ${container_id}`, { timeout: 30000 });
    return { stopped: true, container_id };
  }
  async _getLogs({ container_id, tail = 100, timestamps = false }) {
    if (!container_id) throw new Error('Docker getLogs: container_id required');
    const flags = [`--tail=${tail}`, timestamps ? '--timestamps' : ''].filter(Boolean).join(' ');
    const output = execSync(`docker logs ${flags} ${container_id} 2>&1`, { timeout: 15000 }).toString();
    return { logs: output, container_id };
  }
  async _inspectContainer({ container_id }) {
    if (!container_id) throw new Error('Docker inspectContainer: container_id required');
    const output = execSync(`docker inspect ${container_id}`, { timeout: 10000 }).toString();
    return JSON.parse(output)[0];
  }
  async _listImages({ filter } = {}) {
    const f = filter ? `--filter=${filter}` : '';
    const output = execSync(`docker images ${f} --format json`, { timeout: 10000 }).toString();
    return output.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  }
  async _removeContainer({ container_id, force = false }) {
    if (!container_id) throw new Error('Docker removeContainer: container_id required');
    execSync(`docker rm ${force ? '-f' : ''} ${container_id}`, { timeout: 15000 });
    return { removed: true, container_id };
  }
}
export default DockerMCP;
