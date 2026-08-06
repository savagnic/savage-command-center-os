/**
 * @file github_mcp.js
 * @description GitHub Connection & Build Configuration for Sovereign Agent Shell.
 * Integrates with GitHub API or acts as an MCP client/server to manage repositories, issues, and pulls.
 */

'use strict';

class GitHubMCPConnector {
  constructor(config = {}) {
    this.name = 'github_mcp';
    this.token = config.token || process.env.GITHUB_TOKEN || '';
    this.repo = config.repo || '';
    this.owner = config.owner || '';
    this.baseUrl = config.baseUrl || 'https://api.github.com';
  }

  /**
   * Validates the configuration and token validity.
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async testConnection() {
    if (!this.token) {
      return { success: false, message: 'GitHub Personal Access Token is missing.' };
    }
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Sovereign-Agent-Shell'
        }
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, message: `Connected successfully as ${data.login}` };
      }
      return { success: false, message: `GitHub API error: HTTP ${response.status}` };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }

  /**
   * Retrieves issues for the configured repository.
   */
  async listIssues() {
    if (!this.owner || !this.repo) {
      throw new Error('Owner and repository details are required.');
    }
    const response = await fetch(`${this.baseUrl}/repos/${this.owner}/${this.repo}/issues`, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Sovereign-Agent-Shell'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }
}

module.exports = GitHubMCPConnector;
