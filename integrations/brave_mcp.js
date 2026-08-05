/**
 * @file brave_mcp.js
 * @description Brave Search API connector.
 * Provides web-search capabilities to sovereign agent routines.
 */

'use strict';

class BraveMCPConnector {
  constructor(config = {}) {
    this.name = 'brave_mcp';
    this.apiKey = config.apiKey || process.env.BRAVE_API_KEY || '';
    this.baseUrl = 'https://api.search.brave.com/res/v1/web/search';
  }

  async testConnection() {
    if (!this.apiKey) {
      return { success: false, message: 'Brave Search API Key is missing.' };
    }
    try {
      const response = await fetch(`${this.baseUrl}?q=ping`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey
        }
      });
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Brave Search API Key rejected.' };
      }
      return { success: true, message: `Brave Search endpoint reachable (HTTP ${response.status})` };
    } catch (e) {
      return { success: false, message: `Brave Search endpoint unreachable: ${e.message}` };
    }
  }

  async search(query) {
    if (!this.apiKey) throw new Error('Brave Search API Key not configured.');
    const response = await fetch(`${this.baseUrl}?q=${encodeURIComponent(query)}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': this.apiKey
      }
    });
    return await response.json();
  }
}

module.exports = BraveMCPConnector;
