-- Preserve every previous run and chain attempt. Only the active presentation pointer changes once.
INSERT INTO demo_run(id,label) VALUES ('00000000-0000-0000-0000-000020261031','발표 v0.3 · 2호점 확장') ON CONFLICT DO NOTHING;
UPDATE demo_state SET run_id='00000000-0000-0000-0000-000020261031' WHERE singleton=true;
ALTER TABLE offering ADD COLUMN scenario_code varchar(40) NOT NULL DEFAULT 'legacy-v02';
ALTER TABLE offering ADD COLUMN capital_purpose text NOT NULL DEFAULT '기존 시연 모집 상품';
ALTER TABLE offering ADD COLUMN revenue_scope text NOT NULL DEFAULT '계약에 명시한 정산대상 매출';
ALTER TABLE offering ADD COLUMN funding_use text NOT NULL DEFAULT '기존 시연 계약 참조';
ALTER TABLE chain_job DROP CONSTRAINT chain_job_kind_check;
ALTER TABLE chain_job ADD CONSTRAINT chain_job_kind_check CHECK(kind IN ('MINT','SETTLEMENT','FUND_DISTRIBUTION','PAY_DISTRIBUTION'));
CREATE TABLE distribution_config (
 offering_id uuid PRIMARY KEY REFERENCES offering(id), cash_address varchar(42) NOT NULL,
 vault_address varchar(42) NOT NULL, units_address varchar(42) NOT NULL, registry_address varchar(42) NOT NULL,
 checked_block bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE distribution_intent (
 job_id uuid PRIMARY KEY REFERENCES chain_job(id), settlement_id uuid NOT NULL REFERENCES settlement(id),
 line_id uuid REFERENCES settlement_line(id), period_id varchar(66) NOT NULL,
 amount_units bigint NOT NULL CHECK(amount_units >= 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX distribution_settlement_idx ON distribution_intent(settlement_id);
CREATE INDEX distribution_line_idx ON distribution_intent(line_id);
