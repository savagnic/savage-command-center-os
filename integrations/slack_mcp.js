/**
 * Slack MCP Integration — fully wired
 * Operations: listChannels, postMessage, getMessages, createChannel,
 *             uploadFile, getUserInfo, listUsers
 */
export class SlackMCP {
  constructor() {
    this._token = null;
    this._baseUrl = 'https://slack.com/api';
    this._connected = false;
    this._team = null;

    this.operations = {
      listChannels: (p) => this._listChannels(p),
      postMessage: (p) => this._postMessage(p),
      getMessages: (p) => this._getMessages(p),
      createChannel: (p) => this._createChannel(p),
      uploadFile: (p) => this._uploadFile(p),
      getUserInfo: (p) => this._getUserInfo(p),
      listUsers: (p) => this._listUsers(p),
    };
  }

  async connect(config = {}) {
    const token = config.token || process.env.SLACK_BOT_TOKEN;
    if (!token) throw new Error('Slack: token required (config.token or SLACK_BOT_TOKEN env var)');
    this._token = token;
    const res = await this._call('auth.test', {});
    if (!res.ok) throw new Error(`Slack auth.test failed: ${res.error}`);
    this._team = res.team;
    this._connected = true;
    return { connected: true, team: this._team, user: res.user };
  }

  async disconnect() {
    this._token = null;
    this._connected = false;
    this._team = null;
  }

  isConnected() { return this._connected; }

  async _listChannels({ types = 'public_channel,private_channel', limit = 100, cursor } = {}) {
    return this._call('conversations.list', { types, limit, ...(cursor && { cursor }) });
  }

  async _postMessage({ channel, text, blocks, thread_ts }) {
    if (!channel || !text) throw new Error('Slack postMessage: channel and text required');
    return this._call('chat.postMessage', {
      channel, text,
      ...(blocks && { blocks }),
      ...(thread_ts && { thread_ts }),
    });
  }

  async _getMessages({ channel, limit = 50, oldest, latest }) {
    if (!channel) throw new Error('Slack getMessages: channel required');
    return this._call('conversations.history', {
      channel, limit,
      ...(oldest && { oldest }),
      ...(latest && { latest }),
    });
  }

  async _createChannel({ name, is_private = false }) {
    if (!name) throw new Error('Slack createChannel: name required');
    return this._call('conversations.create', { name, is_private });
  }

  async _uploadFile({ channels, content, filename, filetype = 'text', title }) {
    if (!channels || !content) throw new Error('Slack uploadFile: channels and content required');
    return this._call('files.upload', { channels, content, filename, filetype, ...(title && { title }) });
  }

  async _getUserInfo({ user }) {
    if (!user) throw new Error('Slack getUserInfo: user id required');
    return this._call('users.info', { user });
  }

  async _listUsers({ limit = 200, cursor } = {}) {
    return this._call('users.list', { limit, ...(cursor && { cursor }) });
  }

  async _call(method, params) {
    const url = `${this._baseUrl}/${method}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this._token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Slack HTTP ${res.status} on ${method}`);
      return res.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default SlackMCP;
