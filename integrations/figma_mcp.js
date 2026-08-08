/**
 * Figma MCP Integration — fully wired
 * Operations: getFile, getNode, getComponents, getStyles,
 *             exportAssets, getComments, listProjects
 */
export class FigmaMCP {
  constructor() {
    this._token = null;
    this._baseUrl = 'https://api.figma.com/v1';
    this._connected = false;
    this.operations = {
      getFile: (p) => this._getFile(p),
      getNode: (p) => this._getNode(p),
      getComponents: (p) => this._getComponents(p),
      getStyles: (p) => this._getStyles(p),
      exportAssets: (p) => this._exportAssets(p),
      getComments: (p) => this._getComments(p),
      listProjects: (p) => this._listProjects(p),
    };
  }
  async connect(config = {}) {
    const token = config.token || process.env.FIGMA_ACCESS_TOKEN;
    if (!token) throw new Error('Figma: token required (config.token or FIGMA_ACCESS_TOKEN env var)');
    this._token = token;
    await this._fetch('/me');
    this._connected = true;
    return { connected: true };
  }
  async disconnect() { this._token = null; this._connected = false; }
  isConnected() { return this._connected; }
  async _getFile({ file_key, depth, node_id }) {
    if (!file_key) throw new Error('Figma getFile: file_key required');
    const p = new URLSearchParams();
    if (depth) p.set('depth', String(depth));
    if (node_id) p.set('ids', node_id);
    return this._fetch(`/files/${file_key}${p.toString() ? '?' + p : ''}`);
  }
  async _getNode({ file_key, node_id }) {
    if (!file_key || !node_id) throw new Error('Figma getNode: file_key and node_id required');
    return this._fetch(`/files/${file_key}/nodes?ids=${encodeURIComponent(node_id)}`);
  }
  async _getComponents({ file_key }) {
    if (!file_key) throw new Error('Figma getComponents: file_key required');
    return this._fetch(`/files/${file_key}/components`);
  }
  async _getStyles({ file_key }) {
    if (!file_key) throw new Error('Figma getStyles: file_key required');
    return this._fetch(`/files/${file_key}/styles`);
  }
  async _exportAssets({ file_key, ids, scale = 1, format = 'png' }) {
    if (!file_key || !ids?.length) throw new Error('Figma exportAssets: file_key and ids required');
    const p = new URLSearchParams({ ids: ids.join(','), scale: String(scale), format });
    return this._fetch(`/images/${file_key}?${p}`);
  }
  async _getComments({ file_key }) {
    if (!file_key) throw new Error('Figma getComments: file_key required');
    return this._fetch(`/files/${file_key}/comments`);
  }
  async _listProjects({ team_id }) {
    if (!team_id) throw new Error('Figma listProjects: team_id required');
    return this._fetch(`/teams/${team_id}/projects`);
  }
  async _fetch(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${this._baseUrl}${path}`, {
        signal: controller.signal,
        headers: { 'X-Figma-Token': this._token },
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(`Figma API ${path} => ${res.status}: ${json.err || JSON.stringify(json)}`);
      return json;
    } catch (err) { clearTimeout(timeout); throw err; }
  }
}
export default FigmaMCP;
