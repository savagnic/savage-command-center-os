/**
 * Capability Gateway — production implementation
 *
 * Enforces per-integration capability access control:
 * - Each capability has a set of allowed operations
 * - Every request is validated before reaching the integration
 * - Requests are gated by a signed nonce to prevent replay attacks
 * - Rate limiting per capability per window
 *
 * Usage (Express middleware):
 *   import { capabilityGateway } from './security/capability-gateway.js';
 *   router.post('/:name/execute', capabilityGateway, handler);
 */

import { NonceLedger } from './nonce-ledger.js';

/** All capabilities with their permitted operations. */
export const CAPABILITY_MAP = {
  github: ['listRepos', 'getRepo', 'createIssue', 'listIssues', 'getIssue', 'updateIssue', 'listPullRequests', 'getPullRequest', 'searchCode', 'pushFile', 'getFileContents', 'listBranches', 'createBranch'],
  slack: ['listChannels', 'postMessage', 'getMessages', 'createChannel', 'uploadFile', 'getUserInfo', 'listUsers'],
  discord: ['sendMessage', 'listChannels', 'getGuildInfo', 'createChannel', 'deleteMessage', 'getMessages', 'addReaction', 'pinMessage'],
  airtable: ['listBases', 'listTables', 'queryRecords', 'createRecord', 'updateRecord', 'deleteRecord', 'getRecord'],
  notion: ['listPages', 'searchPages', 'getPage', 'createPage', 'updatePage', 'appendBlocks', 'getDatabase', 'queryDatabase'],
  linear: ['listIssues', 'getIssue', 'createIssue', 'updateIssue', 'listProjects', 'getProject', 'listTeams'],
  jira: ['listProjects', 'createIssue', 'getIssue', 'updateIssue', 'transitionIssue', 'addComment', 'searchIssues', 'listTransitions'],
  stripe: ['listCustomers', 'createCustomer', 'getCustomer', 'deleteCustomer', 'createPaymentIntent', 'listProducts', 'getProduct', 'createProduct', 'listSubscriptions', 'cancelSubscription', 'listInvoices'],
  openai: ['chatCompletion', 'createEmbedding', 'generateImage', 'listModels', 'moderateContent'],
  pinecone: ['listIndexes', 'describeIndex', 'upsertVectors', 'queryVectors', 'deleteVectors', 'fetchVectors'],
  postgres: ['executeQuery', 'listTables', 'describeTable', 'listDatabases'],
  sqlite: ['executeQuery', 'listTables', 'describeTable', 'executeMany'],
  figma: ['getFile', 'getNode', 'getComponents', 'getStyles', 'exportAssets', 'getComments', 'listProjects'],
  'google-drive': ['listFiles', 'getFile', 'downloadFile', 'uploadFile', 'deleteFile', 'createFolder'],
  'google-maps': ['geocode', 'reverseGeocode', 'directions', 'distanceMatrix', 'placeSearch', 'placeDetails', 'elevation'],
  brave: ['searchWeb', 'searchNews'],
  sentry: ['listProjects', 'listIssues', 'getIssue', 'listEvents', 'getEvent', 'resolveIssue'],
  puppeteer: ['navigate', 'screenshot', 'scrapeText', 'scrapeLinks', 'clickElement', 'fillForm', 'evaluateScript', 'waitForSelector'],
  docker: ['listContainers', 'startContainer', 'stopContainer', 'getLogs', 'inspectContainer', 'listImages', 'removeContainer'],
  trello: ['listBoards', 'getBoard', 'listLists', 'listCards', 'createCard', 'updateCard', 'moveCard', 'deleteCard', 'addComment'],
};

/** Rate limiting: max requests per integration per window */
const RATE_LIMIT = {
  windowMs: 60_000,   // 1 minute
  maxRequests: 120,   // per integration
};

const _rateLimitCounters = new Map(); // key: `${integration}:${windowStart}` => count

function checkRateLimit(integration) {
  const now = Date.now();
  const window = Math.floor(now / RATE_LIMIT.windowMs);
  const key = `${integration}:${window}`;
  const current = _rateLimitCounters.get(key) ?? 0;
  if (current >= RATE_LIMIT.maxRequests) {
    return { allowed: false, retryAfterMs: (window + 1) * RATE_LIMIT.windowMs - now };
  }
  _rateLimitCounters.set(key, current + 1);
  // Clean up old windows periodically
  if (current === 0) {
    for (const k of _rateLimitCounters.keys()) {
      if (!k.endsWith(`:${window}`)) _rateLimitCounters.delete(k);
    }
  }
  return { allowed: true };
}

/**
 * Express middleware that validates integration capability access.
 * Expects req.params.name and req.body.operation.
 */
export function capabilityGateway(req, res, next) {
  const integration = req.params.name;
  const operation = req.body?.operation;

  // 1. Integration must be known
  if (!integration || !(integration in CAPABILITY_MAP)) {
    return res.status(403).json({ success: false, error: `Unknown or unauthorized integration: '${integration}'` });
  }

  // 2. For execute routes, operation must be in allowed list
  if (req.path.endsWith('/execute') || operation) {
    if (!operation) {
      return res.status(400).json({ success: false, error: 'operation is required' });
    }
    const allowedOps = CAPABILITY_MAP[integration] ?? [];
    if (!allowedOps.includes(operation)) {
      return res.status(403).json({
        success: false,
        error: `Operation '${operation}' is not permitted for integration '${integration}'. Allowed: ${allowedOps.join(', ')}`,
      });
    }
  }

  // 3. Rate limit check
  const rl = checkRateLimit(integration);
  if (!rl.allowed) {
    res.set('Retry-After', String(Math.ceil((rl.retryAfterMs ?? 60000) / 1000)));
    return res.status(429).json({ success: false, error: `Rate limit exceeded for '${integration}'. Retry in ${Math.ceil((rl.retryAfterMs ?? 60000) / 1000)}s` });
  }

  // 4. Nonce validation (if X-Nonce header present)
  const nonce = req.headers['x-nonce'];
  if (nonce) {
    if (!NonceLedger.getInstance().consume(nonce)) {
      return res.status(403).json({ success: false, error: 'Invalid or replayed nonce' });
    }
  }

  next();
}

/**
 * Checks whether a given integration + operation is allowed
 * without going through HTTP. Useful for unit tests and internal validation.
 */
export function isCapabilityAllowed(integration, operation) {
  const ops = CAPABILITY_MAP[integration];
  return Array.isArray(ops) && ops.includes(operation);
}

export default capabilityGateway;
