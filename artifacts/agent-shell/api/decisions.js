// Supabase REST API — no pg driver needed, uses fetch + anon key
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function sb(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    if (req.method === "GET") {
      const r = await sb("/decisions?order=created_at.desc&limit=100");
      const rows = await r.json();
      return res.json((rows || []).map(r => ({
        id: r.id, title: r.title, timestamp: r.created_at,
        accepted: r.accepted, context: r.context,
        outcome: r.outcome ?? null, proof_hash: r.proof_hash ?? null,
        replay_verdict: r.replay_verdict ?? null,
      })));
    }

    if (req.method === "POST") {
      const { title, context, accepted, outcome, proof_hash, replay_verdict, agent_name } = req.body || {};
      if (!title || context === undefined || accepted === undefined) {
        return res.status(400).json({ error: "title, context, and accepted are required" });
      }
      const r = await sb("/decisions", {
        method: "POST",
        body: JSON.stringify({ title, context, accepted, outcome: outcome ?? null, proof_hash: proof_hash ?? null, replay_verdict: replay_verdict ?? null, agent_name: agent_name ?? null }),
      });
      const rows = await r.json();
      const row = rows[0];
      return res.status(201).json({
        id: row.id, title: row.title, timestamp: row.created_at,
        accepted: row.accepted, context: row.context,
        outcome: row.outcome ?? null, proof_hash: row.proof_hash ?? null,
        replay_verdict: row.replay_verdict ?? null,
      });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
