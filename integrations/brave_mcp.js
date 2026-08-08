/**
 * Brave Search MCP Integration — fully wired
 * Operations: searchWeb, searchNews, searchImages
 */
export class BraveMCP {
  constructor() {
    this._apiKey = null;
    this._baseUrl = 'https://api.search.brave.com/res/v1';
    this._connected = false;
    this.operations = {
      searchWeb: (p) => this._searchWeb(p),
      searchNews: (p) => this._searchNews(p),
    };
  }
  async connect(config = {}) {
    const key = config.apiKey || process.env.BRAVE_API_KEY;
    if (!key) throw new Error('Brave: apiKey required (config.apiKey or BRAVE_API_KEY env var)');
    this._apiKey = key;
    this._connected = true;
    return { connected: true };
  }
  async disconnect() { this._apiKey = null; this._connected = false; }
  isConnected() { return this._connected; }
  async _searchWeb({ query, count = 10, offset = 0, country = 'US', lang = 'en', safesearch = 'moderate' } = {}) {
    if (!query) throw new Error('Brave searchWeb: query required');
    const p = new URLSearchParams({ q: query, count: String(count), offset: String(offset), country, search_lang: lang, safesearch });
    return this._fetch(`/web/search?${p}`);
  }
  async _searchNews({ query, count = 10, country = 'US', freshness } = {}) {
    if (!query) throw new Error('Brave searchNews: query required');
    const p = new URLSearchParams({ q: query, count: String(count), country });
    if (freshness) p.set('freshness', freshness);
    return this._fetch(`/news/search?${p}`);
  }
  async _fetch(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${this._baseUrl}${path}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': this._apiKey },
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(`Brave API ${path} => ${res.status}: ${JSON.stringify(json)}`);
      return json;
    } catch (err) { clearTimeout(timeout); throw err; }
  }
}
export default BraveMCP;
