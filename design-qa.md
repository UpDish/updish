# Upbit-informed UI/UX and service-flow verification

final result: passed

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
