CREATE TABLE demo_state (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), run_id uuid NOT NULL REFERENCES demo_run(id));
INSERT INTO demo_state VALUES (true, '00000000-0000-0000-0000-000000000001');
ALTER TABLE wallet_user DROP CONSTRAINT wallet_user_role_check;
ALTER TABLE wallet_user ADD CHECK(role IN ('INVESTOR','MERCHANT','REVIEWER','OPERATOR'));

CREATE TABLE offering (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES demo_run(id), store_name text NOT NULL,
 owner_address varchar(42) NOT NULL, title text NOT NULL, contract_version integer NOT NULL DEFAULT 1,
 target_units integer NOT NULL CHECK(target_units > 0), unit_price bigint NOT NULL CHECK(unit_price > 0),
 rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000), months integer NOT NULL CHECK(months > 0),
 status varchar(20) NOT NULL CHECK(status IN ('OPEN','FUNDED','REFUNDED','MATURED')),
 token_id numeric(78,0) NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE evidence (
 id uuid PRIMARY KEY, offering_id uuid NOT NULL REFERENCES offering(id), period varchar(7) NOT NULL,
 filename varchar(120) NOT NULL, csv_content text NOT NULL, report jsonb NOT NULL, source_hash char(64) NOT NULL,
 status varchar(20) NOT NULL CHECK(status IN ('BLOCKED','REVIEW','CLOSED')), submitted_by varchar(42) NOT NULL,
 reviewed_by varchar(42), review_reason text, created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
 UNIQUE(offering_id,source_hash)
);
CREATE TABLE subscription (
 id uuid PRIMARY KEY, offering_id uuid NOT NULL REFERENCES offering(id), address varchar(42) NOT NULL,
 units integer NOT NULL CHECK(units > 0), status varchar(20) NOT NULL CHECK(status IN ('ACCEPTED','ALLOCATED','CANCELLED','REFUNDED')),
 request_key uuid NOT NULL, synthetic boolean NOT NULL DEFAULT false, dojang_uid varchar(66), dojang_block bigint, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(offering_id,address,request_key)
);
CREATE TABLE holding (
 id uuid PRIMARY KEY, offering_id uuid NOT NULL REFERENCES offering(id), address varchar(42) NOT NULL,
 units integer NOT NULL CHECK(units > 0), synthetic boolean NOT NULL DEFAULT false,
 chain_units integer NOT NULL DEFAULT 0 CHECK(chain_units >= 0 AND chain_units <= units), UNIQUE(offering_id,address)
);
CREATE TABLE allocation (
 id uuid PRIMARY KEY, subscription_id uuid NOT NULL UNIQUE REFERENCES subscription(id), holding_id uuid NOT NULL REFERENCES holding(id),
 units integer NOT NULL CHECK(units > 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE settlement (
 id uuid PRIMARY KEY, offering_id uuid NOT NULL REFERENCES offering(id), evidence_id uuid NOT NULL REFERENCES evidence(id),
 period varchar(7) NOT NULL, version integer NOT NULL, previous_id uuid REFERENCES settlement(id),
 net_sales bigint NOT NULL CHECK(net_sales >= 0), pool_won bigint NOT NULL CHECK(pool_won >= 0),
 cash_available bigint NOT NULL CHECK(cash_available >= 0), algorithm varchar(40) NOT NULL,
 status varchar(20) NOT NULL CHECK(status IN ('REVIEW','APPROVED')), created_by varchar(42) NOT NULL, approved_by varchar(42),
 reason text NOT NULL, snapshot text NOT NULL, salt varchar(64) NOT NULL, digest varchar(66) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(offering_id,period,version)
);
CREATE TABLE settlement_line (
 id uuid PRIMARY KEY, settlement_id uuid NOT NULL REFERENCES settlement(id), holding_id uuid NOT NULL REFERENCES holding(id),
 address varchar(42) NOT NULL, units integer NOT NULL, amount_won bigint NOT NULL CHECK(amount_won >= 0),
 paid_won bigint NOT NULL DEFAULT 0 CHECK(paid_won >= 0 AND paid_won <= amount_won), prior_paid_won bigint NOT NULL DEFAULT 0 CHECK(prior_paid_won >= 0), delta_won bigint NOT NULL,
 UNIQUE(settlement_id,holding_id)
);
CREATE TABLE payment_attempt (
 id uuid PRIMARY KEY, line_id uuid NOT NULL REFERENCES settlement_line(id), request_key uuid NOT NULL UNIQUE,
 requested_won bigint NOT NULL CHECK(requested_won > 0), paid_won bigint NOT NULL CHECK(paid_won >= 0),
 outcome varchar(20) NOT NULL CHECK(outcome IN ('SIMULATED_SUCCESS','SIMULATED_PARTIAL','FAILED')),
 actor varchar(42) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE chain_config (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), offering_id uuid NOT NULL REFERENCES offering(id), units_address varchar(42) NOT NULL,
 registry_address varchar(42) NOT NULL, operator_address varchar(42) NOT NULL, checked_block bigint NOT NULL,
 units_code_hash varchar(66) NOT NULL, registry_code_hash varchar(66) NOT NULL
);
CREATE TABLE chain_job (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES demo_run(id), kind varchar(20) NOT NULL CHECK(kind IN ('MINT','SETTLEMENT')),
 reference_id uuid NOT NULL, target varchar(42), calldata text, status varchar(24) NOT NULL
 CHECK(status IN ('AWAITING_DEPLOYMENT','AWAITING_SIGNATURE','SUBMITTED','INCLUDED','SAFE','FAILED','CHECK_PENDING')),
 tx_hash varchar(66) UNIQUE, block_number bigint, block_hash varchar(66), error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(kind,reference_id)
);
CREATE TABLE dojang_check (
 id uuid PRIMARY KEY, address varchar(42) NOT NULL, purpose varchar(20) NOT NULL, verified boolean NOT NULL,
 uid varchar(66), block_number bigint NOT NULL, checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE chain_attempt (tx_hash varchar(66) PRIMARY KEY,job_id uuid NOT NULL REFERENCES chain_job(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE agent_run (
 id uuid PRIMARY KEY, address varchar(42) NOT NULL, settlement_id uuid NOT NULL REFERENCES settlement(id),
 data_version varchar(66) NOT NULL, status varchar(20) NOT NULL, result jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE evidence_attachment (
 id uuid PRIMARY KEY, offering_id uuid NOT NULL REFERENCES offering(id), uploaded_by varchar(42) NOT NULL,
 object_key text NOT NULL UNIQUE, filename varchar(120) NOT NULL, content_type varchar(100) NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880), status varchar(20) NOT NULL CHECK(status IN ('PENDING','READY')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE business_event (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES demo_run(id), actor varchar(42) NOT NULL,
 action varchar(40) NOT NULL, reference_id uuid NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
