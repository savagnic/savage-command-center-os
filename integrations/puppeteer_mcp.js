import puppeteer from 'puppeteer';

/**
 * Puppeteer MCP Integration — fully wired
 * Operations: navigate, screenshot, scrapeText, scrapeLinks,
 *             clickElement, fillForm, evaluateScript, waitForSelector
 *
 * Requires: npm install puppeteer
 */
export class PuppeteerMCP {
  constructor() {
    this._browser = null;
    this._page = null;
    this._connected = false;
    this.operations = {
      navigate: (p) => this._navigate(p),
      screenshot: (p) => this._screenshot(p),
      scrapeText: (p) => this._scrapeText(p),
      scrapeLinks: (p) => this._scrapeLinks(p),
      clickElement: (p) => this._clickElement(p),
      fillForm: (p) => this._fillForm(p),
      evaluateScript: (p) => this._evaluateScript(p),
      waitForSelector: (p) => this._waitForSelector(p),
    };
  }
  async connect(config = {}) {
    this._browser = await puppeteer.launch({
      headless: config.headless !== false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      ...(config.executablePath && { executablePath: config.executablePath }),
    });
    this._page = await this._browser.newPage();
    await this._page.setViewport({ width: 1440, height: 900 });
    await this._page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
    this._connected = true;
    return { connected: true };
  }
  async disconnect() {
    if (this._browser) { await this._browser.close(); this._browser = null; this._page = null; }
    this._connected = false;
  }
  isConnected() { return this._connected && this._browser !== null; }
  async _navigate({ url, waitUntil = 'networkidle2', timeout = 30000 }) {
    if (!url) throw new Error('Puppeteer navigate: url required');
    await this._page.goto(url, { waitUntil, timeout });
    return { url, title: await this._page.title() };
  }
  async _screenshot({ path, fullPage = false, format = 'png' } = {}) {
    const data = await this._page.screenshot({ fullPage, type: format, ...(path && { path }) });
    return { format, size: data.length, base64: Buffer.from(data).toString('base64') };
  }
  async _scrapeText({ selector } = {}) {
    if (selector) return this._page.$eval(selector, el => el.textContent?.trim() || '');
    return this._page.evaluate(() => document.body.innerText);
  }
  async _scrapeLinks({ selector = 'a' } = {}) {
    return this._page.$$eval(selector, els => els.map(el => ({ text: el.textContent?.trim(), href: el.getAttribute('href') })));
  }
  async _clickElement({ selector }) {
    if (!selector) throw new Error('Puppeteer clickElement: selector required');
    await this._page.click(selector);
    return { clicked: selector };
  }
  async _fillForm({ selector, value }) {
    if (!selector || value === undefined) throw new Error('Puppeteer fillForm: selector and value required');
    await this._page.focus(selector);
    await this._page.keyboard.selectAll();
    await this._page.keyboard.type(String(value));
    return { filled: selector };
  }
  async _evaluateScript({ script }) {
    if (!script) throw new Error('Puppeteer evaluateScript: script required');
    return this._page.evaluate(script);
  }
  async _waitForSelector({ selector, timeout = 10000 }) {
    if (!selector) throw new Error('Puppeteer waitForSelector: selector required');
    await this._page.waitForSelector(selector, { timeout });
    return { found: selector };
  }
}
export default PuppeteerMCP;
