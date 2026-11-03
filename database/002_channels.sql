BEGIN;
CREATE TABLE IF NOT EXISTS channel_connections (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 provider text NOT NULL CHECK(provider IN ('meta_page','zalo_oa')),
 external_id text NOT NULL,
 display_name text NOT NULL DEFAULT '',
 encrypted_secrets text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','error','disconnected')),
 connected_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id, provider),
 UNIQUE(provider, external_id)
);
-- Webhook routing without RLS: only maps external page/OA id -> workspace.
CREATE TABLE IF NOT EXISTS channel_routes (
 provider text NOT NULL CHECK(provider IN ('meta_page','zalo_oa')),
 external_id text NOT NULL,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 PRIMARY KEY(provider, external_id)
);
CREATE TABLE IF NOT EXISTS channel_identities (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 customer_id uuid NOT NULL,
 provider text NOT NULL CHECK(provider IN ('meta_page','zalo_oa','instagram')),
 external_user_id text NOT NULL,
 profile_name text NOT NULL DEFAULT '',
 last_inbound_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id, provider, external_user_id),
 UNIQUE(workspace_id, id),
 FOREIGN KEY(workspace_id, customer_id) REFERENCES customers(workspace_id, id)
);
CREATE TABLE IF NOT EXISTS channel_messages (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES workspaces(id),
 customer_id uuid NOT NULL,
 identity_id uuid,
 provider text NOT NULL CHECK(provider IN ('meta_page','zalo_oa','instagram')),
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')),
 external_message_id text,
 body text NOT NULL DEFAULT '',
 payload jsonb NOT NULL DEFAULT '{}',
 sent_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id, customer_id) REFERENCES customers(workspace_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS channel_messages_external_unique
 ON channel_messages(workspace_id, provider, external_message_id)
 WHERE external_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS channel_messages_customer ON channel_messages(workspace_id, customer_id, created_at);
CREATE INDEX IF NOT EXISTS channel_identities_customer ON channel_identities(workspace_id, customer_id);
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE channel_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='channel_connections' AND policyname='workspace_isolation') THEN
  CREATE POLICY workspace_isolation ON channel_connections USING (workspace_id::text=current_setting('app.workspace_id',true)) WITH CHECK(workspace_id::text=current_setting('app.workspace_id',true));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='channel_identities' AND policyname='workspace_isolation') THEN
  CREATE POLICY workspace_isolation ON channel_identities USING (workspace_id::text=current_setting('app.workspace_id',true)) WITH CHECK(workspace_id::text=current_setting('app.workspace_id',true));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='channel_messages' AND policyname='workspace_isolation') THEN
  CREATE POLICY workspace_isolation ON channel_messages USING (workspace_id::text=current_setting('app.workspace_id',true)) WITH CHECK(workspace_id::text=current_setting('app.workspace_id',true));
 END IF;
END $$;
COMMIT;
