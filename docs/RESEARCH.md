# Research, reference inventory and gap analysis

Research date: 2026-11-10. Sources: public [RemoveSynthID home](https://removesynthid.io/) and [pricing](https://removesynthid.io/pricing), official [C2PA browser SDK](https://github.com/contentauth/c2pa-js/tree/main/packages/c2pa-web), official [REA repository](https://github.com/morluto/rea), npm package metadata, and the checked-out MediaScrub source. REA v6.8.0 CLI successfully captured the reference homepage in a bounded Chromium browser scenario (`capture-browser-scenario`, DOM/accessibility/network; no sign-in or upload). A second REA capture produced a screenshot. Passive `analyze-web-bundle` observed 33 public script resources, parsed 32 and found 9 route-pattern candidates; the remaining script hit a per-script deadline, so the inventory is **partial**, and static route strings do not establish live workflows. Its observed navigation was supplemented by the public pricing page. No proprietary assets or private APIs were copied.

## Reference inventory (advertised ≠ independently validated)

| Publicly advertised | Public evidence/qualification | MediaScrub decision |
| --- | --- | --- |
| Image drop/paste; PNG/JPG/WebP; previews; up to 10 images | Home page copy, unverified processing; no uploaded private media used for testing | Independent batch dropzone and preview. No artificial ten-file limit. |
| Video and audio tabs, multi-frame video | Home/pricing copy; $1 trial and premium credits for continued use; 30-second paid video cap | Legitimate local video trim/convert/frame/audio tools; no watermark evasion and no payment. |
| SynthID scan/removal and 0% score | Home page marketing examples, not verified measurements | **Do not reproduce**. SynthID status is explicitly verification unavailable. No fake absence/detection score. |
| C2PA metadata cleanup | Home page claims removal; not a provenance verification feature | Opposite approach: inspect C2PA with official SDK, protect signed records. |
| Browser preview, results and direct downloads | Home/pricing mention free scans/previews, one free removal, image downloads; paid video downloads | Free previews and per-file/ZIP downloads; no account. |
| “No uploads” privacy | Marketing claim. REA browser capture observed requests to third-party origins including Crisp chat, Sentry, Cloudflare Insights and Unsplash assets; this does **not** prove they receive media. | No third-party runtime API/analytics in MediaScrub; locally hosted WASM. Test requests while processing. |
| Compatibility and size limits | Pricing advertises up to 30-second paid video; no complete codec matrix established from public pages | Device-specific browser/FFmpeg restrictions documented, not universal. |

### Comparison matrix

| Reference-facing capability | MediaScrub equivalent | Verified status |
| --- | --- | --- |
| Image scanning | C2PA & metadata image inspector | C2PA signed JPEG + unsigned PNG browser-tested; **not** SynthID detection |
| Video scanning | Video C2PA inspection where SDK supports format | Interface implemented; Signed MP4 with two manifests verified in Chromium; WebM explicitly unsupported |
| Image preview | Local blob preview | Browser-tested |
| Video preview | HTML5 video | Browser-tested with WebM; codec dependent |
| C2PA inspection | Signature/structure validation + manifest/history/assertions | Browser-tested with signed JPEG |
| Image batch upload | Multi-file local selection | Browser-tested with unsigned PNG and signed JPEG in inspection |
| Video processing | FFmpeg.wasm trim/convert/scale/GIF/audio/frames | WebM trim/compress/scale, WebM→MP4, GIF, frames and WAV audio tested; other combinations codec-dependent |
| Download workflow | JSON report, image/video file or ZIP | Browser-tested JSON, image & video downloads; ZIP implementation retained |
| Premium tool access | All implemented tools free | No auth/billing/paywall/ads |

## Architecture choices and licensing

| Candidate | Decision |
| --- | --- |
| Existing Next/React/TypeScript/Tailwind | Retain; current pages and components reused. Next updated to 16.4.6 for security; webpack build required for existing FFmpeg worker URL with this Next version. |
| Official `@contentauth/c2pa-web` | Add lazy-loaded, same-origin 8.7 MB WASM; MIT. Offline signature validation, remote manifest fetch/OCSP disabled. Do not claim offline signer identity trust. |
| Existing FFmpeg.wasm | Retain same-origin 31 MB core; `@ffmpeg/core` distribution GPL-2.0-or-later. Single-threaded and memory-heavy; no universal codec promise. |
| Canvas + OffscreenCanvas worker | Retain for image conversion; add crop/rotate. Always pixel re-encodes, so guard signed C2PA inputs. |
| `exifr` | Retain for read-only metadata. Does **not** validate C2PA signatures. |
| `piexifjs` | Small MIT-licensed dependency for selective JPEG EXIF reconstruction; preserve compressed pixels and other JPEG segments, but block signed C2PA input. |
| WebCodecs | Not chosen as universal video engine: unsupported codecs/browser variation would duplicate FFmpeg and require separate muxers. |
| PostgreSQL counter | Existing optional schema preserved, telemetry disabled, POST closed with 410. Not required for build or user workflows. |
| REA | Investigation aid only. Skill installed and `doctor --skill` healthy; no active Arena MCP client registration or restart is possible in this hosted run. CLI browser capture was successful. |

## Key gaps remaining

- Validated SynthID detector unavailable; do not turn metadata heuristics into watermark claims.
- Browser SDK currently returns UnsupportedType for WebM; no negative C2PA status for WebM. Signed MP4 fixture is tested; MOV/MKV and other formats still need signed-video fixtures and device testing.
- Selective editor handles JPEG EXIF only, not IPTC/XMP/PNG/MP4 deep metadata editing. Multiple EXIF/XMP locations may still reveal location. No promise of universal anonymization.
- Animated GIF/AVIF input handling and codec diversity remain limited to the existing runtime; no HEIC decoder bundled.
- High-memory and cross-browser/mobile performance testing beyond desktop Chromium remains outstanding.
