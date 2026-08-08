/**
 * Jira MCP Integration — fully wired
 * Operations: listProjects, createIssue, getIssue, updateIssue,
 *             transitionIssue, addComment, searchIssues, listTransitions
 */
export class JiraMCP {
  constructor() {
    this._email = null;
    this._token = null;
    this._domain = null;
    this._baseUrl = null;
    this._connected = false;

    this.operations = {
      listProjects: (p) => this._listProjects(p),
      createIssue: (p) => this._createIssue(p),
      getIssue: (p) => this._getIssue(p),
      updateIssue: (p) => this._updateIssue(p),
      transitionIssue: (p) => this._transitionIssue(p),
      addComment: (p) => this._addComment(p),
      searchIssues: (p) => this._searchIssues(p),
      listTransitions: (p) => this._listTransitions(p),
    };
  }

  async connect(config = {}) {
    const email = config.email || process.env.JIRA_EMAIL;
    const token = config.token || process.env.JIRA_API_TOKEN;
    const domain = config.domain || process.env.JIRA_DOMAIN; // e.g. mycompany.atlassian.net
    if (!email || !token || !domain) throw new Error('Jira: email, token, and domain required');
    this._email = email;
    this._token = token;
    this._domain = domain;
    this._baseUrl = `https://${domain}/rest/api/3`;
    await this._fetch('/myself', 'GET');
    this._connected = true;
    return { connected: true, domain };
  }

  async disconnect() { this._email = this._token = this._domain = this._baseUrl = null; this._connected = false; }
  isConnected() { return this._connected; }

  async _listProjects({ maxResults = 50, startAt = 0 } = {}) {
    return this._fetch(`/project/search?maxResults=${maxResults}&startAt=${startAt}`, 'GET');
  }

  async _createIssue({ projectKey, summary, issueType = 'Task', description, priority, assigneeId, labels = [] }) {
    if (!projectKey || !summary) throw new Error('Jira createIssue: projectKey and summary required');
    const body = {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: issueType },
        ...(description && { description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] } }),
        ...(priority && { priority: { name: priority } }),
        ...(assigneeId && { assignee: { id: assigneeId } }),
        ...(labels.length && { labels }),
      },
    };
    return this._fetch('/issue', 'POST', body);
  }

  async _getIssue({ issueKey }) {
    if (!issueKey) throw new Error('Jira getIssue: issueKey required');
    return this._fetch(`/issue/${issueKey}`, 'GET');
  }

  async _updateIssue({ issueKey, fields }) {
    if (!issueKey || !fields) throw new Error('Jira updateIssue: issueKey and fields required');
    return this._fetch(`/issue/${issueKey}`, 'PUT', { fields });
  }

  async _transitionIssue({ issueKey, transitionId }) {
    if (!issueKey || !transitionId) throw new Error('Jira transitionIssue: issueKey and transitionId required');
    return this._fetch(`/issue/${issueKey}/transitions`, 'POST', { transition: { id: transitionId } });
  }

  async _addComment({ issueKey, body: commentBody }) {
    if (!issueKey || !commentBody) throw new Error('Jira addComment: issueKey and body required');
    const body = { body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: commentBody }] }] } };
    return this._fetch(`/issue/${issueKey}/comment`, 'POST', body);
  }

  async _searchIssues({ jql, maxResults = 50, startAt = 0, fields = ['summary', 'status', 'assignee', 'priority'] } = {}) {
    if (!jql) throw new Error('Jira searchIssues: jql required');
    return this._fetch('/search', 'POST', { jql, maxResults, startAt, fields });
  }

  async _listTransitions({ issueKey }) {
    if (!issueKey) throw new Error('Jira listTransitions: issueKey required');
    return this._fetch(`/issue/${issueKey}/transitions`, 'GET');
  }

  async _fetch(path, method, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const auth = Buffer.from(`${this._email}:${this._token}`).toString('base64');
    try {
      const res = await fetch(`${this._baseUrl}${path}`, {
        method, signal: controller.signal,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      clearTimeout(timeout);
      if (res.status === 204) return { success: true };
      const json = await res.json();
      if (!res.ok) throw new Error(`Jira API ${method} ${path} => ${res.status}: ${JSON.stringify(json)}`);
      return json;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default JiraMCP;
