BEGIN;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, google_sub text UNIQUE NOT NULL, email text NOT NULL,
 name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
 id uuid PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL,
 owner_email text NOT NULL, active boolean NOT NULL DEFAULT true,
 settings jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 user_id uuid REFERENCES users(id), email text NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','assistant','viewer')),
 UNIQUE(workspace_id,email)
);
CREATE TABLE IF NOT EXISTS domains (
 hostname text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 verified boolean NOT NULL DEFAULT false, verification_token text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_states (
 state_hash text PRIMARY KEY, browser_hash text NOT NULL, verifier text NOT NULL,
 user_id uuid REFERENCES users(id), workspace_id uuid REFERENCES workspaces(id),
 provider text NOT NULL, request_origin text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 name text NOT NULL, phone text NOT NULL DEFAULT '', phone_normalized text,
 email text NOT NULL DEFAULT '', source text NOT NULL DEFAULT 'Nhập tay',
 interest text NOT NULL DEFAULT 'unknown' CHECK(interest IN ('high','medium','low','unknown')),
 stage text NOT NULL DEFAULT 'new' CHECK(stage IN ('new','consulting','viewing','negotiating','won','lost')),
 budget numeric NOT NULL DEFAULT 0 CHECK(budget>=0), area text NOT NULL DEFAULT '',
 need text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 assigned_to uuid REFERENCES users(id), last_contact timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_phone_unique ON customers(workspace_id,phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE TABLE IF NOT EXISTS tasks (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 customer_id uuid NOT NULL, title text NOT NULL, due_at timestamptz NOT NULL,
 kind text NOT NULL CHECK(kind IN ('call','message','viewing')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,customer_id) REFERENCES customers(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS activities (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 customer_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id),
 kind text NOT NULL CHECK(kind IN ('call','message','meeting')),
 note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,customer_id) REFERENCES customers(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS connections (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
 user_id uuid NOT NULL REFERENCES users(id), provider text NOT NULL CHECK(provider IN ('drive','calendar')),
 email text NOT NULL, encrypted_token text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,user_id,provider)
);
CREATE TABLE IF NOT EXISTS calendar_links (
 connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
 task_id uuid NOT NULL REFERENCES tasks(id), event_id text NOT NULL,
 PRIMARY KEY(connection_id,task_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id uuid PRIMARY KEY, workspace_id uuid REFERENCES workspaces(id),
 actor_id uuid REFERENCES users(id), action text NOT NULL,
 entity_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_workspace_due ON tasks(workspace_id,due_at);
CREATE INDEX IF NOT EXISTS activities_customer ON activities(workspace_id,customer_id,created_at);
CREATE INDEX IF NOT EXISTS memberships_user ON memberships(user_id);
-- Defense in depth. Run the app as a non-owner, non-superuser role without BYPASSRLS.
-- Every tenant transaction sets app.workspace_id locally; FORCE RLS also covers the table owner.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities FORCE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='workspace_isolation') THEN
  CREATE POLICY workspace_isolation ON customers USING (workspace_id::text=current_setting('app.workspace_id',true)) WITH CHECK(workspace_id::text=current_setting('app.workspace_id',true));
  CREATE POLICY workspace_isolation ON tasks USING (workspace_id::text=current_setting('app.workspace_id',true)) WITH CHECK(workspace_id::text=current_setting('app.workspace_id',true));
  CREATE POLICY workspace_isolation ON activities USING (workspace_id::text=current_setting('app.workspace_id',true)) WITH CHECK(workspace_id::text=current_setting('app.workspace_id',true));
  CREATE POLICY workspace_isolation ON connections USING (workspace_id::text=current_setting('app.workspace_id',true)) WITH CHECK(workspace_id::text=current_setting('app.workspace_id',true));
 END IF;
END $$;
COMMIT;
