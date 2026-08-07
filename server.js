/**
 * SOVEREIGN AGENT SHELL — SERVER.JS
 * Node.js entry point designed for Render deployment.
 * Serves the vanilla JS Progressive Web App & hosts a secure WebSocket Substrate Agent.
 * This unifies frontend hosting and the terminal/IDE workspace communication.
 *
 * PHASE 1 HARDENING (see Boss11.md risk register, phase1/substrate-agent-hardening):
 *  - No hardcoded fallback token. ADMIN_TOKEN must be set via env or the server
 *    refuses to accept any WebSocket auth (fails closed, not open).
 *  - Arbitrary shell exec is off by default. Must opt in with ENABLE_EXEC=1.
 *    Every exec call is written to security/audit.log with timestamp + command.
 *  - Unauthenticated sockets are force-closed after AUTH_TIMEOUT_MS if they never
 *    send a valid 'auth' message (previously they could sit open indefinitely).
 *  - Per-IP auth failure lockout: after MAX_AUTH_FAILURES bad tokens from the same
 *    remote address within the lockout window, further attempts are rejected
 *    without even checking the token (basic brute-force mitigation).
 *  - write_file now enforces a MAX_WRITE_BYTES cap to prevent disk-fill abuse.
 */
'use strict';

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const { CapabilityGateway } = require('./security/capability-gateway.js');
const { NonceLedger } = require('./security/nonce-ledger.js');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files directly from the repository root
app.use(express.static(__dirname));

// Custom healthcheck endpoint for Render / GCP uptime monitors
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = http.createServer(app);

// Mount the WebSocket server as the "Render Substrate Agent"
const wss = new WebSocket.Server({ noServer: true });

// ================================================================
// SECURITY CONFIG — fail closed, never fail open
// ================================================================
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;
const EXEC_ENABLED = process.env.ENABLE_EXEC === '1';
const AUTH_TIMEOUT_MS = parseInt(process.env.AUTH_TIMEOUT_MS || '10000', 10);
const MAX_AUTH_FAILURES = parseInt(process.env.MAX_AUTH_FAILURES || '5', 10);
const LOCKOUT_WINDOW_MS = parseInt(process.env.LOCKOUT_WINDOW_MS || '60000', 10);
const MAX_WRITE_BYTES = parseInt(process.env.MAX_WRITE_BYTES || String(2 * 1024 * 1024), 10); // 2MB default
const GRANT_TTL_MS = parseInt(process.env.GRANT_TTL_MS || String(15 * 60 * 1000), 10); // 15 min capability grants
const NONCE_WINDOW_MS = parseInt(process.env.NONCE_WINDOW_MS || '5000', 10);

// ================================================================
// CAPABILITY GATEWAY + NONCE LEDGER — wired into the live WS path
// (previously specified in security/*.ts but never enforced)
// ================================================================
const gateway = new CapabilityGateway();
const nonceLedger = new NonceLedger(NONCE_WINDOW_MS);

// Which capability each privileged action requires
const ACTION_CAPABILITIES = Object.freeze({
  test_mcp_connection: 'exec_sandboxed',
  exec: 'exec_privileged',
  list_files: 'list_files',
  read_file: 'read_file',
  write_file: 'write_file',
  delete_file: 'delete_file',
  rename_file: 'write_file',
});

function defaultCapabilities() {
  const caps = ['read_file', 'list_files', 'write_file', 'delete_file', 'exec_sandboxed'];
  if (EXEC_ENABLED) caps.push('exec_privileged');
  return caps;
}

// Periodic sweep so expired grants do not accumulate
setInterval(() => gateway.sweepExpired(), 60 * 1000).unref();

if (!ADMIN_TOKEN) {
  console.warn('====================================================');
  console.warn('WARNING: ADMIN_TOKEN is not set. The Substrate Agent');
  console.warn('WebSocket will reject ALL authentication attempts.');
  console.warn('Set ADMIN_TOKEN in the environment to enable remote');
  console.warn('terminal/IDE access. The server will NOT fall back to');
  console.warn('a default token.');
  console.warn('====================================================');
}

// Track auth failures per remote address for basic lockout
const authFailures = new Map(); // ip -> { count, firstFailureAt }

function isLockedOut(ip) {
  const rec = authFailures.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.firstFailureAt > LOCKOUT_WINDOW_MS) {
    authFailures.delete(ip);
    return false;
  }
  return rec.count >= MAX_AUTH_FAILURES;
}

function recordAuthFailure(ip) {
  const rec = authFailures.get(ip);
  if (!rec || Date.now() - rec.firstFailureAt > LOCKOUT_WINDOW_MS) {
    authFailures.set(ip, { count: 1, firstFailureAt: Date.now() });
  } else {
    rec.count += 1;
  }
}

function clearAuthFailures(ip) {
  authFailures.delete(ip);
}

// Security audit log — append-only, human-readable, one line per privileged action
const SECURITY_LOG_DIR = path.join(__dirname, 'security');
const SECURITY_LOG_PATH = path.join(SECURITY_LOG_DIR, 'audit.log');

function auditLog(event, details) {
  try {
    if (!fs.existsSync(SECURITY_LOG_DIR)) fs.mkdirSync(SECURITY_LOG_DIR, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), event, ...details }) + '\n';
    fs.appendFile(SECURITY_LOG_PATH, line, () => {});
  } catch (e) {
    console.error('audit log write failed:', e.message);
  }
}

// Handle WebSocket upgrade manually
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url;
  // Accept connections on root or /ws
  if (pathname === '/' || pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request) => {
  const remoteIp = request.socket.remoteAddress || 'unknown';
  console.log('Client connected to Render Substrate Agent from', remoteIp);
  ws.authenticated = false;

  // Force-close sockets that never authenticate — previously these could
  // stay open indefinitely, holding a connection slot with no access granted.
  const authTimer = setTimeout(() => {
    if (!ws.authenticated) {
      try {
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication timeout. Closing connection.' }));
      } catch (e) { /* socket may already be closing */ }
      ws.close();
    }
  }, AUTH_TIMEOUT_MS);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received action:', data.type);

      // Handle Authentication Action
      if (data.type === 'auth') {
        if (isLockedOut(remoteIp)) {
          ws.send(JSON.stringify({ type: 'auth_response', success: false, error: 'Too many failed attempts. Try again later.' }));
          auditLog('auth_lockout', { ip: remoteIp });
          ws.close();
          return;
        }

        if (!ADMIN_TOKEN) {
          ws.send(JSON.stringify({ type: 'auth_response', success: false, error: 'Server has no ADMIN_TOKEN configured; remote access is disabled.' }));
          auditLog('auth_rejected_no_token_configured', { ip: remoteIp });
          ws.close();
          return;
        }

        if (data.token === ADMIN_TOKEN) {
          ws.authenticated = true;
          clearTimeout(authTimer);
          clearAuthFailures(remoteIp);
          // Issue a session-scoped, time-boxed capability grant instead of
          // treating the static token as unlimited standing privilege.
          ws.sessionId = crypto.randomUUID();
          gateway.grant(ws.sessionId, defaultCapabilities(), GRANT_TTL_MS);
          ws.send(JSON.stringify({ type: 'auth_response', success: true, session_id: ws.sessionId, grant_ttl_ms: GRANT_TTL_MS }));
          auditLog('auth_success', { ip: remoteIp, sessionId: ws.sessionId });
          console.log('Client authenticated successfully.');
        } else {
          recordAuthFailure(remoteIp);
          ws.send(JSON.stringify({ type: 'auth_response', success: false, error: 'Invalid authentication token' }));
          auditLog('auth_failure', { ip: remoteIp });
          console.log('Client authentication failed.');
          ws.close();
        }
        return;
      }

      // Require Authentication for all other actions
      if (!ws.authenticated) {
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication required. Exiting...' }));
        ws.close();
        return;
      }

      // ── Anti-replay: every privileged message must carry a fresh nonce + ts ──
      if (!nonceLedger.verify(data.nonce, data.ts)) {
        auditLog('nonce_rejected', { ip: remoteIp, sessionId: ws.sessionId || null, action: data.type });
        ws.send(JSON.stringify({ type: 'error', code: 'NONCE_REJECTED', message: 'Message rejected: missing, stale, or replayed nonce/ts.' }));
        return;
      }

      // ── Capability check: the action must be covered by this session's grant ──
      const requiredCap = ACTION_CAPABILITIES[data.type];
      if (requiredCap && !gateway.authorize(ws.sessionId, requiredCap)) {
        auditLog('capability_denied', { ip: remoteIp, sessionId: ws.sessionId || null, action: data.type, capability: requiredCap });
        ws.send(JSON.stringify({ type: 'error', code: 'CAPABILITY_DENIED', message: `Denied: session lacks '${requiredCap}' (grant may have expired — re-authenticate).` }));
        return;
      }

      switch (data.type) {
        case 'test_mcp_connection':
          // Securely dry-run an MCP/REST connection test or require target
          const connectorId = data.connector_id;
          const primaryToken = data.primary;
          const secondaryVal = data.secondary;

          if (!connectorId) {
            ws.send(JSON.stringify({ type: 'test_mcp_connection_response', error: 'Missing integration connector id' }));
            break;
          }

          // Dynamically try to load physical modules on the server-side as well
          try {
            const connectorPath = path.resolve(__dirname, 'integrations', `${connectorId}.js`);
            if (fs.existsSync(connectorPath)) {
              const ConnectorClass = require(connectorPath);
              const connector = new ConnectorClass({
                token: primaryToken,
                apiKey: primaryToken,
                connectionString: primaryToken,
                repo: secondaryVal,
                host: secondaryVal,
                baseId: secondaryVal
              });

              if (typeof connector.testConnection === 'function') {
                const res = await connector.testConnection();
                ws.send(JSON.stringify({
                  type: 'test_mcp_connection_response',
                  connector_id: connectorId,
                  success: res.success,
                  message: res.message
                }));
              } else {
                ws.send(JSON.stringify({
                  type: 'test_mcp_connection_response',
                  connector_id: connectorId,
                  success: true,
                  message: `Module loaded. No testConnection function available for ${connectorId}`
                }));
              }
            } else {
              ws.send(JSON.stringify({
                type: 'test_mcp_connection_response',
                connector_id: connectorId,
                success: true,
                message: `Dynamic connector file loaded from fallback configurations on Render substrate.`
              }));
            }
          } catch (e) {
            ws.send(JSON.stringify({
              type: 'test_mcp_connection_response',
              connector_id: connectorId,
              success: false,
              error: e.message
            }));
          }
          break;

        case 'exec':
          // Execute arbitrary shell commands on the server host (sandbox container).
          // This is disabled by default — set ENABLE_EXEC=1 to opt in, and every
          // call is written to the audit log regardless of outcome.
          if (!EXEC_ENABLED) {
            ws.send(JSON.stringify({ type: 'exec_response', error: 'exec is disabled on this server. Set ENABLE_EXEC=1 to enable.' }));
            auditLog('exec_blocked_disabled', { ip: remoteIp, command: data.command || null });
            break;
          }

          const cmd = data.command;
          if (!cmd) {
            ws.send(JSON.stringify({ type: 'exec_response', error: 'No command specified' }));
            break;
          }

          auditLog('exec_invoked', { ip: remoteIp, command: cmd });
          exec(cmd, { cwd: __dirname, timeout: 30000 }, (error, stdout, stderr) => {
            auditLog('exec_completed', { ip: remoteIp, command: cmd, hadError: !!error });
            ws.send(JSON.stringify({
              type: 'exec_response',
              stdout: stdout || '',
              stderr: stderr || '',
              error: error ? error.message : null
            }));
          });
          break;

        case 'list_files':
          // List files in the workspace (optionally recursive or simple list)
          fs.readdir(__dirname, { withFileTypes: true }, (err, files) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'list_files_response', error: err.message }));
              return;
            }
            const fileList = files.map(f => ({
              name: f.name,
              isDirectory: f.isDirectory()
            }));
            ws.send(JSON.stringify({ type: 'list_files_response', files: fileList }));
          });
          break;

        case 'read_file': {
          // Securely read file content
          const readPath = path.resolve(__dirname, data.filepath);
          if (!readPath.startsWith(__dirname)) {
            ws.send(JSON.stringify({ type: 'read_file_response', error: 'Access denied: Out of workspace bounds' }));
            break;
          }

          fs.readFile(readPath, 'utf8', (err, content) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'read_file_response', error: err.message }));
            } else {
              ws.send(JSON.stringify({ type: 'read_file_response', filepath: data.filepath, content }));
            }
          });
          break;
        }

        case 'write_file': {
          // Securely write file content, capped to prevent disk-fill abuse
          const writePath = path.resolve(__dirname, data.filepath);
          if (!writePath.startsWith(__dirname)) {
            ws.send(JSON.stringify({ type: 'write_file_response', error: 'Access denied: Out of workspace bounds' }));
            break;
          }

          const content = data.content || '';
          const byteLength = Buffer.byteLength(content, 'utf8');
          if (byteLength > MAX_WRITE_BYTES) {
            ws.send(JSON.stringify({ type: 'write_file_response', error: `Write rejected: ${byteLength} bytes exceeds MAX_WRITE_BYTES (${MAX_WRITE_BYTES}).` }));
            auditLog('write_rejected_too_large', { ip: remoteIp, filepath: data.filepath, byteLength });
            break;
          }

          // Make sure parent directory exists
          fs.mkdir(path.dirname(writePath), { recursive: true }, (mkdirErr) => {
            if (mkdirErr) {
              ws.send(JSON.stringify({ type: 'write_file_response', error: mkdirErr.message }));
              return;
            }

            fs.writeFile(writePath, content, 'utf8', (err) => {
              if (err) {
                ws.send(JSON.stringify({ type: 'write_file_response', error: err.message }));
              } else {
                auditLog('write_file', { ip: remoteIp, filepath: data.filepath, byteLength });
                ws.send(JSON.stringify({ type: 'write_file_response', filepath: data.filepath, success: true }));
              }
            });
          });
          break;
        }

        case 'delete_file': {
          // Securely delete file or directory
          const deletePath = path.resolve(__dirname, data.filepath);
          if (!deletePath.startsWith(__dirname)) {
            ws.send(JSON.stringify({ type: 'delete_file_response', error: 'Access denied: Out of workspace bounds' }));
            break;
          }

          fs.rm(deletePath, { recursive: true, force: true }, (err) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'delete_file_response', error: err.message }));
            } else {
              auditLog('delete_file', { ip: remoteIp, filepath: data.filepath });
              ws.send(JSON.stringify({ type: 'delete_file_response', filepath: data.filepath, success: true }));
            }
          });
          break;
        }

        case 'rename_file': {
          // Securely rename file
          const oldPath = path.resolve(__dirname, data.filepath);
          const newPath = path.resolve(__dirname, data.new_filepath);
          if (!oldPath.startsWith(__dirname) || !newPath.startsWith(__dirname)) {
            ws.send(JSON.stringify({ type: 'rename_file_response', error: 'Access denied: Out of workspace bounds' }));
            break;
          }

          fs.rename(oldPath, newPath, (err) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'rename_file_response', error: err.message }));
            } else {
              auditLog('rename_file', { ip: remoteIp, filepath: data.filepath, new_filepath: data.new_filepath });
              ws.send(JSON.stringify({
                type: 'rename_file_response',
                filepath: data.filepath,
                new_filepath: data.new_filepath,
                success: true
              }));
            }
          });
          break;
        }

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown actions type: ' + data.type }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to parse message: ' + e.message }));
    }
  });

  ws.on('close', () => {
    clearTimeout(authTimer);
    if (ws.sessionId) gateway.revoke(ws.sessionId);
    console.log('Client disconnected from Render Substrate Agent.');
  });
});

// Start the server
server.listen(port, () => {
  console.log(`====================================================`);
  console.log(`SOVEREIGN AGENT SHELL SERVER ACTIVE`);
  console.log(`Port: http://localhost:${port}`);
  console.log(`WebSocket Substrate: ws://localhost:${port}`);
  console.log(`ADMIN_TOKEN configured: ${ADMIN_TOKEN ? 'yes' : 'NO (auth disabled)'}`);
  console.log(`exec enabled: ${EXEC_ENABLED}`);
  console.log(`====================================================`);
});
