# UpDish development

- This folder is the standalone project root. The enclosing Windows user home is an unrelated Git repository; run Git and project commands here explicitly.
- Follow the user's hackathon v0.2 specification in the parent outputs directory. Keep Spring Boot 4.1.2, Java 25, FastAPI 0.162.0, Python 3.13, Next.js 16.4.3 and PostgreSQL 18.6 unless the user authorizes a change.
- Keep business behavior in SIMULATION mode. Business workflows, wallet-signed contract deployment/mint/registry jobs and the bounded FastAPI model adapter are implemented. Dojang issuance/revocation is signed by the user in the official Playground. Never report Anvil/mock tests as GIWA transactions or the unconfigured model as a live integration.
- Keep TESTNET FAUCET distinct from UPBIT KOREA. RPC errors must not become false attestations or successful payments.
- Dojang UID lookup can revert for invalid attestations. Only request it after a valid `isVerified` result at the same block.
- Bojagi is NOT_CONNECTED. Do not install unrelated similarly named packages or represent a mock as a real integration.
- Do not expose secrets or commit local env files, private keys, dependency caches or generated builds.
- Run checks appropriate to the changed layer; see README.md. PostgreSQL must be available for the Spring context test.
- Store evidence of live integration separately from local mock test results. Read docs/development-status.md and docs/deploy-runbook.md before continuing. bootstrap-status.md and wallet-status.md are historical records.
- OpenAI key destination confirmation was declined. No key was created or written; do not restart the key creation flow without renewed user authorization. Vercel team access was approved by the user on 2026-10-25; use the connected MCP and the documented team/project. Do not bypass future access restrictions using another credential route.
- Business API schemas and generated Web types come from scripts/api-contract.mjs (`pnpm generate:api`). Maintain Flyway migrations append-only. Preserve old demo runs and chain attempts when resetting.
- Keep the supplied HTML and the source screenshots in docs/evidence/design as the frontend visual baseline. Read design-qa.md before changing its navigation, tile/table hierarchy or separate detail/application layout. Do not invent a landing hero or decorative storefront art.
