// GET /api/github/intel
// Returns GitHub user profile, recent commits, and repos.
// Requires GITHUB_TOKEN env var set on Vercel.

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'savage-command-center-os';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'savagnic';

function ghFetch(path) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Sovereign-Agent-Shell',
  };
  if (GITHUB_TOKEN) headers.Authorization = `token ${GITHUB_TOKEN}`;
  return fetch(`https://api.github.com${path}`, { headers });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = {};

    // Fetch user profile
    if (GITHUB_TOKEN) {
      const userResp = await ghFetch('/user');
      if (userResp.ok) {
        const u = await userResp.json();
        payload.user = {
          login: u.login,
          name: u.name,
          avatar_url: u.avatar_url,
          public_repos: u.public_repos,
          followers: u.followers,
          following: u.following,
        };
      }
    }

    // Fetch recent commits from the configured repo
    try {
      const commitsResp = await ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=10`);
      if (commitsResp.ok) {
        const commits = await commitsResp.json();
        payload.repo = `${GITHUB_OWNER}/${GITHUB_REPO}`;
        payload.commits = (commits || []).slice(0, 10).map(c => ({
          sha: c.sha ? c.sha.slice(0, 7) : '',
          message: c.commit?.message?.split('\n')[0] || '',
          author: c.commit?.author?.name || c.author?.login || 'unknown',
          date: c.commit?.author?.date || null,
        }));
      }
    } catch (_) {
      // repo might not be accessible, skip silently
    }

    // Fetch public repos only — never expose private repo metadata via an unauthenticated endpoint
    const reposResp = await ghFetch(`/users/${GITHUB_OWNER}/repos?sort=pushed&per_page=20&type=public`);
    if (reposResp.ok) {
      const repos = await reposResp.json();
      payload.repos = (repos || []).slice(0, 10).map(r => ({
        name: r.name,
        full_name: r.full_name,
        language: r.language,
        stargazers_count: r.stargazers_count,
        pushed_at: r.pushed_at,
      }));
    }

    // Public fallback for commits: fetch public events for the owner
    if (!payload.commits) {
      try {
        const eventsResp = await ghFetch(`/users/${GITHUB_OWNER}/events/public?per_page=10`);
        if (eventsResp.ok) {
          const events = await eventsResp.json();
          const pushEvents = (events || []).filter(e => e.type === 'PushEvent').slice(0, 5);
          if (pushEvents.length) {
            payload.commits = pushEvents.flatMap(e =>
              (e.payload?.commits || []).map(c => ({
                sha: c.sha ? c.sha.slice(0, 7) : '',
                message: c.message?.split('\n')[0] || '',
                author: e.actor?.login || 'unknown',
                date: e.created_at || null,
              }))
            ).slice(0, 10);
            payload.repo = pushEvents[0]?.repo?.name || `${GITHUB_OWNER}/${GITHUB_REPO}`;
          }
        }
      } catch (_) {}
    }

    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
