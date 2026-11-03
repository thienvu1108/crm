BEGIN;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url text NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS merged_into uuid;
DO $$ BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM information_schema.table_constraints
  WHERE constraint_name='customers_merged_into_fkey' AND table_name='customers'
 ) THEN
  ALTER TABLE customers
   ADD CONSTRAINT customers_merged_into_fkey
   FOREIGN KEY (workspace_id, merged_into) REFERENCES customers(workspace_id, id);
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS customers_active_workspace ON customers(workspace_id) WHERE merged_into IS NULL;

ALTER TABLE channel_identities ADD COLUMN IF NOT EXISTS avatar_url text NOT NULL DEFAULT '';
ALTER TABLE channel_identities ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS merge_suggestions (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 source_customer_id uuid NOT NULL,
 target_customer_id uuid NOT NULL,
 identity_id uuid,
 reason text NOT NULL DEFAULT 'phone_match',
 detail text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 resolved_by uuid REFERENCES users(id),
 UNIQUE(workspace_id, source_customer_id, target_customer_id, identity_id),
 FOREIGN KEY(workspace_id, source_customer_id) REFERENCES customers(workspace_id, id),
 FOREIGN KEY(workspace_id, target_customer_id) REFERENCES customers(workspace_id, id)
);
CREATE INDEX IF NOT EXISTS merge_suggestions_pending ON merge_suggestions(workspace_id, status) WHERE status='pending';

ALTER TABLE merge_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merge_suggestions FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='merge_suggestions' AND policyname='workspace_isolation') THEN
  CREATE POLICY workspace_isolation ON merge_suggestions
   USING (workspace_id::text=current_setting('app.workspace_id',true))
   WITH CHECK (workspace_id::text=current_setting('app.workspace_id',true));
 END IF;
END $$;
COMMIT;
