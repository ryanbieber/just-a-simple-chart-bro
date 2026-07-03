# just-a-simple-chart-bro

React + Vite dashboard for comparing coding-focused hosted and local LLM economics on GitHub Pages.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run data:update`

## Data model

- `src/data/model-manifest.json`
  Curated refresh manifest. Hosted entries define pricing and SWE-bench selectors. Local entries keep manual hardware assumptions plus benchmark selectors.
- `src/data/dashboard-data.json`
  Generated data shipped to the frontend.

## Refresh flow

`npm run data:update` will:

- refresh hosted pricing from official OpenAI and Anthropic pages,
- refresh SWE-bench Verified scores from the official leaderboard payload,
- preserve curated local hardware costs and throughput assumptions,
- regenerate `src/data/dashboard-data.json`.

## GitHub Pages

`vite.config.ts` uses the package name as the build base path so the app can be deployed to GitHub Project Pages.

The repo now includes `.github/workflows/deploy-pages.yml`, which builds and deploys automatically on pushes to `main`.

The build also writes `dist/404.html` from `dist/index.html` so GitHub Pages serves the app correctly for direct deep links.

Current published target: `https://ryanbieber.github.io/just-a-simple-chart-bro/`
