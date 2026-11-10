# Development and self-hosting

MediaScrub is a Next.js browser-first app. This page is for developers and self-hosters; the [README](../README.md) is for people using the app.

## Requirements and local setup

Use Node.js 24 (minimum 22.12) and npm. No database, account, or API key is required.

```bash
git clone https://github.com/Vivo-Y12/MediaScrub.git
cd MediaScrub
npm ci
npm run dev
```

Open http://localhost:3000. Serve publicly over HTTPS; `localhost` is suitable for development.

## Checks and production build

```bash
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
npm run start
```

Keep `npm run dev` running in a separate terminal before `npm run test:e2e`, or build and start the production app first. `npm run start` serves the production build. The dev and build scripts use webpack because FFmpeg's worker URL does not currently resolve in Next.js Turbopack.

## Deployment notes

- Serve `/c2pa/c2pa_bg.wasm` and `/ffmpeg/ffmpeg-core.{js,wasm}` from the app's origin. Browser workers, blob URLs, and WASM must be allowed by your headers. The production config includes a same-origin CSP and baseline security headers; adjust carefully for your environment.
- Media processing does not need a backend, third-party media API, or `DATABASE_URL`. The legacy stats POST route is disabled. Do not introduce uploads or analytics without revisiting the privacy guarantees.
- Account for CPU and browser memory limits. Hosting should provide TLS and appropriate public-server controls. The bundled FFmpeg core has GPL-2.0-or-later distribution obligations; review licensing before redistribution.
- C2PA verification deliberately disables remote-manifest and OCSP fetches and does not check signer trust. Do not describe this as SynthID detection or universal provenance verification.

For architecture and test details, see the [code audit](AUDIT.md), [reference research](RESEARCH.md), and [quality and security report](QUALITY.md).
