# Verification, security and deployment readiness

Snapshot: 2026-11-10, branch `main`; this responsive-compatibility pass is local until explicitly pushed. Baseline audit: [AUDIT.md](AUDIT.md). Reference inventory: [RESEARCH.md](RESEARCH.md).

## Verification matrix

| Workflow | Verification | Status |
| --- | --- | --- |
| Responsive navigation / mobile menu / theme | 7 routes × 320/390/768/1024/1280px in Chromium, Firefox and WebKit; menu links, horizontal overflow and visible theme control; Chromium/WebKit touch emulations for iPhone 13 and iPad Mini | Pass: tablet desktop-nav overflow fixed by moving desktop breakpoint to 1280px; emulators are not physical hardware |
| Unsigned PNG C2PA inspection | Real unsigned PNG through official local WASM reader | Pass: *not detected by supported C2PA reader*, no SynthID claim |
| C2PA and private metadata sections | Provenance inspection and JPEG privacy tool remain distinct; no external SynthID handoff | Pass: section headings, no external detector link, no cross-origin requests/POSTs during local scan |
| Signed C2PA inspection | c2pa-rs signed `CA.jpg` and `video1.mp4` fixtures; active manifest/signature state/history/assertions rendered | Pass: both `Valid`, signer trust **not** checked; JSON export works |
| Signed-provenance preservation | Signed JPEG into Image Studio and Metadata stripping; signed MP4 into Video Lab; both renamed `.webm` to test extension/MIME spoofing | Pass: processing blocked, originals unmodified; signed MP4 still verifies by content |
| Image resize/crop/rotate/convert | Real 160×120 PNG; 50% × 50% crop + 90° turn in Chromium; phone/tablet PNG processing and download in Chromium/Firefox/WebKit | Pass: 60×80 WebP output in Chromium; PNG export in three desktop browser engines; native keyboard-focusable format radios |
| Batch images / comparison / ZIP | PNG + JPEG converted and ZIP opened in test; 8-file batch regression across Chromium/Firefox/WebKit | Pass: two real WebP files in ZIP; bounded provenance reads/jobs (3 concurrent) and all 8 batch entries finish |
| Batch video ZIP duplicate names | Two WebM inputs named identically; inspect MP4 entries in downloaded ZIP | Pass: both outputs retained with unique names |
| Metadata viewer/report | JPEG EXIF inspection and JSON report | Pass |
| Selective JPEG EXIF editor | Real GPS + serial fixture; edit artist, remove GPS/serial; parse downloaded JPEG with exifr | Pass: GPS and serial absent in output, artist present; XMP/IPTC not guaranteed |
| Video trim | Browser-recorded VP8 WebM (~1.7 s), trim to 0.7 s with FFmpeg.wasm | Pass: real output downloaded; exact frame/duration fidelity not asserted |
| Video frame extraction | VP8 WebM → ZIP containing JPEG frames | Pass |
| Video convert/compress/scale/GIF/audio | Real browser-recorded VP8/Opus WebM input: MP4 conversion, VP8 compression, 640px resize, GIF output, WAV audio extraction | Pass in Chromium for these samples; other codec/container combinations are conditional |
| Unsigned video metadata remux | WebM stream-copy output downloaded, header checked; failure/read-error cleanup unit-tested | Pass; metadata removal is best-effort, not universal |
| Network privacy | Playwright checks no POST while processing image, video and provenance; checks no cross-origin requests on signed C2PA scan | Pass in Chromium production server; no blanket proof for all browsers/extensions |
| Errors/cancellation | Worker cancellation/crash isolation unit-tested; image Stop/retry and video Cancel/retry browser-tested; impossible and out-of-duration trim bounds tested | Pass for tested paths; stale runs cannot publish a result after a retry; mobile memory pressure remains untested |
| Build & static checks | Next 16.4.6 webpack production build; `tsc --noEmit`; ESLint; Vitest | Pass: 29 unit tests, 35 Chromium workflows + 1 Chromium touch regression, 7 Firefox responsive workflows, 7 WebKit responsive workflows + 1 WebKit touch regression |

## Security review

- Public `npm audit --omit=dev` after security patch: **0 critical/high/moderate**, **1 low** (esbuild advisory relating to Windows development servers). Earlier Next 16.2.6 tree had critical/high advisories; upgraded to 16.4.6 and updated PostCSS/sharp transitive dependencies. Audit findings change over time: rerun before deployment.
- React escapes manifest strings; active assertion data is rendered as text, not injected HTML. Untrusted JSON reports are downloaded, not executed. The local SVG decoding path should still be threat-modelled when accepting untrusted SVGs.
- Media is never posted to an app backend. API routes: `/api/health` and legacy `/api/stats`; legacy POST is now `410 Gone`, GET is read-only and unused by UI; database is optional. No login, cookies, payment, server-side media storage or ads.
- C2PA reader is the official MIT SDK with same-origin vendored WASM. `verifyTrust:false`, `remoteManifestFetch:false` and `ocspFetch:false` are explicit privacy choices; a structurally valid/signed manifest is not automatically a trusted identity. Missing data ≠ human origin, unsupported WebM ≠ no provenance.
- No external SynthID handoff or in-app detector. The provenance page inspects C2PA locally and does not treat missing Content Credentials as evidence of a missing watermark.
- Signed C2PA files are blocked before canvas re-encoding, remux or EXIF edits; invalid/unavailable inspection fails closed for supported formats. Because the official SDK rejects WebM as UnsupportedType, only files with a verified WebM header are allowed through that exception **with an explicit unsupported-provenance limitation**; cannot promise preservation of non-C2PA WebM container tags.
- Private JPEG editor rebuilds EXIF but does not promise removal of XMP/IPTC/other locations. When no signed manifest is present, image/video processing may remove ordinary metadata. Originals stay in browser memory until cleared/closed. Browser heap/FFmpeg memory are not unlimited.
- Production sets a same-origin CSP allowing local blob workers and WASM, plus MIME-sniff, referrer and permissions headers. Next's inline boot scripts still require `'unsafe-inline'` in the current CSP; a nonce-based policy would be tighter. Public deployment still needs TLS, request ceilings and rate limiting if APIs expand. Do not add arbitrary `Access-Control-Allow-Origin` to future media endpoints.
- Do not publish original screenshots/media fixtures as production user data. The test fixtures in `e2e/fixtures` are generated synthetic files except signed `CA.jpg` and `video1.mp4` copied from c2pa-rs public test fixtures; review that repository's fixture licensing before redistribution.
- Never commit tokens or other credentials. Use short-lived authentication outside the repository.

## Privacy test instructions

Run `npm run build && npm run start`, then `npm run test:e2e`; use DevTools Network while scanning or processing. Initial page/worker/WASM GET requests are expected to the site origin. No media, filenames or reports should appear in request bodies. First-time engine activation requires same-origin asset fetches; going offline **before** the lazy WASM/worker has loaded can cause a local verification/processing failure. Offline testing should warm the relevant engine first. Reopen DevTools to inspect the optional theme localStorage entry.

## Remaining gaps

A production-complete device/codec matrix still needs physical iOS/Android phones, tablets, low-memory PCs, older Safari/Firefox releases, and more signed MOV/MKV fixtures; current WebKit/Firefox checks ran in Linux browser engines, not on physical Apple hardware. In headless Firefox, individual WebP exports may open a preview instead of emitting an automated download event; PNG exports and ZIP batches passed. Browser video metadata probing now times out after 10 seconds rather than holding the queue indefinitely. The signed MP4 workflow above is tested. Browser-recorded WebM may have no readable duration: FFmpeg can return a shorter clip than the requested trim range, so the UI warns users to verify it. Tested workflows are listed above, not invented. No local/public embeddable SynthID detector is bundled, and 100% detection cannot be guaranteed. No selective XMP/IPTC/video tag editor; no HEIC reader; animated GIF input is first-frame only. Very large videos may exhaust memory below the 2 GB input ceiling. WebM C2PA is unsupported, not negative. Processed media can still carry other AI-origin signals; the tool does not remove or evade them. FFmpeg virtual filesystem cleanup occurs on success and failure in video and metadata paths; video unmount now terminates its worker and image/video runs use generation checks to prevent stale updates after cancellation; high-memory interruption beyond the tested clip remains a risk. Continue hardening before high-volume public deployment.

## Deployment checks

Node 24, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, then run `npm run start` with HTTPS termination. Host the vendored WASM files on the same origin. See [development and deployment notes](DEVELOPMENT.md) for GPL distribution guidance and [README](../README.md) for user-facing limits. This compatibility pass is local; no push or external deployment was performed for this pass.
