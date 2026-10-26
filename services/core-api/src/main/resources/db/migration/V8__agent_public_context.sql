-- Public store questions have no private settlement. Preserve existing runs.
ALTER TABLE agent_run ALTER COLUMN settlement_id DROP NOT NULL;
