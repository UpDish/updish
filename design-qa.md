# Upbit-informed UI/UX and service-flow verification

final result: passed — Upbit visual revision, local production build; public release identity is recorded separately

## Latest visual acceptance — 2026-10-31

The user's visual mismatch report supersedes the previous v0.3 visual acceptance. The former checks established functional flow, not sufficient Upbit fidelity. The actual Upbit exchange was recaptured in the user's Whale browser for this revision. Its 60px / #003597 header, Roboto / Noto Sans KR fonts, flat surfaces and adjacent market/chart layout ground the changes.

The current revision makes discovery compact, keeps a searchable market list alongside the detail chart and order action, and provides a fixed mobile investment action. The source switch, exact amounts and original CSV remain accessible without crowding the chart. Native order dialogs and the IDE chat remain functional. Combined inspection of actual source and rendered captures was followed by desktop/mobile review. These are structural and visual adaptations; this is not a pixel-identical copy or Upbit account integration.

39 production-browser checks passed against isolated local Core/PostgreSQL at 1440, 768, 390 and 360px, including sorting/filtering/search, list selection persistence, reference/approved sales distinction, order risk gating/focus return, mobile fixed action, investment navigation, separate role consoles and desktop/mobile chat. Next build passed. See [the focused report and screenshots](docs/upbit-ui-revision.md) and [machine-readable results](docs/evidence/upbit-ui-20261031/browser-checks.json). No new user GIWA transaction or live order submission was part of this visual check.

## Current acceptance — 2026-10-31 presentation v0.3

Actual official Upbit mobile staking list → amount → confirmation → history screens were compared with the rendered UpDish project list, staged order and receipt history. The private 69-image research atlas was inspected; neither it nor the team deck is republished here. See [design decisions](docs/presentation-v03.md).

The current build uses two investor tabs, expansion-purpose detail, separately labelled first-store reference and second-store approved sales, task dialogs, a separate operations console and a right chat sidebar. Receipt history leads the distribution tab; detailed mock KRW calculations are collapsed. Same-store historical runs do not inflate the store count. The standard wallet picker temporarily owns the top layer, and returning sessions show a loading state while restoring their wallet.

24 local production-browser checks passed across 1440×900 and 390×844. This includes real isolated-wallet SIWE, 1M/100-unit order and risk consent, separate review/approval, four contract deployments, exact allowance/funding, test-token receipt and desktop/mobile chat. Private model responses correctly distinguish corrected 29,000 KRW obligation, prior 30,000 DEMO receipt and zero additional distribution. Meta-answers lacking supplied figures are rejected. Core/PostgreSQL 62, Solidity 15, Python 9 and codec 1 tests passed; Next production build and fixture/type checks passed.

Opened and inspected current list, project, staged amount/confirmation, operator distribution, investor receipts and mobile captures in `docs/evidence/presentation-v03/`. Source-pattern comparison and actual screenshots support this scope. Local accumulated test-wallet receipts include preserved prior rehearsal runs; they are not fabricated live GIWA receipts. Read-only GIWA evidence separately confirms TESTNET FAUCET Dojang at safe block 40106309. No user-wallet GIWA transaction was signed. Native dialog focus, basic keyboard use and responsive fit were tested; this is not an exhaustive browser/accessibility certification.

The following sections retain older release history; their retired customer flow, old math and disconnected-model notes are superseded by this acceptance and current release records.


**Latest acceptance scope (2026-10-26):** Implemented login-first → eight-store discovery/detail/investment → investment-history second tab → merchant/customer/reviewer/operator sections. Real wallet data and read-only operator persona examples remain distinct. Current local production browser evidence: 25 journey checks + 9 real-role/error-recovery checks; Java/PostgreSQL 54 tests; business E2E 12 and persona HTTP 11. See `docs/ux-flow.md` and `docs/evidence/ux-journey/`. Earlier component checks below remain historical. Public deployment is recorded separately after release.


2026-10-26 KST. This result applies to the local production build prepared for the current release. Public deployment evidence is recorded separately in `docs/evidence/service-flow/` and the deployment runbook.

## Reference and combined inspection

The user requested an Upbit-informed revision after the original HTML design. Image-search research, actual exchange captures and sources remain in `docs/evidence/upbit-research/`. The old passed HTML QA is preserved at `docs/evidence/design/design-qa-original-html.md`.

The actual Upbit exchange was recaptured at 1440×900 CSS pixels/DPR 1 as `docs/evidence/service-flow/upbit-reference-1440.png`. The actual local UpDish was captured at the same dimensions as `market-desktop.png`. `comparison-desktop.png` places both unscaled side by side with a 16px separator. `comparison-header.png` places equal native 550×300 crops together. Both combined images were opened and inspected in the same image input, followed by readable focused app captures. This is structural adaptation, not a claim of identical product content or exact font matching.

## Visual and interaction acceptance

- Navy navigation, gray gutters, flat white panels, numeric hierarchy and adjacent product/order context match the researched pattern. Oversized promotional tiles were removed. No Upbit brand asset was copied.
- Actual 1440×900, 768×900 and 390×844 captures were inspected. Product, table, order, wallet, reviewer and correction-statement surfaces fit; horizontal tables scroll internally. No document overflow was measured in the checked phone/tablet states.
- Search/no-results, status filters, presets, invalid quantity, hypothetical calculator, keyboard tab arrows and risk content passed. Guest login/portfolio/merchant navigation was exercised. Short mobile bottom navigation and the subscription anchor were checked.
- The user subsequently requested charts. Recharts renders approved monthly sales/pool and the current wallet's approved amount, with exact KRW/version tables. A single approved month is one bar. Missing months, price candles and history are not fabricated. Public production may correctly have no approved records. `chart-private-desktop.png`, `chart-private-mobile.png`, `chart-tablet.png`, `chart-empty-mobile.png` were inspected.
- The deterministic statement works without an LLM and displays calculation, attempts, prior payment, unpaid obligation and correction excess. Reviewer controls no longer imply permission to submit source material. The role flow exercises correction 25,000 → 24,167 won and excess 833 won.
- Web3-Onboard's standard modal selects the provider; wagmi 3 retains account/network events and Spring SIWE. Local injected-wallet tests passed actual BFF/Core/DB signing, logout and reload. Desktop and phone no-wallet states and close-X cancellation were checked. QR is disabled without a real Reown ID. The modal now uses z-index 1000 above the app's fixed mobile navigation; the corrected 390px screenshot was opened and inspected.
- The operator perspective picker fits 390px, closes with Escape, and changes merchant/customer/investor/operator views while keeping the same real server session/role. Customer view is public discovery, without an order/payment workflow. Screens never impersonate another investor's balance.

## Verification evidence and scope

- `guest-browser.json`: 17 browser checks.
- `role-browser.json`: 14 signed role checks. One test-only AI response stub establishes private UI isolation; no live model response is claimed.
- `wallet-chart-browser.json`: 15 popup/chart/statement/reload/perspective checks. The wallet is a local test provider, not the user's MetaMask.
- Java 38, Foundry 9, Python 4, codec 1; generated API 31 routes; Web and chain type checks and Next production build passed.
- User Dojang safe verification is real GIWA read-only evidence in `user-dojang-probe.json`. Anvil contract transactions are separately labelled local-only.

## Remaining limits

No live OpenAI response, Bojagi protocol transaction, QR/mobile WalletConnect session or user-signed GIWA deployment/mint/registry/revoke is claimed. These are tracked as team follow-ups. The third-party wallet modal still has an upstream Escape-dismiss/accessibility limitation and an English mobile wallet-count label; close-X and selection work. This is not a full accessibility certification. No security or authentication boundary was weakened for the operator's view selector.


## Public release

Deployment `dpl_Gcvt4eFXZqx2QFgQirHQUxUR88M7` reached READY from app commit `92fb4c9`. The canonical URL was opened and checked after deployment. Public auth 12, guest browser 17 and release API/modal/Dojang 6 checks passed. `production-home.png` was opened and visually inspected; it correctly shows no approved records. Current public Dojang read confirms the user's testnet proof is safe-valid. Public screenshots do not demonstrate another user's signed transaction.


## CSV sample preview revision — 2026-10-26

The user explicitly requested synthetic CSV data for the synthetic restaurant. Added nine canonical CSV scenarios: six monthly reference points (five new daily POS/PG/BANK files plus the existing normal October file), missing bank, cash shortage and correction. The sample chart is labelled CSV / approval pending, with an explicit data-source switch. It does not add approved DB records or private balances. Existing approved records take priority. Contract-period checks and separate-wallet approval remain intact.

Local production captures at 1440×900, 768×900 and 390×844 were checked. `docs/evidence/demo-data/comparison-desktop.png` combines the existing actual Upbit 1440×900 source with the current actual app at native size; `comparison-header.png` combines equal native crops. Both were opened together, followed by focused mobile chart/merchant captures. Flat panels, numeric hierarchy, navigation, readable tables and scenario controls are retained. ResponsiveContainer needs a resize-observer frame after viewport changes; the test waits for measured stable width rather than capturing the transient old SVG width.

Targeted Java CSV/catalog checks: 6 passed (two new catalog tests, four existing reconciliation tests). Read-only public sample browser checks: 13 passed, including all nine exact download hashes and an intentionally stubbed Core 503; errors are not silently replaced with sample success. Signed browser checks: 40 passed against dedicated PostgreSQL/Core/Anvil, covering all nine CSV submissions, missing-bank blocking, pre-contract settlement rejection, correction review/approval across wallets, approved-vs-sample separation and private-amount isolation. Business E2E 12 passed again. No app-side model/chain integration was mocked or changed; no cloud DB data was seeded or approved.

Final result remains passed for this inspected local production revision. Public release identity and checks are recorded in `docs/evidence/demo-data/` after deployment.

CSV revision public deployment `dpl_5TRVv5unotPzXnt1vE777QnvcevG` reached READY from `84d0725`. Canonical production browser checks passed all 13 items, including all nine download hashes. Production desktop/tablet/mobile captures are in `docs/evidence/demo-data/`. The public desktop capture was opened and visually checked. The public approved ledger remains untouched.


## Login/store/role journey revision — 2026-10-26

Inspected actual 1440×900 market/investment screens, 768×900 and 390×844 screens, mobile full detail, merchant and reviewer screenshots. Navy navigation, flat market rows, compact filters, exact amounts and information adjacent to subscription retain the existing Upbit-informed reference. The first two menu links are consistently discovery and investments; role tools follow them. Mobile navigation and numeric tables scroll internally. No document overflow in checked tablet/mobile states. A long-page capture was recaptured at scroll position zero to avoid displaced sticky elements in the screenshot.

Browser 25 + 9 checks use actual local SIWE/BFF/Core/PG. The test wallet provider and Dojang are local Anvil only. The final role check deliberately injects one browser-side 503 and verifies error/retry; it does not fabricate an app-side success. Reading a sample persona does not grant its real role. New live-simulation offerings and claims are persisted separately from the immutable snapshot; historical sample offerings cannot be subscribed. Existing approved sales chart is preserved.

React review: session-address keyed private state; no side effects during render; parallel independent queries; URL navigation and explicit error/loading states; native links/buttons/labels; dynamic chart/operations imports; no new dependency or application mock. Existing wallet-modal accessibility/QR, actual GIWA/model and Bojagi limits remain unchanged.


UX public deployment `dpl_HihA9BL52pzFKwtu8LmVXfTUQRZq` reached READY from `a91b6e2`. Canonical login was captured and opened for visual inspection. Public guest browser 7 and actual signed HTTP 18 checks passed, including eight-store discovery, isolated empty portfolio, benefit eligibility and authenticated-only access. Signed operator/merchant/customer sample interactions were checked locally as above; the public guest screenshot does not claim a user MetaMask or GIWA transaction.


## Demo task dialogs and IDE Agent — local review

The user requested a focused demonstration flow instead of stacked task forms, then explicitly chose an IDE-style right Agent sidebar. Current reference is the existing UpDish design system; no new visual branding or business pitch was introduced. The attached presentation's scenario/calculation informed the guide, not changes to approved stack or claims of implementation.

Fresh public audit capture reached the login entry only (in-app browser has no user wallet); no complete before-change authenticated audit is claimed. User then explicitly approved local test-wallet browser automation. Current local captures and 25 actual browser/SIWE/BFF/Core/PG checks are in docs/evidence/presentation-flow. A first modal capture revealed a missing center margin; it was fixed and final bounding-box checks/recaptures passed. Final desktop dock/detail, centered subscription and mobile Agent captures were opened and inspected.

React review: dynamic Agent loading, no new dependency, wallet/settlement keyed state, local chat only, bounded question context, native dialog focus trap/return, non-modal desktop dock, modal mobile dock, nested Escape isolation, no fake model reply. Existing API/permissions/four-eyes checks remain. Status API/55 Java tests and existing business E2E 12 passed. No public release of this revision or real model/GIWA transaction is claimed.

## Compact Agent and transparency — 2026-10-26

Result: passed for the inspected production build. Opened actual 1440×900 desktop chat/transparency and 390×844 mobile chat/transparency captures. Kept the Upbit-informed navy navigation, flat panels and exact KRW figures. Replaced the customer/coupon menu with a shared transparency page. Missing bank is unknown and approval-blocking. Raw customer IDs and unapproved financial amounts do not appear. The Agent is a compact topic selector, conversation and pinned composer; no amount cards, connection dashboard or suggestion grid. Internal source IDs are labelled for readers. Chat remains on normal navigation and close/reopen. Desktop main remains interactive; mobile is a focus-trapped full-screen chat.

Java/Postgres 58, Python 4 (fake SDK), local business 12, persona HTTP 11 and actual browser 18 passed. One real bounded public-evidence model result and one actual own-statement result are recorded separately from Anvil chain evidence. The final renderer uses the public result cached by Core, without a second generation. No app-side provider mocks or real user transactions were added. [Evidence](docs/evidence/transparency-agent/). Public release identity follows in release.json.


Final public check (2026-10-31): Core/Agent source `144977f`, Flyway V9 and historical business counts are verified. Public SIWE/BFF/Core/GIWA 23 checks and the real model passed. User-approved Whale SIWE, role menus, reload and actual chat were inspected. Unapproved public-chat evidence excludes sample amounts; own approved-statement figures remain server-derived. See `docs/evidence/presentation-v03/release.json` (relative to the repository root). No user blockchain transaction was submitted.
