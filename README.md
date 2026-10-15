# SkyCrew

SkyCrew is a cooperative airline simulator built with TanStack Start, React,
Three.js, and Supabase Realtime. Multiplayer rooms support shared play with the
host simulating the aircraft and broadcasting its state.

## Run locally

Use Node.js 22 or newer and npm:

```sh
npm ci --legacy-peer-deps
cp .env.example .env
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` to enable
online rooms. These values are publishable client configuration, not service
role keys. Keep `.env` local and never commit it. Solo play also works without
Supabase.

## Verify

```sh
npm test
npm run build
```

## Deploy from GitHub to Cloudflare Workers

1. In Cloudflare, open **Workers & Pages**, choose **Create application** →
   **Connect to Git**, and select this repository and the `main` branch.
2. Set the build command to `npm run build` and the deploy command to
   `npx nitro deploy --prebuilt`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as build
   environment variables in the Cloudflare project settings so online rooms
   work in production.
4. Deploy. Cloudflare will build and deploy the app on pushes to the connected
   branch.

Never put Supabase service-role keys or the local `.env` file in GitHub.
