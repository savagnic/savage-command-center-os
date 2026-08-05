/**
 * @file slack_mcp.js
 * @description Slack direct connection & MCP capabilities.
 * Manages post messages, channel listings, and event subscriptions.
 */

'use strict';

class SlackMCPConnector {
  constructor(config = {}) {
    this.name = 'slack_mcp';
    this.token = config.token || process.env.SLACK_BOT_TOKEN || '';
    this.channel = config.channel || '';
    this.baseUrl = 'https://slack.com/api';
  }

  async testConnection() {
    if (!this.token) {
      return { success: false, message: 'Slack Bot Token is missing.' };
    }
    try {
      const response = await fetch(`${this.baseUrl}/auth.test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.ok) {
        return { success: true, message: `Connected to workspace: ${data.team} as user ${data.user}` };
      }
      return { success: false, message: `Slack API error: ${data.error}` };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }

  async postMessage(text) {
    if (!this.channel) throw new Error('Slack channel not configured.');
    const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ channel: this.channel, text })
    });
    return await response.json();
  }
}

module.exports = SlackMCPConnector;
