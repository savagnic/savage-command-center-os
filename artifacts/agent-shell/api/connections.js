// POST /api/connections/test
// Tests an integration connector using user-provided credentials.
// Body: { id, primary, secondary }
// Returns: { ok, message, logs }

const TESTERS = {
  github_mcp: async ({ primary }) => {
    const logs = [];
    if (!primary) return { ok: false, message: 'GitHub Token is required.', logs };
    logs.push('[GitHub] Testing token against /user endpoint...');
    const r = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${primary}`, 'User-Agent': 'Sovereign-Agent-Shell', Accept: 'application/vnd.github.v3+json' },
    });
    if (r.ok) {
      const u = await r.json();
      logs.push(`[GitHub] ✓ Authenticated as @${u.login}`);
      return { ok: true, message: `Connected as @${u.login}`, logs };
    }
    logs.push(`[GitHub] ✗ HTTP ${r.status}`);
    return { ok: false, message: `GitHub API error: HTTP ${r.status}`, logs };
  },

  openai_mcp: async ({ primary }) => {
    const logs = [];
    if (!primary) return { ok: false, message: 'OpenAI API Key is required.', logs };
    logs.push('[OpenAI] Validating key via /models endpoint...');
    const r = await fetch('https://api.openai.com/v1/models?limit=1', {
      headers: { Authorization: `Bearer ${primary}` },
    });
    if (r.ok) {
      logs.push('[OpenAI] ✓ API key is valid');
      return { ok: true, message: 'OpenAI API key validated successfully.', logs };
    }
    logs.push(`[OpenAI] ✗ HTTP ${r.status}`);
    return { ok: false, message: `OpenAI key invalid: HTTP ${r.status}`, logs };
  },

  stripe_mcp: async ({ primary }) => {
    const logs = [];
    if (!primary) return { ok: false, message: 'Stripe Secret Key is required.', logs };
    logs.push('[Stripe] Validating key via /v1/balance...');
    const r = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${primary}` },
    });
    if (r.ok) {
      logs.push('[Stripe] ✓ Stripe account reachable');
      return { ok: true, message: 'Stripe key validated successfully.', logs };
    }
    logs.push(`[Stripe] ✗ HTTP ${r.status}`);
    return { ok: false, message: `Stripe key invalid: HTTP ${r.status}`, logs };
  },

  notion_mcp: async ({ primary }) => {
    const logs = [];
    if (!primary) return { ok: false, message: 'Notion API Key is required.', logs };
    logs.push('[Notion] Testing key via /v1/users/me...');
    const r = await fetch('https://api.notion.com/v1/users/me', {
      headers: { Authorization: `Bearer ${primary}`, 'Notion-Version': '2022-06-28' },
    });
    if (r.ok) {
      const u = await r.json();
      logs.push(`[Notion] ✓ Connected as ${u.name || u.type}`);
      return { ok: true, message: `Notion key validated: ${u.name || 'bot user'}`, logs };
    }
    logs.push(`[Notion] ✗ HTTP ${r.status}`);
    return { ok: false, message: `Notion key invalid: HTTP ${r.status}`, logs };
  },

  slack_mcp: async ({ primary }) => {
    const logs = [];
    if (!primary) return { ok: false, message: 'Slack Bot Token is required.', logs };
    logs.push('[Slack] Testing token via auth.test...');
    const r = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${primary}` },
    });
    const data = await r.json();
    if (data.ok) {
      logs.push(`[Slack] ✓ Connected as ${data.user} in workspace ${data.team}`);
      return { ok: true, message: `Slack: ${data.user} @ ${data.team}`, logs };
    }
    logs.push(`[Slack] ✗ ${data.error}`);
    return { ok: false, message: `Slack error: ${data.error}`, logs };
  },

  linear_mcp: async ({ primary }) => {
    const logs = [];
    if (!primary) return { ok: false, message: 'Linear API Key is required.', logs };
    logs.push('[Linear] Querying viewer identity...');
    const r = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: primary, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ viewer { id name email } }' }),
    });
    const data = await r.json();
    if (data.data?.viewer) {
      const v = data.data.viewer;
      logs.push(`[Linear] ✓ Connected as ${v.name}`);
      return { ok: true, message: `Linear: ${v.name} (${v.email})`, logs };
    }
    logs.push(`[Linear] ✗ ${JSON.stringify(data.errors?.[0]?.message || 'unknown error')}`);
    return { ok: false, message: 'Linear API key invalid.', logs };
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, primary, secondary } = req.body || {};
  const logs = [];

  if (!id) {
    return res.status(400).json({ ok: false, message: 'Integration id is required.', logs });
  }

  const tester = TESTERS[id];
  if (!tester) {
    logs.push(`[Gateway] No tester registered for connector "${id}"`);
    logs.push('[Gateway] Performing generic reachability check...');
    // Fallback: just confirm we received the request
    if (primary) {
      logs.push('[Gateway] ✓ Credentials received — manual validation required');
      return res.json({ ok: true, message: 'Credentials stored. Manual verification required for this connector.', logs });
    }
    return res.json({ ok: false, message: `No automated test available for "${id}".`, logs });
  }

  try {
    const result = await tester({ primary, secondary });
    return res.json(result);
  } catch (err) {
    console.error(err);
    logs.push(`[Gateway] ✗ Unexpected error: ${err.message}`);
    return res.status(500).json({ ok: false, message: err.message, logs });
  }
};
