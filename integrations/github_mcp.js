/**
 * GitHub MCP Integration — fully wired
 * Operations: listRepos, getRepo, createIssue, listIssues, getIssue, 
 *             updateIssue, listPullRequests, getPullRequest, searchCode,
 *             pushFile, getFileContents, listBranches, createBranch
 */
export class GitHubMCP {
  constructor() {
    this._token = null;
    this._baseUrl = 'https://api.github.com';
    this._connected = false;

    this.operations = {
      listRepos: (params) => this._listRepos(params),
      getRepo: (params) => this._getRepo(params),
      createIssue: (params) => this._createIssue(params),
      listIssues: (params) => this._listIssues(params),
      getIssue: (params) => this._getIssue(params),
      updateIssue: (params) => this._updateIssue(params),
      listPullRequests: (params) => this._listPullRequests(params),
      getPullRequest: (params) => this._getPullRequest(params),
      searchCode: (params) => this._searchCode(params),
      pushFile: (params) => this._pushFile(params),
      getFileContents: (params) => this._getFileContents(params),
      listBranches: (params) => this._listBranches(params),
      createBranch: (params) => this._createBranch(params),
    };
  }

  async connect(config = {}) {
    const token = config.token || process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GitHub: token required (config.token or GITHUB_TOKEN env var)');
    this._token = token;
    // Validate token with a lightweight API call
    const res = await this._fetch('/user', 'GET');
    this._user = res.login;
    this._connected = true;
    return { connected: true, user: this._user };
  }

  async disconnect() {
    this._token = null;
    this._connected = false;
    this._user = null;
  }

  isConnected() { return this._connected; }

  async _listRepos({ owner, type = 'owner', per_page = 30, page = 1 } = {}) {
    const path = owner
      ? `/users/${owner}/repos?type=${type}&per_page=${per_page}&page=${page}`
      : `/user/repos?type=${type}&per_page=${per_page}&page=${page}`;
    return this._fetch(path, 'GET');
  }

  async _getRepo({ owner, repo }) {
    this._require({ owner, repo });
    return this._fetch(`/repos/${owner}/${repo}`, 'GET');
  }

  async _createIssue({ owner, repo, title, body, labels = [], assignees = [] }) {
    this._require({ owner, repo, title });
    return this._fetch(`/repos/${owner}/${repo}/issues`, 'POST', { title, body, labels, assignees });
  }

  async _listIssues({ owner, repo, state = 'open', per_page = 30, page = 1 } = {}) {
    this._require({ owner, repo });
    return this._fetch(`/repos/${owner}/${repo}/issues?state=${state}&per_page=${per_page}&page=${page}`, 'GET');
  }

  async _getIssue({ owner, repo, issue_number }) {
    this._require({ owner, repo, issue_number });
    return this._fetch(`/repos/${owner}/${repo}/issues/${issue_number}`, 'GET');
  }

  async _updateIssue({ owner, repo, issue_number, title, body, state, labels, assignees }) {
    this._require({ owner, repo, issue_number });
    return this._fetch(`/repos/${owner}/${repo}/issues/${issue_number}`, 'PATCH',
      { ...(title && { title }), ...(body !== undefined && { body }), ...(state && { state }), ...(labels && { labels }), ...(assignees && { assignees }) }
    );
  }

  async _listPullRequests({ owner, repo, state = 'open', per_page = 30, page = 1 } = {}) {
    this._require({ owner, repo });
    return this._fetch(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=${per_page}&page=${page}`, 'GET');
  }

  async _getPullRequest({ owner, repo, pull_number }) {
    this._require({ owner, repo, pull_number });
    return this._fetch(`/repos/${owner}/${repo}/pulls/${pull_number}`, 'GET');
  }

  async _searchCode({ query, per_page = 30, page = 1 }) {
    this._require({ query });
    const q = encodeURIComponent(query);
    return this._fetch(`/search/code?q=${q}&per_page=${per_page}&page=${page}`, 'GET');
  }

  async _getFileContents({ owner, repo, path, ref }) {
    this._require({ owner, repo, path });
    const refParam = ref ? `?ref=${ref}` : '';
    return this._fetch(`/repos/${owner}/${repo}/contents/${path}${refParam}`, 'GET');
  }

  async _pushFile({ owner, repo, path, content, message, branch = 'main', sha }) {
    this._require({ owner, repo, path, content, message });
    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      ...(sha && { sha }),
    };
    return this._fetch(`/repos/${owner}/${repo}/contents/${path}`, 'PUT', body);
  }

  async _listBranches({ owner, repo, per_page = 30 } = {}) {
    this._require({ owner, repo });
    return this._fetch(`/repos/${owner}/${repo}/branches?per_page=${per_page}`, 'GET');
  }

  async _createBranch({ owner, repo, branch, from_branch = 'main' }) {
    this._require({ owner, repo, branch });
    // Get SHA of the base branch
    const base = await this._fetch(`/repos/${owner}/${repo}/git/ref/heads/${from_branch}`, 'GET');
    return this._fetch(`/repos/${owner}/${repo}/git/refs`, 'POST', {
      ref: `refs/heads/${branch}`,
      sha: base.object.sha,
    });
  }

  _require(params) {
    for (const [key, val] of Object.entries(params)) {
      if (val === undefined || val === null) throw new Error(`GitHub: missing required parameter '${key}'`);
    }
  }

  async _fetch(path, method, body) {
    const url = `${this._baseUrl}${path}`;
    const headers = {
      Authorization: `Bearer ${this._token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'SavageCommandCenter/1.0',
    };
    const init = { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`GitHub API ${method} ${path} => ${res.status}: ${errText}`);
      }
      return res.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default GitHubMCP;
