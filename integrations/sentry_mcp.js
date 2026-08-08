/**
 * Sentry MCP Integration — fully wired
 * Operations: listProjects, listIssues, getIssue, listEvents, getEvent, resolveIssue
 */
export class SentryMCP {
  constructor() {
    this._token = null;
    this._org = null;
    this._baseUrl = 'https://sentry.io/api/0';
    this._connected = false;
    this.operations = {
      listProjects: (p) => this._listProjects(p),
      listIssues: (p) => this._listIssues(p),
      getIssue: (p) => this._getIssue(p),
      listEvents: (p) => this._listEvents(p),
      getEvent: (p) => this._getEvent(p),
      resolveIssue: (p) => this._resolveIssue(p),
    };
  }
  async connect(config = {}) {
    const token = config.authToken || process.env.SENTRY_AUTH_TOKEN;
    const org = config.org || process.env.SENTRY_ORG;
    if (!token) throw new Error('Sentry: authToken required (config.authToken or SENTRY_AUTH_TOKEN env var)');
    if (!org) throw new Error('Sentry: org slug required (config.org or SENTRY_ORG env var)');
    this._token = token;
    this._org = org;
    await this._fetch(`/organizations/${org}/`);
    this._connected = true;
    return { connected: true, org };
  }
  async disconnect() { this._token = null; this._org = null; this._connected = false; }
  isConnected() { return this._connected; }
  async _listProjects() {
    return this._fetch(`/organizations/${this._org}/projects/`);
  }
  async _listIssues({ project, query = 'is:unresolved', limit = 25, cursor } = {}) {
    if (!project) throw new Error('Sentry listIssues: project slug required');
    const p = new URLSearchParams({ query, limit: String(limit) });
    if (cursor) p.set('cursor', cursor);
    return this._fetch(`/projects/${this._org}/${project}/issues/?${p}`);
  }
  async _getIssue({ issue_id }) {
    if (!issue_id) throw new Error('Sentry getIssue: issue_id required');
    return this._fetch(`/issues/${issue_id}/`);
  }
  async _listEvents({ issue_id, limit = 10 } = {}) {
    if (!issue_id) throw new Error('Sentry listEvents: issue_id required');
    return this._fetch(`/issues/${issue_id}/events/?limit=${limit}`);
  }
  async _getEvent({ event_id, project }) {
    if (!event_id || !project) throw new Error('Sentry getEvent: event_id and project required');
    return this._fetch(`/projects/${this._org}/${project}/events/${event_id}/`);
  }
  async _resolveIssue({ issue_id }) {
    if (!issue_id) throw new Error('Sentry resolveIssue: issue_id required');
    return this._fetch(`/issues/${issue_id}/`, 'PUT', { status: 'resolved' });
  }
  async _fetch(path, method = 'GET', body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${this._baseUrl}${path}`, {
        method, signal: controller.signal,
        headers: { Authorization: `Bearer ${this._token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(`Sentry API ${method} ${path} => ${res.status}: ${JSON.stringify(json)}`);
      return json;
    } catch (err) { clearTimeout(timeout); throw err; }
  }
}
export default SentryMCP;
