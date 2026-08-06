/**
 * @file figma_mcp.js
 * @description Figma API integration to pull files, frames, and export design assets.
 */

'use strict';

class FigmaMCPConnector {
  constructor(config = {}) {
    this.name = 'figma_mcp';
    this.token = config.token || process.env.FIGMA_PERSONAL_ACCESS_TOKEN || '';
  }

  async testConnection() {
    if (!this.token) {
      return { success: false, message: 'Figma Personal Access Token is missing.' };
    }
    try {
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: { 'X-Figma-Token': this.token }
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, message: `Connected to Figma as: ${data.handle} (${data.email})` };
      }
      return { success: false, message: `Figma API rejected request: HTTP ${response.status}` };
    } catch (e) {
      return { success: false, message: `Figma connection failed: ${e.message}` };
    }
  }
}

module.exports = FigmaMCPConnector;
