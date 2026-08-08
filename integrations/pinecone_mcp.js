/**
 * Pinecone MCP Integration — fully wired
 * Operations: listIndexes, describeIndex, upsertVectors, queryVectors,
 *             deleteVectors, fetchVectors
 */
export class PineconeMCP {
  constructor() {
    this._apiKey = null;
    this._environment = null;
    this._connected = false;
    this._controllerUrl = 'https://api.pinecone.io';

    this.operations = {
      listIndexes: (p) => this._listIndexes(p),
      describeIndex: (p) => this._describeIndex(p),
      upsertVectors: (p) => this._upsertVectors(p),
      queryVectors: (p) => this._queryVectors(p),
      deleteVectors: (p) => this._deleteVectors(p),
      fetchVectors: (p) => this._fetchVectors(p),
    };
  }

  async connect(config = {}) {
    const key = config.apiKey || process.env.PINECONE_API_KEY;
    if (!key) throw new Error('Pinecone: apiKey required (config.apiKey or PINECONE_API_KEY env var)');
    this._apiKey = key;
    await this._controllerFetch('/indexes', 'GET');
    this._connected = true;
    return { connected: true };
  }

  async disconnect() { this._apiKey = null; this._connected = false; }
  isConnected() { return this._connected; }

  async _listIndexes() {
    return this._controllerFetch('/indexes', 'GET');
  }

  async _describeIndex({ index_name }) {
    if (!index_name) throw new Error('Pinecone describeIndex: index_name required');
    return this._controllerFetch(`/indexes/${index_name}`, 'GET');
  }

  async _upsertVectors({ index_host, vectors, namespace = '' }) {
    if (!index_host || !vectors?.length) throw new Error('Pinecone upsertVectors: index_host and vectors required');
    return this._dataFetch(index_host, '/vectors/upsert', 'POST', { vectors, namespace });
  }

  async _queryVectors({ index_host, vector, topK = 10, namespace = '', includeMetadata = true, filter }) {
    if (!index_host || !vector) throw new Error('Pinecone queryVectors: index_host and vector required');
    return this._dataFetch(index_host, '/query', 'POST', {
      vector, topK, namespace, includeMetadata,
      ...(filter && { filter }),
    });
  }

  async _deleteVectors({ index_host, ids, namespace = '', deleteAll = false }) {
    if (!index_host) throw new Error('Pinecone deleteVectors: index_host required');
    return this._dataFetch(index_host, '/vectors/delete', 'POST', {
      ...(ids?.length && { ids }),
      namespace,
      deleteAll,
    });
  }

  async _fetchVectors({ index_host, ids, namespace = '' }) {
    if (!index_host || !ids?.length) throw new Error('Pinecone fetchVectors: index_host and ids required');
    const params = new URLSearchParams({ namespace });
    ids.forEach(id => params.append('ids', id));
    return this._dataFetch(index_host, `/vectors/fetch?${params}`, 'GET');
  }

  async _controllerFetch(path, method, body) {
    return this._rawFetch(`${this._controllerUrl}${path}`, method, body);
  }

  async _dataFetch(host, path, method, body) {
    const url = host.startsWith('http') ? `${host}${path}` : `https://${host}${path}`;
    return this._rawFetch(url, method, body);
  }

  async _rawFetch(url, method, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        method, signal: controller.signal,
        headers: { 'Api-Key': this._apiKey, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(`Pinecone API ${method} ${url} => ${res.status}: ${JSON.stringify(json)}`);
      return json;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default PineconeMCP;
