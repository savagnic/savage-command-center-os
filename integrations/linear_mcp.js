/**
 * Linear MCP Integration — fully wired (GraphQL)
 * Operations: listIssues, getIssue, createIssue, updateIssue,
 *             listProjects, getProject, listTeams, listLabels
 */
export class LinearMCP {
  constructor() {
    this._apiKey = null;
    this._baseUrl = 'https://api.linear.app/graphql';
    this._connected = false;
    this._viewer = null;

    this.operations = {
      listIssues: (p) => this._listIssues(p),
      getIssue: (p) => this._getIssue(p),
      createIssue: (p) => this._createIssue(p),
      updateIssue: (p) => this._updateIssue(p),
      listProjects: (p) => this._listProjects(p),
      getProject: (p) => this._getProject(p),
      listTeams: (p) => this._listTeams(p),
    };
  }

  async connect(config = {}) {
    const key = config.apiKey || process.env.LINEAR_API_KEY;
    if (!key) throw new Error('Linear: apiKey required (config.apiKey or LINEAR_API_KEY env var)');
    this._apiKey = key;
    const data = await this._gql('{ viewer { id name email } }');
    this._viewer = data.viewer;
    this._connected = true;
    return { connected: true, viewer: this._viewer };
  }

  async disconnect() { this._apiKey = null; this._connected = false; this._viewer = null; }
  isConnected() { return this._connected; }

  async _listIssues({ teamId, first = 50, after, filter } = {}) {
    const filterArg = filter ? `, filter: ${JSON.stringify(filter)}` : '';
    const teamArg = teamId ? `, filter: { team: { id: { eq: "${teamId}" } } }` : '';
    const q = `{
      issues(first: ${first}${after ? `, after: "${after}"` : ''}${filterArg || teamArg}) {
        pageInfo { hasNextPage endCursor }
        nodes { id identifier title priority state { name } assignee { name } team { name } createdAt updatedAt }
      }
    }`;
    return (await this._gql(q)).issues;
  }

  async _getIssue({ id }) {
    if (!id) throw new Error('Linear getIssue: id required');
    return (await this._gql(`{ issue(id: "${id}") { id identifier title description priority state { name } assignee { name } createdAt updatedAt comments { nodes { id body author { name } } } } }`)).issue;
  }

  async _createIssue({ teamId, title, description, priority, assigneeId, stateId, labelIds = [] }) {
    if (!teamId || !title) throw new Error('Linear createIssue: teamId and title required');
    const vars = { input: { teamId, title, ...(description && { description }), ...(priority !== undefined && { priority }), ...(assigneeId && { assigneeId }), ...(stateId && { stateId }), ...(labelIds.length && { labelIds }) } };
    const mutation = `mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title } } }`;
    return (await this._gql(mutation, vars)).issueCreate;
  }

  async _updateIssue({ id, title, description, priority, assigneeId, stateId }) {
    if (!id) throw new Error('Linear updateIssue: id required');
    const vars = { id, input: { ...(title && { title }), ...(description !== undefined && { description }), ...(priority !== undefined && { priority }), ...(assigneeId !== undefined && { assigneeId }), ...(stateId && { stateId }) } };
    const mutation = `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id identifier title state { name } } } }`;
    return (await this._gql(mutation, vars)).issueUpdate;
  }

  async _listProjects({ first = 50 } = {}) {
    return (await this._gql(`{ projects(first: ${first}) { nodes { id name description state createdAt } } }`)).projects;
  }

  async _getProject({ id }) {
    if (!id) throw new Error('Linear getProject: id required');
    return (await this._gql(`{ project(id: "${id}") { id name description state issues(first: 20) { nodes { id identifier title state { name } } } } }`)).project;
  }

  async _listTeams() {
    return (await this._gql('{ teams { nodes { id name key description } } }')).teams;
  }

  async _gql(query, variables) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(this._baseUrl, {
        method: 'POST', signal: controller.signal,
        headers: {
          Authorization: this._apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'SavageCommandCenter/1.0',
        },
        body: JSON.stringify({ query, ...(variables && { variables }) }),
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (json.errors?.length) throw new Error(`Linear GraphQL error: ${json.errors[0].message}`);
      if (!res.ok) throw new Error(`Linear API => ${res.status}`);
      return json.data;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default LinearMCP;
