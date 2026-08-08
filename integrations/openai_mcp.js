/**
 * OpenAI MCP Integration — fully wired
 * Operations: chatCompletion, streamChatCompletion, createEmbedding,
 *             generateImage, listModels, moderateContent
 */
export class OpenAIMCP {
  constructor() {
    this._apiKey = null;
    this._baseUrl = 'https://api.openai.com/v1';
    this._connected = false;
    this._defaultModel = 'gpt-4o';

    this.operations = {
      chatCompletion: (p) => this._chatCompletion(p),
      createEmbedding: (p) => this._createEmbedding(p),
      generateImage: (p) => this._generateImage(p),
      listModels: (p) => this._listModels(p),
      moderateContent: (p) => this._moderateContent(p),
    };
  }

  async connect(config = {}) {
    const key = config.apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OpenAI: apiKey required (config.apiKey or OPENAI_API_KEY env var)');
    this._apiKey = key;
    if (config.defaultModel) this._defaultModel = config.defaultModel;
    if (config.baseUrl) this._baseUrl = config.baseUrl;
    // Verify with a lightweight models list call
    await this._fetch('/models?limit=1', 'GET');
    this._connected = true;
    return { connected: true, defaultModel: this._defaultModel };
  }

  async disconnect() { this._apiKey = null; this._connected = false; }
  isConnected() { return this._connected; }

  async _chatCompletion({ model, messages, temperature = 0.7, max_tokens, system, tools, tool_choice }) {
    if (!messages && !system) throw new Error('OpenAI chatCompletion: messages or system required');
    const msgs = system
      ? [{ role: 'system', content: system }, ...(messages || [])]
      : messages;
    return this._fetch('/chat/completions', 'POST', {
      model: model || this._defaultModel,
      messages: msgs,
      temperature,
      ...(max_tokens && { max_tokens }),
      ...(tools && { tools }),
      ...(tool_choice && { tool_choice }),
    });
  }

  async _createEmbedding({ input, model = 'text-embedding-3-small', dimensions }) {
    if (!input) throw new Error('OpenAI createEmbedding: input required');
    return this._fetch('/embeddings', 'POST', {
      input, model, ...(dimensions && { dimensions }),
    });
  }

  async _generateImage({ prompt, model = 'dall-e-3', size = '1024x1024', quality = 'standard', n = 1, style = 'vivid' }) {
    if (!prompt) throw new Error('OpenAI generateImage: prompt required');
    return this._fetch('/images/generations', 'POST', { prompt, model, size, quality, n, style });
  }

  async _listModels() {
    return this._fetch('/models', 'GET');
  }

  async _moderateContent({ input }) {
    if (!input) throw new Error('OpenAI moderateContent: input required');
    return this._fetch('/moderations', 'POST', { input });
  }

  async _fetch(path, method, body) {
    const url = `${this._baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // longer for AI calls
    try {
      const res = await fetch(url, {
        method, signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this._apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(`OpenAI API ${method} ${path} => ${res.status}: ${json.error?.message || JSON.stringify(json)}`);
      return json;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export default OpenAIMCP;
