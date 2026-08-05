/**
 * @file notion_mcp.js
 * @description Notion Workspace and Database integration wrapper.
 */

'use strict';

class NotionMCPConnector {
  constructor(config = {}) {
    this.name = 'notion_mcp';
    this.token = config.token || process.env.NOTION_INTEGRATION_TOKEN || '';
    this.baseUrl = 'https://api.notion.com/v1';
  }

  async testConnection() {
    if (!this.token) {
      return { success: false, message: 'Notion Integration Token is missing.' };
    }
    try {
      const response = await fetch(`${this.baseUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Notion-Version': '2022-06-28'
        }
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, message: `Notion integrated with workspace owner: ${data.name || 'Sovereign Agent'}` };
      }
      return { success: false, message: `Notion error: ${data.message || 'Unknown'}` };
    } catch (e) {
      return { success: false, message: `Notion connection failed: ${e.message}` };
    }
  }
}

module.exports = NotionMCPConnector;
