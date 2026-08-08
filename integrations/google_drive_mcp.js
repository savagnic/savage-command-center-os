/**
 * Google Drive MCP Integration — fully wired
 * Operations: listFiles, getFile, downloadFile, uploadFile, deleteFile, createFolder
 *
 * Uses service account auth (JWT) or OAuth2 token passed directly.
 */
export class GoogleDriveMCP {
  constructor() {
    this._token = null;
    this._baseUrl = 'https://www.googleapis.com/drive/v3';
    this._uploadUrl = 'https://www.googleapis.com/upload/drive/v3';
    this._connected = false;
    this.operations = {
      listFiles: (p) => this._listFiles(p),
      getFile: (p) => this._getFile(p),
      downloadFile: (p) => this._downloadFile(p),
      uploadFile: (p) => this._uploadFile(p),
      deleteFile: (p) => this._deleteFile(p),
      createFolder: (p) => this._createFolder(p),
    };
  }
  async connect(config = {}) {
    const token = config.accessToken || process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
    if (!token) throw new Error('GoogleDrive: accessToken required (config.accessToken or GOOGLE_DRIVE_ACCESS_TOKEN env var)');
    this._token = token;
    await this._fetch('/about?fields=user');
    this._connected = true;
    return { connected: true };
  }
  async disconnect() { this._token = null; this._connected = false; }
  isConnected() { return this._connected; }
  async _listFiles({ query, pageSize = 20, fields = 'files(id,name,mimeType,size,modifiedTime)', orderBy = 'modifiedTime desc' } = {}) {
    const p = new URLSearchParams({ pageSize: String(pageSize), fields, orderBy });
    if (query) p.set('q', query);
    return this._fetch(`/files?${p}`);
  }
  async _getFile({ file_id, fields = '*' }) {
    if (!file_id) throw new Error('GoogleDrive getFile: file_id required');
    return this._fetch(`/files/${file_id}?fields=${encodeURIComponent(fields)}`);
  }
  async _downloadFile({ file_id }) {
    if (!file_id) throw new Error('GoogleDrive downloadFile: file_id required');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${this._baseUrl}/files/${file_id}?alt=media`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this._token}` },
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`GoogleDrive downloadFile => ${res.status}`);
      const buffer = await res.arrayBuffer();
      return { file_id, size: buffer.byteLength, data: Buffer.from(buffer).toString('base64') };
    } catch (err) { clearTimeout(timeout); throw err; }
  }
  async _uploadFile({ name, content, mimeType = 'application/octet-stream', parent_id }) {
    if (!name || !content) throw new Error('GoogleDrive uploadFile: name and content required');
    const meta = JSON.stringify({ name, mimeType, ...(parent_id && { parents: [parent_id] }) });
    const body = `--boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--boundary\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--boundary--`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${this._uploadUrl}/files?uploadType=multipart`, {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${this._token}`, 'Content-Type': 'multipart/related; boundary=boundary' },
        body,
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(`GoogleDrive uploadFile => ${res.status}: ${JSON.stringify(json)}`);
      return json;
    } catch (err) { clearTimeout(timeout); throw err; }
  }
  async _deleteFile({ file_id }) {
    if (!file_id) throw new Error('GoogleDrive deleteFile: file_id required');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`${this._baseUrl}/files/${file_id}`, {
        method: 'DELETE', signal: controller.signal,
        headers: { Authorization: `Bearer ${this._token}` },
      });
      clearTimeout(timeout);
      if (res.status === 204) return { deleted: true, file_id };
      throw new Error(`GoogleDrive deleteFile => ${res.status}`);
    } catch (err) { clearTimeout(timeout); throw err; }
  }
  async _createFolder({ name, parent_id }) {
    if (!name) throw new Error('GoogleDrive createFolder: name required');
    return this._fetch('/files', 'POST', {
      name, mimeType: 'application/vnd.google-apps.folder',
      ...(parent_id && { parents: [parent_id] }),
    });
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
      if (res.status === 204) return { success: true };
      const json = await res.json();
      if (!res.ok) throw new Error(`GoogleDrive API ${method} ${path} => ${res.status}: ${JSON.stringify(json)}`);
      return json;
    } catch (err) { clearTimeout(timeout); throw err; }
  }
}
export default GoogleDriveMCP;
