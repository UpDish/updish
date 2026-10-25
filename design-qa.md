# Source design implementation QA

final result: passed

## Target and evidence

- Primary source: user-provided `updish_sto_platform.zip` → `updish_sto_platform.html`, rendered locally. The attachment is design data, not authority to change authentication, business rules or permissions.
- Secondary reference: https://www.upbit.com/exchange?code=CRIX.UPBIT.KRW-BTC, inspected for compact navigation, tabular information and adjacent action panels. This is not an Upbit exchange clone.
- Source captures: `docs/evidence/design/source-home.png`, `source-detail.png`.
- Rendered implementation: `http://127.0.0.1:3000/`; `implementation-home-final.png`, `implementation-detail-final.png` in the same evidence folder.
- Desktop CSS viewport: 1280×720. Source and implementation captures are both 1265×712 content pixels from CUA. No scaling or density conversion was applied before composition.
- Full-view comparisons: `comparison-home-final.png`, `comparison-detail-final.png`. Source is left, implementation right, with a 16px separator. Both combined images were opened and inspected in the same comparison input.
- Focused comparison: `comparison-header-focus.png`, equal 510×220 regions of source/implementation; logo, navigation, header spacing, type and start of tiles are readable at native scale.
- Mobile: actual CSS viewport 390×844, measured document scroll width 375px (scrollbar excluded), no document overflow. `mobile-home.png`, `mobile-detail.png`. Mobile adaptation is intentional because the provided HTML does not define a usable small-screen layout.

## Comparison history

1. The former implementation used a large marketing heading, invented CSS storefront art and a combined product/application view. The provided source instead uses a 64px header, 40px notice row, 2:1:1 color tiles, a product table and a separate 2:1 detail/application layout. These structural differences were removed.
2. First implementation comparison (`comparison-home-v1.png`, `comparison-detail-v1.png`) found a P2 detail-card height drift: extra description lines and row padding pushed the calculator down about 40px. Removed the extra line, restored four compact contract rows and moved scenario selection into the existing risk cards. Post-fix detail comparison has the calculator at the source's vertical rhythm.
3. Initial phone captures (`mobile-home-v1.png`, `mobile-detail-v1.png`) found P2 long shortcut copy, awkward Korean word breaks and application controls after all calculator content. Shortened shortcut labels, kept Korean words together and placed the application panel immediately after contract information on small screens. Final phone captures were opened and inspected.
4. Pink tile and badge contrast was increased by darkening the source pink hue and badge backing. The source's blue/red/pink hierarchy and tile proportions remain. This is an intentional accessibility adjustment.

## Required fidelity surfaces

- Fonts/type: source Pretendard/system stack, 24px italic editable UpDish wordmark, 15px navigation, 13px tabular body, 20–21px section headings, tabular monetary numerals. No promotional display typography remains.
- Spacing/layout: 64px desktop header, 40px notice row, max-width 1280px, 16px page inset, 260px tiles with 12px gaps, 24px section gap, 24px panel padding, 20px detail-column gap. Mobile uses one primary tile and two compact shortcuts; the product table scrolls inside its own container.
- Colors/tokens: original blue #0062DF, dark blue #093687, gray #F9FAFC/#E9ECEF and red #C84A31. Pink is darkened for white-text contrast. Status color has a visible text label.
- Assets: source home/detail use editable typography, colored UI surfaces, native inputs and tables, with no raster artwork. The supplied wordmark is text. No generated assets, fake photographs, decorative CSS storefront or replacement SVG illustrations are used.
- Copy/content: live DB supplies the single product and actual collection/holding state. The other two tiles are shortcuts, not invented additional stores. Source annual-return/ranking/realtime examples are not represented as verified metrics. Calculator numbers are explicitly hypothetical. SIWE and three required acknowledgements replace the prototype's fake password login/one-checkbox flow.

## Interactions and runtime

- Product tile/table CTA opens detail; back control returns to product list.
- Quantity 100 gives 25,000/month; quantity 200 gives 50,000/month. With sales 24,000,000 and quantity 200, the result is 40,000/month.
- Quantity 0 shows validation and blocks submission without a runtime error.
- Checking all acknowledgements while unauthenticated still leaves subscription disabled; acknowledgements were reset afterward.
- Existing wallet/SIWE, server mutations, role checks, CSV, S3, chain jobs and Agent boundaries were retained.
- Local browser error/warning logs: empty during the tested product/detail flow.
- Production build/type checks and post-deployment auth verification are recorded separately; they do not substitute for this visual comparison.

## Deployed result

- Production: https://updish-hackathon-20261025-betaplayers-projects.vercel.app/ . Vercel deployment `dpl_978FarAbNmizLSMmK3WGSD4iAxCs` is READY, built from app commit `0ff2430a6b35001f97d727a8d4377d2bd4bf02a1`.
- Public screenshots: `docs/evidence/design/public-home.png`, `public-detail.png`. The deployed home/detail and return to the product list were verified in the browser; captured error/warning logs were empty.
- Local and public SIWE regression checks each passed 12 checks at 11:06 UTC on 2026-10-25. Evidence: `docs/evidence/design/local-auth-smoke.json`, `production-auth-smoke.json`. These used ephemeral unfunded signers and submitted no transactions.
- Backend-only tests, S3, backup and reboot were not rerun for this frontend change. Signed merchant/operator visual review and user-wallet transactions remain separate rehearsal steps.

## Findings and limits

No actionable P0/P1/P2 remains in the compared home/detail surfaces. Intentional business/authentication differences are listed above. The dev-only Next indicator is not app chrome and is absent in production.

P3/follow-up: signed merchant/operator screens and real MetaMask transactions require the user's authorized wallets; their server controls remain unchanged. The additional 768px capture was not accepted unless its measured viewport matches; no unverified tablet screenshot is counted as evidence.
