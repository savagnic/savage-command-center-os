/**
 * SOVEREIGN AGENT SHELL — SERVER.JS
 * Node.js entry point designed for Render deployment.
 * Serves the vanilla JS Progressive Web App & hosts a secure WebSocket Substrate Agent.
 * This unifies frontend hosting and the terminal/IDE workspace communication.
 */
'use strict';

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

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

// Required authentication token from environment variable or generated default
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sovereign_secret_token_1337';

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

wss.on('connection', (ws) => {
  console.log('Client connected to Render Substrate Agent.');
  ws.authenticated = false;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received action:', data.type);

      // Handle Authentication Action
      if (data.type === 'auth') {
        if (data.token === ADMIN_TOKEN) {
          ws.authenticated = true;
          ws.send(JSON.stringify({ type: 'auth_response', success: true }));
          console.log('Client authenticated successfully.');
        } else {
          ws.send(JSON.stringify({ type: 'auth_response', success: false, error: 'Invalid authentication token' }));
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

      switch (data.type) {
        case 'exec':
          // Execute arbitrary shell commands on the server host (sandbox container)
          const cmd = data.command;
          if (!cmd) {
            ws.send(JSON.stringify({ type: 'exec_response', error: 'No command specified' }));
            break;
          }

          exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
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

        case 'read_file':
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

        case 'write_file':
          // Securely write file content
          const writePath = path.resolve(__dirname, data.filepath);
          if (!writePath.startsWith(__dirname)) {
            ws.send(JSON.stringify({ type: 'write_file_response', error: 'Access denied: Out of workspace bounds' }));
            break;
          }

          // Make sure parent directory exists
          fs.mkdir(path.dirname(writePath), { recursive: true }, (mkdirErr) => {
            if (mkdirErr) {
              ws.send(JSON.stringify({ type: 'write_file_response', error: mkdirErr.message }));
              return;
            }

            fs.writeFile(writePath, data.content || '', 'utf8', (err) => {
              if (err) {
                ws.send(JSON.stringify({ type: 'write_file_response', error: err.message }));
              } else {
                ws.send(JSON.stringify({ type: 'write_file_response', filepath: data.filepath, success: true }));
              }
            });
          });
          break;

        case 'delete_file':
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
              ws.send(JSON.stringify({ type: 'delete_file_response', filepath: data.filepath, success: true }));
            }
          });
          break;

        case 'rename_file':
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
              ws.send(JSON.stringify({
                type: 'rename_file_response',
                filepath: data.filepath,
                new_filepath: data.new_filepath,
                success: true
              }));
            }
          });
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown actions type: ' + data.type }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to parse message: ' + e.message }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from Render Substrate Agent.');
  });
});

// Start the server
server.listen(port, () => {
  console.log(`====================================================`);
  console.log(`SOVEREIGN AGENT SHELL SERVER ACTIVE`);
  console.log(`Port: http://localhost:${port}`);
  console.log(`WebSocket Substrate: ws://localhost:${port}`);
  console.log(`====================================================`);
});
