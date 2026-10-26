-- A separate immutable fixture snapshot for the next UX iteration.
-- These records are not wallet accounts, approvals, ledger balances or redeemable coupons.
CREATE TABLE ux_demo_dataset (
 dataset_id varchar(80) PRIMARY KEY,
 version integer NOT NULL CHECK(version > 0),
 source_sha256 char(64) NOT NULL,
 payload jsonb NOT NULL,
 seeded_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(payload) = 'object' AND payload ?& ARRAY['mode','source','datasetId','version']),
 CHECK(payload->>'mode' = 'SIMULATION'),
 CHECK(payload->>'source' = 'SYNTHETIC_UX_FIXTURE'),
 CHECK(payload->>'datasetId' = dataset_id),
 CHECK((payload->>'version')::integer = version)
);
