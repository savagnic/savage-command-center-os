/**
 * Airtable MCP Integration — fully wired
 * Operations: listBases, listTables, queryRecords, createRecord,
 *             updateRecord, deleteRecord, getRecord
 */
export class AirtableMCP {
  constructor() {
    this._token = null;
    this._baseUrl = 'https://api.airtable.com/v0';
    this._metaUrl = 'https://api.airtable.com/v0/meta';
    this._connected = false;

    this.operations = {
      listBases: (p) => this._listBases(p),
      listTables: (p) => this._listTables(p),
      queryRecords: (p) => this._queryRecords(p),
      createRecord: (p) => this._createRecord(p),
      updateRecord: (p) => this._updateRecord(p),
      deleteRecord: (p) => this._deleteRecord(p),
      getRecord: (p) => this._getRecord(p),
    };
  }

  async connect(config = {}) {
    const token = config.token || process.env.AIRTABLE_API_KEY;
    if (!token) throw new Error('Airtable: token required (config.token or AIRTABLE_API_KEY env var)');
    this._token = token;
    await this._fetch(`${this._metaUrl}/bases`, 'GET');
    this._connected = true;
    return { connected: true };
  }

  async disconnect() { this._token = null; this._connected = false; }
  isConnected() { return this._connected; }

  async _listBases() {
    return this._fetch(`${this._metaUrl}/bases`, 'GET');
  }

  async _listTables({ base_id }) {
    if (!base_id) throw new Error('Airtable listTables: base_id required');
    return this._fetch(`${this._metaUrl}/bases/${base_id}/tables`, 'GET');
  }

  async _queryRecords({ base_id, table, filterByFormula, maxRecords = 100, sort, fields, view, offset } = {}) {
    if (!base_id || !table) throw new Error('Airtable queryRecords: base_id and table required');
    const params = new URLSearchParams();
    if (filterByFormula) params.set('filterByFormula', filterByFormula);
    if (maxRecords) params.set('maxRecords', String(maxRecords));
    if (view) params.set('view', view);
    if (offset) params.set('offset', offset);
    if (sort) sort.forEach((s, i) => { params.set(`sort[${i}][field]`, s.field); if (s.direction) params.set(`sort[${i}][direction]`, s.direction); });
    if (fields) fields.forEach((f, i) => params.set(`fields[${i}]`, f));
    const qs = params.toString();
    return this._fetch(`${this._baseUrl}/${base_id}/${encodeURIComponent(table)}${qs ? '?' + qs : ''}`, 'GET');
  }

  async _createRecord({ base_id, table, fields }) {
    if (!base_id || !table || !fields) throw new Error('Airtable createRecord: base_id, table, fields required');
    return this._fetch(`${this._baseUrl}/${base_id}/${encodeURIComponent(table)}`, 'POST', { fields });
  }

  async _updateRecord({ base_id, table, record_id, fields }) {
    if (!base_id || !table || !record_id || !fields) throw new Error('Airtable updateRecord: base_id, table, record_id, fields required');
    return this._fetch(`${this._baseUrl}/${base_id}/${encodeURIComponent(table)}/${record_id}`, 'PATCH', { fields });
  }

  async _deleteRecord({ base_id, table, record_id }) {
    if (!base_id || !table || !record_id) throw new Error('Airtable deleteRecord: base_id, table, record_id required');
    return this._fetch(`${this._baseUrl}/${base_id}/${encodeURIComponent(table)}/${record_id}`, 'DELETE');
  }

  async _getRecord({ base_id, table, record_id }) {
    if (!base_id || !table || !record_id) throw new Error('Airtable getRecord: base_id, table, record_id required');
    return this._fetch(`${this._baseUrl}/${base_id}/${encodeURIComponent(table)}/${record_id}`, 'GET');
  }

  async _fetch(url, method, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, {
        method, signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this._token}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(`Airtable API ${method} ${url} => ${res.status}: ${json.error?.message || JSON.stringify(json)}`);
      return json;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default AirtableMCP;
