import Database from 'better-sqlite3';

/**
 * SQLite MCP Integration — fully wired
 * Operations: executeQuery, listTables, describeTable, executeMany
 *
 * Requires: npm install better-sqlite3
 */
export class SQLiteMCP {
  constructor() {
    this._db = null;
    this._connected = false;
    this.operations = {
      executeQuery: (p) => this._executeQuery(p),
      listTables: () => this._listTables(),
      describeTable: (p) => this._describeTable(p),
      executeMany: (p) => this._executeMany(p),
    };
  }
  async connect(config = {}) {
    const dbPath = config.path || process.env.SQLITE_DB_PATH || ':memory:';
    this._db = new Database(dbPath, { readonly: config.readonly ?? false });
    this._db.pragma('journal_mode = WAL');
    this._db.pragma('foreign_keys = ON');
    this._connected = true;
    return { connected: true, path: dbPath };
  }
  async disconnect() {
    if (this._db) { this._db.close(); this._db = null; }
    this._connected = false;
  }
  isConnected() { return this._connected && this._db !== null; }
  async _executeQuery({ sql, params = [] }) {
    if (!sql) throw new Error('SQLite executeQuery: sql required');
    const stmt = this._db.prepare(sql);
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
    if (isSelect) {
      const rows = stmt.all(...params);
      return { rows, rowCount: rows.length };
    } else {
      const info = stmt.run(...params);
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  }
  async _listTables() {
    const rows = this._db.prepare(`SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name`).all();
    return { tables: rows };
  }
  async _describeTable({ table }) {
    if (!table) throw new Error('SQLite describeTable: table required');
    const columns = this._db.prepare(`PRAGMA table_info(?)`).all(table);
    return { columns };
  }
  async _executeMany({ sql, params_list }) {
    if (!sql || !params_list?.length) throw new Error('SQLite executeMany: sql and params_list required');
    const stmt = this._db.prepare(sql);
    const results = this._db.transaction((rows) => rows.map(p => stmt.run(...(Array.isArray(p) ? p : [p]))))(params_list);
    return { results: results.map(r => ({ changes: r.changes })), total: results.length };
  }
}
export default SQLiteMCP;
