/**
 * Savage Command Center — Central MCP Integration Registry
 * 
 * All 17+ integrations are registered here. Each exposes:
 *   - connect(config): establish connection with API keys / credentials
 *   - disconnect(): tear down connection
 *   - isConnected(): connection status check
 *   - operations: named async functions callable via POST /api/integrations/:name/execute
 *
 * Usage:
 *   const reg = IntegrationRegistry.getInstance();
 *   await reg.connect('github', { token: 'ghp_...' });
 *   const result = await reg.execute('github', 'listRepos', { per_page: 30 });
 */

import AirtableMCP from './airtable_mcp.js';
import BraveMCP from './brave_mcp.js';
import DiscordMCP from './discord_mcp.js';
import DockerMCP from './docker_mcp.js';
import FigmaMCP from './figma_mcp.js';
import GitHubMCP from './github_mcp.js';
import GoogleDriveMCP from './google_drive_mcp.js';
import GoogleMapsMCP from './google_maps_mcp.js';
import JiraMCP from './jira_mcp.js';
import LinearMCP from './linear_mcp.js';
import NotionMCP from './notion_mcp.js';
import OpenAIMCP from './openai_mcp.js';
import PineconeMCP from './pinecone_mcp.js';
import PostgresMCP from './postgres_mcp.js';
import PuppeteerMCP from './puppeteer_mcp.js';
import SentryMCP from './sentry_mcp.js';
import SlackMCP from './slack_mcp.js';
import SQLiteMCP from './sqlite_mcp.js';
import StripeMCP from './stripe_mcp.js';
import TrelloMCP from './trello_mcp.js';

/** Metadata + connection state for a single integration. */
export class IntegrationRegistration {
 constructor(name, displayName, description, instance) {
 this.name = name;
 this.displayName = displayName;
 this.description = description;
 this.instance = instance;
 }

 async connect(config = {}) { return this.instance.connect(config); }
 async disconnect() { return this.instance.disconnect(); }
 isConnected() { return this.instance.isConnected(); }

 async execute(operation, params = {}) {
 if (!this.isConnected()) {
 throw new Error(`Integration '${this.name}' is not connected. Call connect() first.`);
 }
 const ops = this.instance.operations || {};
 if (typeof ops[operation] !== 'function') {
 throw new Error(`Unknown operation '${operation}' for integration '${this.name}'. Available: ${Object.keys(ops).join(', ')}`);
 }
 return ops[operation](params);
 }

 toStatus() {
 return {
 name: this.name,
 displayName: this.displayName,
 description: this.description,
 connected: this.isConnected(),
 operations: Object.keys(this.instance.operations || {})
 };
 }
}

/** Singleton registry of all integrations. */
export class IntegrationRegistry {
 static _instance = null;

 constructor() {
 this._integrations = new Map();
 this._register();
 }

 static getInstance() {
 if (!IntegrationRegistry._instance) {
 IntegrationRegistry._instance = new IntegrationRegistry();
 }
 return IntegrationRegistry._instance;
 }

 _register() {
 const defs = [
 ['airtable', 'Airtable', 'Read/write Airtable bases and records', new AirtableMCP()],
 ['brave', 'Brave Search', 'Web and news search via Brave API', new BraveMCP()],
 ['discord', 'Discord', 'Send messages and manage Discord channels', new DiscordMCP()],
 ['docker', 'Docker', 'Manage Docker containers and images', new DockerMCP()],
 ['figma', 'Figma', 'Inspect files and export design assets', new FigmaMCP()],
 ['github', 'GitHub', 'Repos, issues, PRs, and code search', new GitHubMCP()],
 ['google-drive', 'Google Drive', 'List, upload, and download Drive files', new GoogleDriveMCP()],
 ['google-maps', 'Google Maps', 'Geocoding, directions, and place search', new GoogleMapsMCP()],
 ['jira', 'Jira', 'Projects, issues, and transitions', new JiraMCP()],
 ['linear', 'Linear', 'Issues, projects, and roadmaps', new LinearMCP()],
 ['notion', 'Notion', 'Pages, databases, and blocks', new NotionMCP()],
 ['openai', 'OpenAI', 'Chat completions, embeddings, and images', new OpenAIMCP()],
 ['pinecone', 'Pinecone', 'Vector upsert, query, and index management', new PineconeMCP()],
 ['postgres', 'PostgreSQL', 'Query and describe Postgres databases', new PostgresMCP()],
 ['puppeteer', 'Puppeteer', 'Headless browser automation and scraping', new PuppeteerMCP()],
 ['sentry', 'Sentry', 'List issues, projects, and events', new SentryMCP()],
 ['slack', 'Slack', 'Post messages and manage Slack channels', new SlackMCP()],
 ['sqlite', 'SQLite', 'Query SQLite databases', new SQLiteMCP()],
 ['stripe', 'Stripe', 'Customers, payments, and products', new StripeMCP()],
 ['trello', 'Trello', 'Boards, lists, and cards', new TrelloMCP()],
 ];
 for (const [name, displayName, description, instance] of defs) {
 this._integrations.set(name, new IntegrationRegistration(name, displayName, description, instance));
 }
 }

 /** Connect a named integration with the given config (API keys, etc). */
 async connect(name, config = {}) {
 const reg = this._get(name);
 await reg.connect(config);
 }

 /** Disconnect a named integration. */
 async disconnect(name) {
 const reg = this._get(name);
 await reg.disconnect();
 }

 /** Execute an operation on a connected integration. */
 async execute(name, operation, params = {}) {
 const reg = this._get(name);
 return reg.execute(operation, params);
 }

 /** Get status of all integrations. */
 listAll() {
 return Array.from(this._integrations.values()).map(r => r.toStatus());
 }

 /** Get status of a single integration. */
 getStatus(name) {
 return this._get(name).toStatus();
 }

 _get(name) {
 const reg = this._integrations.get(name);
 if (!reg) throw new Error(`Unknown integration: '${name}'. Available: ${Array.from(this._integrations.keys()).join(', ')}`);
 return reg;
 }
}

export default IntegrationRegistry;
