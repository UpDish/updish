# UpDish development

- This folder is the standalone project root. The enclosing Windows user home is an unrelated Git repository; run Git and project commands here explicitly.
- Follow the user's hackathon v0.2 specification in the parent outputs directory. Keep Spring Boot 4.1.2, Java 25, FastAPI 0.162.0, Python 3.13, Next.js 16.4.3 and PostgreSQL 18.6 unless the user authorizes a change.
- Keep business behavior in SIMULATION mode. Wallet/SIWE authentication and public/authenticated GIWA reads are implemented. Dojang transactions are signed by the user in the official Playground; in-app transaction submission, business workflows and model calls remain pending.
- Keep TESTNET FAUCET distinct from UPBIT KOREA. RPC errors must not become false attestations or successful payments.
- Dojang UID lookup can revert for invalid attestations. Only request it after a valid `isVerified` result at the same block.
- Bojagi is NOT_CONNECTED. Do not install unrelated similarly named packages or represent a mock as a real integration.
- Do not expose secrets or commit local env files, private keys, dependency caches or generated builds.
- Run checks appropriate to the changed layer; see README.md. PostgreSQL must be available for the Spring context test.
- Store evidence of live integration separately from local mock test results. Read docs/bootstrap-status.md and docs/wallet-status.md before continuing.
