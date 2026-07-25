-- Volt Trades — append-only hardening (defense-in-depth for the money rules).
--
-- The application layer already treats `ledger_entries` and `audit_logs` as
-- append-only (no UPDATE/DELETE code paths; corrections are new compensating
-- rows). These triggers enforce the same invariant at the database level so a
-- rogue query, ORM mistake, or manual edit can never rewrite financial history.
--
-- Apply after migrations:  pnpm db:harden   (idempotent — safe to re-run)

CREATE OR REPLACE FUNCTION volt_prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: this table is append-only', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- ledger_entries: never update or delete a posted entry.
DROP TRIGGER IF EXISTS ledger_entries_no_update ON ledger_entries;
CREATE TRIGGER ledger_entries_no_update
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION volt_prevent_mutation();

DROP TRIGGER IF EXISTS ledger_entries_no_delete ON ledger_entries;
CREATE TRIGGER ledger_entries_no_delete
  BEFORE DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION volt_prevent_mutation();

-- audit_logs: an audit trail that can be edited is worthless.
DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION volt_prevent_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION volt_prevent_mutation();
