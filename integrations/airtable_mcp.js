/**
 * @file airtable_mcp.js
 * @description Airtable base management, records retrieval, and editing.
 */

'use strict';

class AirtableMCPConnector {
  constructor(config = {}) {
    this.name = 'airtable_mcp';
    this.apiKey = config.apiKey || process.env.AIRTABLE_API_KEY || '';
    this.baseId = config.baseId || '';
  }

  async testConnection() {
    if (!this.apiKey) {
      return { success: false, message: 'Airtable API Personal Access Token is missing.' };
    }
    try {
      const url = this.baseId
        ? `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`
        : 'https://api.airtable.com/v0/meta/bases';

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      if (response.ok) {
        return { success: true, message: 'Airtable authentication and bases accessed successfully.' };
      }
      return { success: false, message: `Airtable API returned status HTTP ${response.status}` };
    } catch (e) {
      return { success: false, message: `Airtable connection failed: ${e.message}` };
    }
  }
}

module.exports = AirtableMCPConnector;
