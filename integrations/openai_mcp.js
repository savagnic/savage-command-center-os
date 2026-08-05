/**
 * @file openai_mcp.js
 * @description OpenAI connection utility for dynamic GPT inference capabilities.
 */

'use strict';

class OpenAIMCPConnector {
  constructor(config = {}) {
    this.name = 'openai_mcp';
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = config.model || 'gpt-4o-mini';
  }

  async testConnection() {
    if (!this.apiKey) {
      return { success: false, message: 'OpenAI API Key is missing.' };
    }
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      if (response.ok) {
        return { success: true, message: 'OpenAI API credentials authenticated. Models loaded.' };
      }
      return { success: false, message: `OpenAI API returned status HTTP ${response.status}` };
    } catch (e) {
      return { success: false, message: `OpenAI connection failed: ${e.message}` };
    }
  }
}

module.exports = OpenAIMCPConnector;
