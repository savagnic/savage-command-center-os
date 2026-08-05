# AGENTS.md — Agent Show Production-Ready Governance Contract

## MISSION STATEMENT
Transform 'Agent Show' into a hyper-performant, next-generation mobile development platform that completely surpasses Termux, Replit, Emergence, and Lovable across all native execution, VFS synchronization, and agentic self-healing capabilities.

---

## 1. MANDATORY EXECUTION & GATEKEEPING RULES
Jules MUST NOT mark a session complete, close a pull request, or hand off execution until ALL criteria in this document pass without a single failure or warning.

### A. Zero-Tolerance Code Cleanliness
- **Syntax Verification:** `node --check app.js` MUST execute with zero exit code errors.
- **Rebrand Integrity:** Running `grep -rnE -i "savage|command center" .` MUST return zero occurrences across all files (`.html`, `.js`, `.css`, `.json`, `.md`).
- **Scope Leakage:** Zero undeclared global variables or stray console debugging statements allowed in production builds.

### B. Functional Benchmarks (Pass/Fail)
1. **Terminal POSIX / WebSocket Bridge:**
   - `#panel-terminal` must connect to `ws://127.0.0.1:8080`.
   - On disconnect, execution MUST fall back to local WebAssembly/JS in `< 50ms`.
   - `.terminal-touch-toolbar` sticky inputs (`CTRL`, `ALT`, `ESC`, `TAB`, `|`, `~`) MUST dispatch synthesize keyboard events directly into `#terminal-input`.
2. **VFS & Sandbox Synchronization:**
   - `getVFS()` and `saveVFSFile()` MUST persist cleanly with IndexedDB.
   - Code edits in `#ide-textarea` MUST debounce and update active DOM preview iframes in `< 300ms`.
3. **Closed-Loop Self-Healing Engine:**
   - Standard Error logs from non-zero process exits (`exit code != 0`) MUST automatically forward to the **Debugger Agent** in `.ide-agents-container`.
   - The Debugger Agent MUST generate a patch diff, write it to the local VFS file, and re-trigger execution automatically.

---

## 2. AUTOMATED SELF-VERIFICATION PROTOCOL
Before submitting any task, execute the following verification loop sequentially:

```bash
# Step 1: Syntax check
node --check app.js

# Step 2: Branding purge check
! grep -rnE -i "savage|command center" .

# Step 3: DOM-to-JS Selector Binding Verification
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');
['ide-textarea', 'ide-line-numbers', 'panel-terminal', 'terminal-output', 'terminal-input', 'vfs-tree'].forEach(id => {
  if (!html.includes(id)) throw new Error('Missing DOM element #' + id);
  if (!js.includes(id)) throw new Error('Unbound JS reference #' + id);
});
console.log('DOM & JS IDs 100% synchronized');
"
```
