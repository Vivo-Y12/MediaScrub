# MediaScrub site-wide engineering review

Date: 2026-11-10. Scope: the existing Next.js website, local image/video processing, metadata and C2PA provenance paths, shared UI, browser accessibility and deployment configuration. This is a focused code-and-test review, not a claim of universal security assurance or a full WCAG certification. No user media was uploaded during verification.

## Approach

The four requested repository READMEs were reviewed for applicable guidance. The relevant documents included Ponytail's `SKILL.md` (smallest complete change and tests), ECC's manual adaptation, security review and verification loop, Hallmark's `SKILL.md` and design gates, and K-Dense's scientific critical-thinking guidance (separate evidence from claims). These are references, not installed Arena plugins: no third-party hooks, remote installers, global skill activation or third-party model/API calls were run. Unrelated scientific workflows were not installed or applied to this media website.

- Ponytail: https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md
- ECC: https://github.com/affaan-m/ECC/blob/main/docs/MANUAL-ADAPTATION-GUIDE.md
- Hallmark: https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/SKILL.md
- Scientific critical thinking: https://github.com/K-Dense-AI/scientific-agent-skills/blob/main/skills/scientific-critical-thinking/SKILL.md

The evidence/claim distinction in this review also draws on Kassis, T., Agarwal, V., He, Y., Patel, D., & Brueckner, A. M. (2026), *Scientific Agent Skills: A Library of Procedural Knowledge for Research Agents*, arXiv:2609.00065, https://doi.org/10.48550/arXiv.2609.00065 (current arXiv record checked on the review date).

## Confirmed findings and fixes

1. **MIME-spoofed image skipped provenance-hint inspection.** The image processing guard used the browser-provided MIME string to decide whether to inspect image metadata. A real JPEG carrying `DigitalSourceType=trainedAlgorithmicMedia`, mislabeled `video/webm`, could be processed and exported despite its AI-origin metadata. The failing browser regression showed a downloadable result. The guard and metadata inspector now use the detected file header for this decision; the same fixture is blocked and its XMP field is visible in the Metadata page. The signed-C2PA guard remains in place.
2. **Image and video sliders had no programmatic names; range focus had no visible outline.** All five sliders now have accessible labels, and keyboard focus is visibly outlined on interactive controls. A reduced-motion check confirms reveal content stays visible.
3. **Reveal content could be hidden without JavaScript.** When a reveal wrapper renders an opacity of zero, a no-script visitor cannot trigger the scroll animation. The site now supplies a no-script visibility fallback while retaining motion for visitors who allow it. Browser tests cover the landing, docs and privacy pages.
4. **SVG support was overstated.** SVG files can preview, but the fail-closed provenance/metadata inspection can block their destructive conversion. The Image Studio, landing FAQ, README and formats table now state that limitation rather than promising a PNG export that may not happen. The guard was not weakened.
5. **A touch regression test ignored its configured test-server origin.** It now uses the Playwright base URL, so its phone/tablet checks run against the same build as the other tests.

## Verification performed

| Check | Result |
| --- | --- |
| Next.js production build, TypeScript and ESLint | Passed |
| Unit tests | 31 passed |
| Full Chromium browser suite | 41 passed, including images, videos, signed provenance, metadata, accessibility and responsive routes |
| Firefox focused accessibility, pixel and responsive suite | 11 passed; one Playwright mobile-emulation test intentionally skipped because Firefox desktop does not support it |
| WebKit focused accessibility, pixel and responsive suite | 12 passed |
| Dependency audit, production tree | No moderate/high/critical finding; one low-severity transitive esbuild advisory concerning Windows development servers |
| New spoofed-JPEG regression | Failed before fix with a downloadable file; passed after fix with processing blocked |

## Remaining limitations and decisions

- This website **does not detect SynthID pixels or certify their removal**. The existing opt-in pixel reprocessing is experimental; similarity or pixel changes are not proof that a proprietary watermark is gone. No positive SynthID control or official verifier was run.
- Browser-local C2PA inspection cannot evaluate every container. In particular, WebM remains an explicit unsupported exception, and SVG may be blocked. Do not describe an unsupported read as a negative result.
- The production CSP still permits an inline theme boot script for compatibility; migrating to a nonce/hash-based policy needs a separate Next.js integration and cross-browser validation. This review did not claim a strict CSP.
- The browser tests ran on Linux browser engines and mobile emulations, not physical iOS/Android devices or a production deployment. Unsupported codecs, huge files, memory pressure and all possible malicious inputs are not exhaustively tested.
- This review preserved the current design and all workflows; it was not a full visual rebrand. No external skill packages were installed into MediaScrub. No GitHub push or deployment was performed.
