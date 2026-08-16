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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    if (req.method === "GET") {
      const r = await sb("/organism_status?order=id.asc&limit=1");
      const rows = await r.json();
      if (!rows.length) {
        // Seed default row
        const ins = await sb("/organism_status", {
          method: "POST",
          body: JSON.stringify({ status: "LIVE", health: "99.9%", active_agents: 3, entropy_index: 0.034, revenue_signal: 3.14 }),
        });
        const row = (await ins.json())[0];
        return res.json({ status: row.status, health: row.health, active_agents: row.active_agents, entropy_index: row.entropy_index, revenue_signal: row.revenue_signal });
      }
      const row = rows[0];
      return res.json({ status: row.status, health: row.health, active_agents: row.active_agents, entropy_index: row.entropy_index, revenue_signal: row.revenue_signal });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const patch = {};
      if (body.status !== undefined) patch.status = body.status;
      if (body.health !== undefined) patch.health = body.health;
      if (body.active_agents !== undefined) patch.active_agents = body.active_agents;
      if (body.entropy_index !== undefined) patch.entropy_index = body.entropy_index;
      if (body.revenue_signal !== undefined) patch.revenue_signal = body.revenue_signal;
      const r = await sb("/organism_status?id=eq.1", { method: "PATCH", body: JSON.stringify(patch) });
      const rows = await r.json();
      const row = rows[0] || {};
      return res.json({ status: row.status, health: row.health, active_agents: row.active_agents, entropy_index: row.entropy_index, revenue_signal: row.revenue_signal });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
