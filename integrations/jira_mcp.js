/**
 * @file jira_mcp.js
 * @description Jira Software Cloud issue tracking integration.
 */

'use strict';

class JiraMCPConnector {
  constructor(config = {}) {
    this.name = 'jira_mcp';
    this.host = config.host || '';
    this.email = config.email || '';
    this.token = config.token || '';
  }

  async testConnection() {
    if (!this.host || !this.email || !this.token) {
      return { success: false, message: 'Jira authentication credentials incomplete.' };
    }
    try {
      const basicAuth = Buffer.from(`${this.email}:${this.token}`).toString('base64');
      const response = await fetch(`https://${this.host}/rest/api/3/myself`, {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const user = await response.json();
        return { success: true, message: `Connected to Jira. Session user: ${user.displayName}` };
      }
      return { success: false, message: `Jira authentication rejected: HTTP ${response.status}` };
    } catch (e) {
      return { success: false, message: `Jira connection failed: ${e.message}` };
    }
  }
}

module.exports = JiraMCPConnector;
