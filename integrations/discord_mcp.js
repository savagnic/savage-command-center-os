/**
 * Discord MCP Integration — fully wired
 * Operations: sendMessage, listChannels, getGuildInfo, createChannel,
 *             deleteMessage, getMessages, addReaction, pinMessage
 */
export class DiscordMCP {
  constructor() {
    this._token = null;
    this._baseUrl = 'https://discord.com/api/v10';
    this._connected = false;
    this._botUser = null;

    this.operations = {
      sendMessage: (p) => this._sendMessage(p),
      listChannels: (p) => this._listChannels(p),
      getGuildInfo: (p) => this._getGuildInfo(p),
      createChannel: (p) => this._createChannel(p),
      deleteMessage: (p) => this._deleteMessage(p),
      getMessages: (p) => this._getMessages(p),
      addReaction: (p) => this._addReaction(p),
      pinMessage: (p) => this._pinMessage(p),
    };
  }

  async connect(config = {}) {
    const token = config.token || process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error('Discord: token required (config.token or DISCORD_BOT_TOKEN env var)');
    this._token = `Bot ${token}`;
    const res = await this._fetch('/users/@me', 'GET');
    this._botUser = res;
    this._connected = true;
    return { connected: true, bot: res.username };
  }

  async disconnect() { this._token = null; this._connected = false; this._botUser = null; }
  isConnected() { return this._connected; }

  async _sendMessage({ channel_id, content, embeds, components }) {
    if (!channel_id || !content) throw new Error('Discord sendMessage: channel_id and content required');
    return this._fetch(`/channels/${channel_id}/messages`, 'POST', {
      content, ...(embeds && { embeds }), ...(components && { components }),
    });
  }

  async _listChannels({ guild_id }) {
    if (!guild_id) throw new Error('Discord listChannels: guild_id required');
    return this._fetch(`/guilds/${guild_id}/channels`, 'GET');
  }

  async _getGuildInfo({ guild_id }) {
    if (!guild_id) throw new Error('Discord getGuildInfo: guild_id required');
    return this._fetch(`/guilds/${guild_id}`, 'GET');
  }

  async _createChannel({ guild_id, name, type = 0, topic, parent_id }) {
    if (!guild_id || !name) throw new Error('Discord createChannel: guild_id and name required');
    return this._fetch(`/guilds/${guild_id}/channels`, 'POST', {
      name, type, ...(topic && { topic }), ...(parent_id && { parent_id }),
    });
  }

  async _deleteMessage({ channel_id, message_id }) {
    if (!channel_id || !message_id) throw new Error('Discord deleteMessage: channel_id and message_id required');
    await this._fetch(`/channels/${channel_id}/messages/${message_id}`, 'DELETE');
    return { deleted: true };
  }

  async _getMessages({ channel_id, limit = 50, before, after }) {
    if (!channel_id) throw new Error('Discord getMessages: channel_id required');
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    if (after) params.set('after', after);
    return this._fetch(`/channels/${channel_id}/messages?${params}`, 'GET');
  }

  async _addReaction({ channel_id, message_id, emoji }) {
    if (!channel_id || !message_id || !emoji) throw new Error('Discord addReaction: channel_id, message_id, emoji required');
    await this._fetch(`/channels/${channel_id}/messages/${message_id}/reactions/${encodeURIComponent(emoji)}/@me`, 'PUT');
    return { reacted: true };
  }

  async _pinMessage({ channel_id, message_id }) {
    if (!channel_id || !message_id) throw new Error('Discord pinMessage: channel_id and message_id required');
    await this._fetch(`/channels/${channel_id}/pins/${message_id}`, 'PUT');
    return { pinned: true };
  }

  async _fetch(path, method, body) {
    const url = `${this._baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, {
        method, signal: controller.signal,
        headers: {
          Authorization: this._token,
          'Content-Type': 'application/json',
          'User-Agent': 'SavageCommandCenter (https://github.com/NS-SIAV6-OS/savage-command-center, 1.0)',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      clearTimeout(timeout);
      if (res.status === 204) return { success: true };
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Discord API ${method} ${path} => ${res.status}: ${err.message || JSON.stringify(err)}`);
      }
      return res.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default DiscordMCP;
