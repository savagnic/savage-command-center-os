/**
 * Trello MCP Integration — fully wired
 * Operations: listBoards, getBoard, listLists, listCards,
 *             createCard, updateCard, moveCard, deleteCard, addComment
 */
export class TrelloMCP {
  constructor() {
    this._key = null;
    this._token = null;
    this._baseUrl = 'https://api.trello.com/1';
    this._connected = false;
    this.operations = {
      listBoards: (p) => this._listBoards(p),
      getBoard: (p) => this._getBoard(p),
      listLists: (p) => this._listLists(p),
      listCards: (p) => this._listCards(p),
      createCard: (p) => this._createCard(p),
      updateCard: (p) => this._updateCard(p),
      moveCard: (p) => this._moveCard(p),
      deleteCard: (p) => this._deleteCard(p),
      addComment: (p) => this._addComment(p),
    };
  }
  async connect(config = {}) {
    const key = config.key || process.env.TRELLO_API_KEY;
    const token = config.token || process.env.TRELLO_TOKEN;
    if (!key || !token) throw new Error('Trello: key and token required (TRELLO_API_KEY, TRELLO_TOKEN env vars)');
    this._key = key;
    this._token = token;
    await this._fetch('/members/me');
    this._connected = true;
    return { connected: true };
  }
  async disconnect() { this._key = null; this._token = null; this._connected = false; }
  isConnected() { return this._connected; }
  _auth() { return { key: this._key, token: this._token }; }
  async _listBoards({ filter = 'open' } = {}) {
    return this._fetch(`/members/me/boards?filter=${filter}`);
  }
  async _getBoard({ board_id, lists = 'open', cards = 'none' }) {
    if (!board_id) throw new Error('Trello getBoard: board_id required');
    return this._fetch(`/boards/${board_id}?lists=${lists}&cards=${cards}`);
  }
  async _listLists({ board_id, filter = 'open' }) {
    if (!board_id) throw new Error('Trello listLists: board_id required');
    return this._fetch(`/boards/${board_id}/lists?filter=${filter}`);
  }
  async _listCards({ list_id }) {
    if (!list_id) throw new Error('Trello listCards: list_id required');
    return this._fetch(`/lists/${list_id}/cards`);
  }
  async _createCard({ list_id, name, desc, pos = 'bottom', due, labels }) {
    if (!list_id || !name) throw new Error('Trello createCard: list_id and name required');
    const p = new URLSearchParams({ idList: list_id, name, pos, ...this._auth() });
    if (desc) p.set('desc', desc);
    if (due) p.set('due', due);
    if (labels) p.set('idLabels', labels.join(','));
    return this._fetch('/cards', 'POST', null, p);
  }
  async _updateCard({ card_id, name, desc, closed, pos }) {
    if (!card_id) throw new Error('Trello updateCard: card_id required');
    const p = new URLSearchParams(this._auth());
    if (name !== undefined) p.set('name', name);
    if (desc !== undefined) p.set('desc', desc);
    if (closed !== undefined) p.set('closed', String(closed));
    if (pos !== undefined) p.set('pos', String(pos));
    return this._fetch(`/cards/${card_id}`, 'PUT', null, p);
  }
  async _moveCard({ card_id, list_id }) {
    if (!card_id || !list_id) throw new Error('Trello moveCard: card_id and list_id required');
    const p = new URLSearchParams({ idList: list_id, ...this._auth() });
    return this._fetch(`/cards/${card_id}`, 'PUT', null, p);
  }
  async _deleteCard({ card_id }) {
    if (!card_id) throw new Error('Trello deleteCard: card_id required');
    return this._fetch(`/cards/${card_id}`, 'DELETE');
  }
  async _addComment({ card_id, text }) {
    if (!card_id || !text) throw new Error('Trello addComment: card_id and text required');
    const p = new URLSearchParams({ text, ...this._auth() });
    return this._fetch(`/cards/${card_id}/actions/comments`, 'POST', null, p);
  }
  async _fetch(path, method = 'GET', body, formParams) {
    const auth = new URLSearchParams(this._auth ? this._auth() : {});
    const url = `${this._baseUrl}${path}${path.includes('?') ? '&' : '?'}${auth}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const init = { method, signal: controller.signal };
      if (formParams) {
        init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        init.body = formParams.toString();
      } else if (body) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(body);
      }
      const res = await fetch(url, init);
      clearTimeout(timeout);
      if (res.status === 200 && method === 'DELETE') return { deleted: true };
      const json = await res.json();
      if (!res.ok) throw new Error(`Trello API ${method} ${path} => ${res.status}: ${JSON.stringify(json)}`);
      return json;
    } catch (err) { clearTimeout(timeout); throw err; }
  }
}
export default TrelloMCP;
