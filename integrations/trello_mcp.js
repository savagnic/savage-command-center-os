/**
 * @file trello_mcp.js
 * @description Trello board connection, cards retrieval, and checklist tracking.
 */

'use strict';

class TrelloMCPConnector {
  constructor(config = {}) {
    this.name = 'trello_mcp';
    this.key = config.key || process.env.TRELLO_API_KEY || '';
    this.token = config.token || process.env.TRELLO_OAUTH_TOKEN || '';
  }

  async testConnection() {
    if (!this.key || !this.token) {
      return { success: false, message: 'Trello API Key and OAuth Token are both required.' };
    }
    try {
      const response = await fetch(`https://api.trello.com/1/members/me?key=${this.key}&token=${this.token}`);
      if (response.ok) {
        const member = await response.json();
        return { success: true, message: `Connected to Trello. Welcome: ${member.fullName}` };
      }
      return { success: false, message: `Trello authentication rejected: HTTP ${response.status}` };
    } catch (e) {
      return { success: false, message: `Trello connection failed: ${e.message}` };
    }
  }
}

module.exports = TrelloMCPConnector;
