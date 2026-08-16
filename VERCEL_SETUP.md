# Vercel Deployment Setup

    All serverless functions and vercel.json are committed to this repository.
    To complete the deployment and get a live URL:

    1. Go to https://vercel.com/new
    2. Import `savagnic/savage-command-center-os`
    3. Leave root directory as default (vercel.json is at repo root)
    4. Add these Environment Variables:
     - `SUPABASE_URL` = your Supabase project URL
     - `SUPABASE_ANON_KEY` = your Supabase anon/public key
     - `GITHUB_TOKEN` = (optional) GitHub PAT for the Intel panel
    5. Click Deploy

    ## Serverless Functions
    - `/api/organism-status` — GET/PUT agent status (Supabase)
    - `/api/decisions` — GET/POST decision log (Supabase)
    - `/api/connections/test` — POST credential validation
    - `/api/github/intel` — GET live GitHub activity feed
    