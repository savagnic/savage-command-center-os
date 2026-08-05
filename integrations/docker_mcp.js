/**
 * @file docker_mcp.js
 * @description Docker Daemon connector for container orchestration and status reporting.
 */

'use strict';

const { execSync } = require('child_process');

class DockerMCPConnector {
  constructor(config = {}) {
    this.name = 'docker_mcp';
    this.socketPath = config.socketPath || '/var/run/docker.sock';
  }

  async testConnection() {
    try {
      const output = execSync('docker --version', { encoding: 'utf8' });
      return { success: true, message: `Docker Engine reachable: ${output.trim()}` };
    } catch (e) {
      return { success: false, message: `Docker daemon unreachable/missing: ${e.message}` };
    }
  }
}

module.exports = DockerMCPConnector;
