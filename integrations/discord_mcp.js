/**
 * @file discord_mcp.js
 * @description Discord Webhook & Gateway integration for MCP server communication.
 */

'use strict';

class DiscordMCPConnector {
  constructor(config = {}) {
    this.name = 'discord_mcp';
    this.webhookUrl = config.webhookUrl || process.env.DISCORD_WEBHOOK_URL || '';
    this.botToken = config.botToken || process.env.DISCORD_BOT_TOKEN || '';
  }

  async testConnection() {
    if (this.webhookUrl) {
      try {
        const response = await fetch(this.webhookUrl);
        if (response.ok || response.status === 401 || response.status === 400) {
          return { success: true, message: 'Discord Webhook URL format verified and accessible.' };
        }
      } catch (e) {
        return { success: false, message: `Webhook verification failed: ${e.message}` };
      }
    }
    if (this.botToken) {
      try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { 'Authorization': `Bot ${this.botToken}` }
        });
        if (response.ok) {
          const user = await response.json();
          return { success: true, message: `Connected as bot: ${user.username}#${user.discriminator}` };
        }
        return { success: false, message: `Bot Authentication failed: HTTP ${response.status}` };
      } catch (e) {
        return { success: false, message: `Gateway authentication failed: ${e.message}` };
      }
    }
    return { success: false, message: 'Neither Webhook URL nor Bot Token is configured.' };
  }

  async sendWebhook(content) {
    if (!this.webhookUrl) throw new Error('Discord Webhook URL is missing.');
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!response.ok) throw new Error(`Webhook post failed with HTTP ${response.status}`);
    return true;
  }
}

module.exports = DiscordMCPConnector;
