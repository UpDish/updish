# Upbit-informed UI/UX revision

final result: blocked

## Reference and audit evidence

The user requested research of Upbit image-search results and its actual service, followed by an UpDish UI/UX revision. This supersedes the previous HTML-prototype fidelity target. The earlier passed QA is preserved at `docs/evidence/design/design-qa-original-html.md` and applies only to the previous deployed app.

- Two Google Images queries were browsed across six captured viewports. Captures `01-image-search-pc-top.png` through `06-image-search-mobile-more.png` in `docs/evidence/upbit-research/` show recurring PC/mobile information, navigation and order-entry patterns. This is a sampled visual survey, not an exhaustive crawl of every web image.
- Primary current visual: `docs/evidence/upbit-research/07-upbit-live-exchange.png`, captured from https://www.upbit.com/exchange?code=CRIX.UPBIT.KRW-BTC . It was opened from disk and inspected. Navy navigation, flat white panels, gray gutters, adjacent selected-instrument context and market list are visible. `08-upbit-chart-interaction.png` is a second chart interaction, not an order-panel screenshot. It is not evidence that the order panel was audited.
- Primary interaction documentation: https://support.upbit.com/hc/ko/articles/900005595146 . Price/quantity/total inputs, primary order action and investment-history navigation are described. No trades were placed on Upbit.
- Before, product: `docs/evidence/design/public-home.png`, saved and inspected in the preceding deployment work and opened again during this research. Source capture is 1265×712 content pixels at the prior 1280×720 CSS viewport. It is historical same-day evidence; a new product capture was blocked before navigation completed.
- Before, detail: `docs/evidence/design/public-detail.png`, historical same-day evidence from the preceding deployment.
- Before, wallet: `docs/evidence/upbit-research/09-before-wallet.png`, freshly captured during this research and inspected from disk. Its smaller viewport is not valid for pixel comparison against the desktop exchange reference.
- Structured sources, findings and evidence limits: `docs/evidence/upbit-research/research.json`.
- An unscaled research comparison was composed and opened as `docs/evidence/upbit-research/comparison-before.png`: Upbit 1253×705 pixels on the left, previous UpDish 1265×712 on the right with a 16px separator. It supports the structural audit only; it is not a same-state, normalized comparison of the revised implementation.

## Findings and implemented changes

1. **[P1] The 260px promotional tiles dominate the decision screen.** The before product capture gives a product and two account/merchant shortcuts equal color weight. Replaced these with a selected-product header, contract information and an adjacent directory/order column.
2. **[P1] Information and subscription are split despite there being one product.** Before, the user must open a second screen before seeing the form. The revised workspace keeps conditions, quantity, total and next action together. Calculator/risk tabs preserve the parent quantity.
3. **[P2] Arbitrary red/pink gradients, rounded cards and shadows compete with data.** Replaced the global shell with navy navigation, gray gutters, flat panels, tabular amounts and restrained blue active controls.
4. **[P2] Mobile prioritizes tiles and long navigation labels.** Implemented short task labels, persistent bottom navigation and a direct subscription anchor. Main controls have a 44px mobile target. These remain unverified in a rendered phone viewport.
5. **[P2] Anonymous users see a disabled application and a separate login action.** The revised guest form has one primary login action; signed users retain the three mandatory acknowledgements, quantity/status checks and the existing server-side controls.

Search, status filters, keyboard tabs and quantity presets were implemented as real controls. No price chart, order book, return history or additional restaurants were invented. The UpDish wordmark remains its own editable text; no Upbit brand asset was copied. The selected reference's BTC icon/chart do not represent this product and are intentionally omitted rather than approximated with CSS/SVG artwork.

## Required surfaces and pending comparison

- Typography: compact 11–14px UI, 19px instrument heading, 32px unit amount and a Korean-capable system stack. Exact Upbit font matching is not claimed. Rendering/wrapping requires browser verification.
- Spacing/layout: 60px desktop navy header, 34px notice strip, 10px gutters and 350px order/directory column. Desktop, tablet and 390px mobile still require measured viewport screenshots.
- Colors: navy #093687, active blue #1763b6, neutral background #e9ecf1, flat white panels, restrained semantic badges. Header/bottom-navigation keyboard focus and mobile touch targets were addressed in source; contrast/visual quality still need inspection.
- Assets: no raster artwork is needed for the adapted product/contract surfaces. No fake logo, chart or illustrations were generated.
- Content: real Core offering only, hypothetical calculator clearly labelled, no guaranteed return, no live model/Bojagi claim and no false Upbit verification. Signed roles and wallet/account guards remain unchanged.
- Full-view comparison: pending. No revised app screenshot has been accepted, and no combined source/implementation comparison has been made.
- Focused comparison: pending for header, information table, order inputs and mobile navigation.

## Verification and blocker

Type checking and production build passed during implementation. Local SIWE → BFF → Core → PostgreSQL → live GIWA read passed 12 checks, recorded in `docs/evidence/upbit-research/local-auth-smoke.json`. No user-wallet transaction was submitted. These checks do not prove visual quality.

CUA initially captured the research screenshots, then repeated operations timed out. After a runtime reset, its inventory returned no available browsers and selecting `iab` returned `Browser is not available: iab`. Opening the local preview through Codex returned `queued`. An async question asks whether a separate Playwright verification browser is permitted. That approval has not been received. No Playwright/browser fallback has been used.

The current public deployment remains `dpl_978FarAbNmizLSMmK3WGSD4iAxCs` from app commit `0ff2430a6b35001f97d727a8d4377d2bd4bf02a1`. This revision has not been deployed. Do not mark it visually verified or publish it as complete until browser capture, interaction checks and combined comparison pass.

## Remaining acceptance checks

- Capture actual revised desktop, tablet and 390px mobile screens; measure viewport and document overflow.
- Compare against the current Upbit reference in one combined input; inspect focused readable regions.
- Exercise search/no results, state filters, keyboard tabs, quantity presets, invalid input, calculator scenarios, acknowledgements and login/portfolio/merchant navigation.
- Check console errors and retained login flow; fix actionable P0/P1/P2 issues and recapture.
- Deploy the verified app to the existing Vercel project, then check the canonical public URL and update deployment evidence.
