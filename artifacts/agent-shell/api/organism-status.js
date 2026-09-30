// Supabase REST API — no pg driver needed, uses fetch + anon key
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const FIELDS = ["status", "health", "active_agents", "entropy_index", "revenue_signal"];

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

function present(row) {
  const out = {};
  for (const f of FIELDS) out[f] = row[f];
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    if (req.method === "GET") {
      const r = await sb("/organism_status?order=id.asc&limit=1");
      const rows = await r.json();
      if (!Array.isArray(rows) || !rows.length) {
        // No fabricated fallback: organism status is computed by the organism
        // itself and written here via PUT. Until a real row exists, say so.
        return res.status(503).json({
          error: "organism status not computed",
          computed: false,
          detail:
            "No organism_status row exists yet. Real metrics appear only after the organism computes and writes them via PUT /api/organism-status.",
        });
      }
      return res.json(present(rows[0]));
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const patch = {};
      for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f];
      if (!Object.keys(patch).length) {
        return res
          .status(400)
          .json({ error: `empty patch: provide at least one of ${FIELDS.join(", ")}` });
      }
      const r = await sb("/organism_status?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        return res
          .status(502)
          .json({ error: "failed to update organism_status", detail: await r.text() });
      }
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) return res.json(present(rows[0]));
      // Singleton row absent — create it from the caller's real values so the
      // table only ever holds metrics that were actually reported.
      const ins = await sb("/organism_status", {
        method: "POST",
        body: JSON.stringify(patch),
      });
      if (!ins.ok) {
        return res
          .status(502)
          .json({ error: "failed to create organism_status row", detail: await ins.text() });
      }
      const created = await ins.json();
      return res.json(present((Array.isArray(created) && created[0]) || patch));
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
