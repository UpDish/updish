ALTER TABLE subscription ADD COLUMN refunded_units integer NOT NULL DEFAULT 0
 CHECK(refunded_units >= 0 AND refunded_units <= units);
UPDATE subscription SET refunded_units=units WHERE status IN ('CANCELLED','REFUNDED');
