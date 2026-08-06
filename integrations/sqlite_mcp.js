/**
 * @file sqlite_mcp.js
 * @description SQLite local file DB interface and schema analyzer tool.
 */

'use strict';

const fs = require('fs');
const path = require('path');

class SQLiteMCPConnector {
  constructor(config = {}) {
    this.name = 'sqlite_mcp';
    this.filepath = config.filepath || 'agent_store.db';
  }

  async testConnection() {
    try {
      const fullPath = path.resolve(__dirname, '..', this.filepath);
      // Ensure the directory is inside workspace
      if (!fullPath.startsWith(path.resolve(__dirname, '..'))) {
        return { success: false, message: 'Directory out of bounds.' };
      }
      // Check write permissions in parent folder
      const dir = path.dirname(fullPath);
      fs.accessSync(dir, fs.constants.W_OK);
      return { success: true, message: `SQLite database file write access verified at: ${this.filepath}` };
    } catch (e) {
      return { success: false, message: `SQLite access error: ${e.message}` };
    }
  }
}

module.exports = SQLiteMCPConnector;
