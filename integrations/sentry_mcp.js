/**
 * @file sentry_mcp.js
 * @description Sentry error reporting & alert retrieval integration.
 */

'use strict';

class SentryMCPConnector {
  constructor(config = {}) {
    this.name = 'sentry_mcp';
    this.token = config.token || process.env.SENTRY_AUTH_TOKEN || '';
    this.org = config.org || '';
  }

  async testConnection() {
    if (!this.token) {
      return { success: false, message: 'Sentry Auth Token is missing.' };
    }
    try {
      const response = await fetch('https://sentry.io/api/0/projects/', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (response.ok) {
        return { success: true, message: 'Sentry connection verified successfully.' };
      }
      return { success: false, message: `Sentry auth error: HTTP ${response.status}` };
    } catch (e) {
      return { success: false, message: `Sentry connection failed: ${e.message}` };
    }
  }
}

module.exports = SentryMCPConnector;
