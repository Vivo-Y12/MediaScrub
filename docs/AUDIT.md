# MediaScrub existing-code audit (2026-11-10)

## Baseline and preservation
- Public repository cloned from `Vivo-Y12/MediaScrub` at `3284058`; `main` was clean, with no local edits. Development is isolated on `development/provenance-and-tools`. No push or deployment authorized.
- Recent history: `3284058` and `176abc5` merge commits, `aa2135d` initial app, `a1f8e3b` original toolkit. `package-lock.json` is committed; no other lockfiles.
- Existing Next 16 App Router + React 19 + TypeScript + Tailwind 4 site, pages `/`, `/image`, `/video`, `/metadata`, `/docs`, `/privacy`, routes `/api/stats` and `/api/health`; PostgreSQL/Drizzle only powers an aggregate counter. Static FFmpeg core is vendored in `/public/ffmpeg`. No upload endpoint, auth, billing or ads.
- Initial checks: `npm ci` succeeded; `npm run typecheck` passed; 16/16 Vitest unit tests passed. `npm run lint` FAILED with 10 existing errors (JSX comments and set-state-in-effect). `npm run build` FAILED without `DATABASE_URL` despite README saying database optional (`src/db/index.ts` throws at import time). Node 20 installed by default; newer tooling needs Node 24.

## Actual implementation, not just README
| Area | Existing behavior | Gaps/risks |
| --- | --- | --- |
| Image | Web Worker pool; TIFF via UTIF, common browser decoders; PNG/JPEG/WebP/AVIF encoder probe; size/quality/ZIP/compare/download | No crop/rotation; animation lost; original format may not encode in worker even if main-thread probe passes; crop/resize always removes embedded provenance; image cancellation merely stops scheduling, not active jobs; worker error rejects unrelated pending jobs; `destroy()` never rejects promises. |
| Video | FFmpeg.wasm local core; batch convert/compress/resize/GIF/audio/frames, real FFmpeg progress, hard cancel, previews/ZIP | No trim; container/codecs aren't universally supported; 2GB cap is not memory guarantee; virtual FS cleanup on failure incomplete; preview unavailable for codecs browser cannot play even if FFmpeg handles file. |
| Metadata | exifr EXIF/XMP/IPTC/ICC/GPS, lightweight MP4/EBML header inspection, JSON report, image pixel re-encode and video stream-copy strip | **No C2PA cryptographic verification**, not a SynthID detector. Video walker only sees top-level `mvhd` (normally nested in `moov`); lack of guard against signed-provenance stripping; `-map_metadata -1` does not guarantee per-stream tags removal; naive 'all metadata stripped' wording misleading. No selective editor. |
| UI | Original responsive dark/light identity, nav, docs, dropzones, states, comparison | No dedicated provenance route; nested interactive elements in metadata file list; existing lint failures. |
| Privacy | Media stays in browser for media workflows; theme in localStorage | Anonymous stats POST after jobs is unnecessary network activity; stats page load GET; Google fonts fetched at build time, not browser runtime. No privacy/network automation at baseline. |
| Security | No media upload endpoint; React escaping; no API requiring user identity | `/api/stats` unprotected counter can be inflated; unbounded request body parse; no CSP/security headers; SVG is parsed as image (not inserted as raw HTML), but untrusted files still consume memory; PostgreSQL optionality broken. |
| Tests | 16 unit tests for helpers/FFmpeg args | No real browser workflow, format, network/privacy or provenance fixture tests; existing lint/build fail. |

## Architecture decision
Retain Next/React/Workers/FFmpeg, not a rewrite. Add the MIT-licensed official `@contentauth/c2pa-web` WebAssembly reader same-origin for C2PA inspection. A C2PA result is not SynthID detection. Do not modify signed manifests; fail closed before any output workflow that would discard credentials. Make database optional or remove the unnecessary stats path. Fix baseline lint/build failures, add real tests, document unsupported cases. The vendored FFmpeg distribution is GPL-2.0-or-later: review distribution obligations before public deployment.

## REA status
REA CLI v6.8.0 was installed transiently via npx; bundled skill installed and `rea doctor --skill` passed under Node 24.22.2. Arena's running agent exposes no REA MCP connector/client integration, so MCP tools cannot honestly be reported as available; restarting this hosted agent is not possible from inside the sandbox. CLI passive research remains an option if a CDP browser is available. Reference analysis uses publicly accessible pages, not proprietary source or watermark circumvention.
