/**
 * Savage Command Center — Integration API Router
 * 
 * Mounts /api/integrations routes onto an Express app.
 * Import and use: app.use(integrationRouter);
 *
 * Routes:
 *   GET  /api/integrations              — list all integrations + status
 *   GET  /api/integrations/:name        — get single integration status
 *   POST /api/integrations/:name/connect — connect with config
 *   DELETE /api/integrations/:name       — disconnect
 *   POST /api/integrations/:name/execute — execute an operation
 */

import express from 'express';
import { IntegrationRegistry } from './integrations/index.js';

const router = express.Router();
const registry = IntegrationRegistry.getInstance();

/**
 * Shared error handler — normalises error messages for API responses.
 * Never leaks stack traces to the client.
 */
function handleError(res, err, status = 500) {
  const message = err?.message || 'Internal error';
  console.error('[IntegrationAPI]', message);
  return res.status(status).json({ success: false, error: message });
}

/** GET /api/integrations — list all integrations with connection status */
router.get('/', (req, res) => {
  try {
    return res.json({ success: true, integrations: registry.listAll() });
  } catch (err) {
    return handleError(res, err);
  }
});

/** GET /api/integrations/:name — status of a single integration */
router.get('/:name', (req, res) => {
  try {
    const status = registry.getStatus(req.params.name);
    return res.json({ success: true, integration: status });
  } catch (err) {
    return handleError(res, err, 404);
  }
});

/** POST /api/integrations/:name/connect — connect with API keys / config */
router.post('/:name/connect', async (req, res) => {
  try {
    const result = await registry.connect(req.params.name, req.body || {});
    return res.json({ success: true, result });
  } catch (err) {
    return handleError(res, err);
  }
});

/** DELETE /api/integrations/:name — disconnect */
router.delete('/:name', async (req, res) => {
  try {
    await registry.disconnect(req.params.name);
    return res.json({ success: true, message: `${req.params.name} disconnected` });
  } catch (err) {
    return handleError(res, err);
  }
});

/**
 * POST /api/integrations/:name/execute
 * Body: { operation: string, params?: object }
 */
router.post('/:name/execute', async (req, res) => {
  const { operation, params = {} } = req.body || {};
  if (!operation) {
    return res.status(400).json({ success: false, error: 'operation is required in request body' });
  }
  try {
    const result = await registry.execute(req.params.name, operation, params);
    return res.json({ success: true, result });
  } catch (err) {
    // 400 for user errors (missing params, wrong operation), 500 for infrastructure
    const status = err.message?.includes('required') || err.message?.includes('Unknown operation') ? 400 : 500;
    return handleError(res, err, status);
  }
});

export default router;
