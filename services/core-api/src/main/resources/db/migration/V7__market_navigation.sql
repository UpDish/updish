-- Additional subscribable demo listings never replace the existing active run.
CREATE TABLE market_offering (
 store_id varchar(80) PRIMARY KEY,
 offering_id uuid NOT NULL UNIQUE REFERENCES offering(id)
);
CREATE TABLE benefit_claim (
 id uuid PRIMARY KEY,
 dataset_id varchar(80) NOT NULL REFERENCES ux_demo_dataset(dataset_id),
 benefit_id varchar(80) NOT NULL,
 address varchar(42) NOT NULL,
 code varchar(80) NOT NULL UNIQUE,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(dataset_id,benefit_id,address)
);
