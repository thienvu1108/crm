BEGIN;
-- Harden RLS on audit_log, memberships, domains.
-- Session vars (local to transaction / request connection):
--   app.workspace_id  — tenant scope
--   app.platform_admin='true' — after server verifies platform admin
--   app.user_id — current user uuid for reading own memberships
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_log' AND policyname='workspace_isolation') THEN
  DROP POLICY workspace_isolation ON audit_log;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='memberships' AND policyname='workspace_isolation') THEN
  DROP POLICY workspace_isolation ON memberships;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='domains' AND policyname='workspace_isolation') THEN
  DROP POLICY workspace_isolation ON domains;
 END IF;

 CREATE POLICY workspace_isolation ON audit_log
  USING (
    workspace_id IS NULL
    OR workspace_id::text = current_setting('app.workspace_id', true)
    OR current_setting('app.platform_admin', true) = 'true'
  )
  WITH CHECK (
    workspace_id IS NULL
    OR workspace_id::text = current_setting('app.workspace_id', true)
    OR current_setting('app.platform_admin', true) = 'true'
  );

 CREATE POLICY workspace_isolation ON memberships
  USING (
    workspace_id::text = current_setting('app.workspace_id', true)
    OR current_setting('app.platform_admin', true) = 'true'
    OR (user_id IS NOT NULL AND user_id::text = current_setting('app.user_id', true))
  )
  WITH CHECK (
    workspace_id::text = current_setting('app.workspace_id', true)
    OR current_setting('app.platform_admin', true) = 'true'
  );

 CREATE POLICY workspace_isolation ON domains
  USING (
    workspace_id::text = current_setting('app.workspace_id', true)
    OR current_setting('app.platform_admin', true) = 'true'
  )
  WITH CHECK (
    workspace_id::text = current_setting('app.workspace_id', true)
    OR current_setting('app.platform_admin', true) = 'true'
  );
END $$;
COMMIT;
