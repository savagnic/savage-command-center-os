/**
 * @file linear_mcp.js
 * @description Linear project/issue workspace integration.
 */

'use strict';

class LinearMCPConnector {
  constructor(config = {}) {
    this.name = 'linear_mcp';
    this.apiKey = config.apiKey || process.env.LINEAR_API_KEY || '';
    this.baseUrl = 'https://api.linear.app/graphql';
  }

  async testConnection() {
    if (!this.apiKey) {
      return { success: false, message: 'Linear API Key is missing.' };
    }
    try {
      const query = { query: '{ viewer { id name email } }' };
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.apiKey
        },
        body: JSON.stringify(query)
      });
      const data = await response.json();
      if (data.errors) {
        return { success: false, message: `Linear GraphQL error: ${data.errors[0].message}` };
      }
      return { success: true, message: `Connected as: ${data.data.viewer.name} (${data.data.viewer.email})` };
    } catch (e) {
      return { success: false, message: `Linear connection failed: ${e.message}` };
    }
  }
}

module.exports = LinearMCPConnector;
