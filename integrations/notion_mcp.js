/**
 * Notion MCP Integration — fully wired
 * Operations: listPages, searchPages, getPage, createPage, updatePage,
 *             appendBlocks, getDatabase, queryDatabase, createDatabase
 */
export class NotionMCP {
  constructor() {
    this._token = null;
    this._baseUrl = 'https://api.notion.com/v1';
    this._notionVersion = '2022-06-28';
    this._connected = false;

    this.operations = {
      listPages: (p) => this._listPages(p),
      searchPages: (p) => this._searchPages(p),
      getPage: (p) => this._getPage(p),
      createPage: (p) => this._createPage(p),
      updatePage: (p) => this._updatePage(p),
      appendBlocks: (p) => this._appendBlocks(p),
      getDatabase: (p) => this._getDatabase(p),
      queryDatabase: (p) => this._queryDatabase(p),
    };
  }

  async connect(config = {}) {
    const token = config.token || process.env.NOTION_API_KEY;
    if (!token) throw new Error('Notion: token required (config.token or NOTION_API_KEY env var)');
    this._token = token;
    await this._fetch('/users/me', 'GET');
    this._connected = true;
    return { connected: true };
  }

  async disconnect() { this._token = null; this._connected = false; }
  isConnected() { return this._connected; }

  async _searchPages({ query = '', filter, sort, page_size = 20 } = {}) {
    return this._fetch('/search', 'POST', {
      query,
      ...(filter && { filter }),
      ...(sort && { sort }),
      page_size,
    });
  }

  async _listPages({ page_size = 20, start_cursor } = {}) {
    return this._fetch('/search', 'POST', {
      filter: { value: 'page', property: 'object' },
      page_size,
      ...(start_cursor && { start_cursor }),
    });
  }

  async _getPage({ page_id }) {
    if (!page_id) throw new Error('Notion getPage: page_id required');
    return this._fetch(`/pages/${page_id}`, 'GET');
  }

  async _createPage({ parent, properties, children = [], icon, cover }) {
    if (!parent) throw new Error('Notion createPage: parent required ({ page_id } or { database_id })');
    return this._fetch('/pages', 'POST', {
      parent, properties,
      ...(children.length && { children }),
      ...(icon && { icon }),
      ...(cover && { cover }),
    });
  }

  async _updatePage({ page_id, properties, archived }) {
    if (!page_id) throw new Error('Notion updatePage: page_id required');
    return this._fetch(`/pages/${page_id}`, 'PATCH', {
      ...(properties && { properties }),
      ...(archived !== undefined && { archived }),
    });
  }

  async _appendBlocks({ block_id, children }) {
    if (!block_id || !children?.length) throw new Error('Notion appendBlocks: block_id and children required');
    return this._fetch(`/blocks/${block_id}/children`, 'PATCH', { children });
  }

  async _getDatabase({ database_id }) {
    if (!database_id) throw new Error('Notion getDatabase: database_id required');
    return this._fetch(`/databases/${database_id}`, 'GET');
  }

  async _queryDatabase({ database_id, filter, sorts, page_size = 100, start_cursor } = {}) {
    if (!database_id) throw new Error('Notion queryDatabase: database_id required');
    return this._fetch(`/databases/${database_id}/query`, 'POST', {
      ...(filter && { filter }),
      ...(sorts && { sorts }),
      page_size,
      ...(start_cursor && { start_cursor }),
    });
  }

  async _fetch(path, method, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${this._baseUrl}${path}`, {
        method, signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this._token}`,
          'Notion-Version': this._notionVersion,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(`Notion API ${method} ${path} => ${res.status}: ${json.message || JSON.stringify(json)}`);
      return json;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default NotionMCP;
