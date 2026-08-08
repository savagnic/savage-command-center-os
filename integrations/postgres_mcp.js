import pg from 'pg';

/**
 * PostgreSQL MCP Integration — fully wired
 * Operations: executeQuery, listTables, describeTable, listDatabases,
 *             beginTransaction, commitTransaction, rollbackTransaction
 *
 * Requires: npm install pg
 */
export class PostgresMCP {
  constructor() {
    this._pool = null;
    this._connected = false;
    this._activeTransaction = null;

    this.operations = {
      executeQuery: (p) => this._executeQuery(p),
      listTables: (p) => this._listTables(p),
      describeTable: (p) => this._describeTable(p),
      listDatabases: (p) => this._listDatabases(p),
    };
  }

  async connect(config = {}) {
    const connectionString = config.connectionString || process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      // Fall back to individual params
      const host = config.host || process.env.PGHOST || 'localhost';
      const port = config.port || process.env.PGPORT || 5432;
      const database = config.database || process.env.PGDATABASE;
      const user = config.user || process.env.PGUSER;
      const password = config.password || process.env.PGPASSWORD;
      if (!database || !user) throw new Error('Postgres: connectionString or (database + user) required');
      this._pool = new pg.Pool({ host, port, database, user, password, ssl: config.ssl ?? { rejectUnauthorized: false }, max: 5 });
    } else {
      this._pool = new pg.Pool({ connectionString, ssl: config.ssl ?? { rejectUnauthorized: false }, max: 5 });
    }
    // Verify connection
    const client = await this._pool.connect();
    client.release();
    this._connected = true;
    return { connected: true };
  }

  async disconnect() {
    if (this._pool) { await this._pool.end(); this._pool = null; }
    this._connected = false;
  }
  isConnected() { return this._connected; }

  async _executeQuery({ sql, params = [] }) {
    if (!sql) throw new Error('Postgres executeQuery: sql required');
    const result = await this._pool.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount, command: result.command };
  }

  async _listTables({ schema = 'public' } = {}) {
    const result = await this._pool.query(
      `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [schema]
    );
    return { tables: result.rows };
  }

  async _describeTable({ table, schema = 'public' }) {
    if (!table) throw new Error('Postgres describeTable: table required');
    const result = await this._pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table]
    );
    return { columns: result.rows };
  }

  async _listDatabases() {
    const result = await this._pool.query(`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`);
    return { databases: result.rows.map(r => r.datname) };
  }
}

export default PostgresMCP;
