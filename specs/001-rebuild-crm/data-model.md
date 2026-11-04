# Mô hình dữ liệu: Mayhomes CRM (rebuild)

**Date**: 2026-11-04

## Sơ đồ quan hệ (logic)

```text
users ──┬── memberships ── workspaces ── domains
        │                      │
        ├── sessions           ├── customers ──┬── tasks
        ├── oauth_states       │               ├── activities
        └── connections ── calendar_links      ├── channel_identities ── channel_messages
                               │               └── merge_suggestions
                               ├── channel_connections
                               └── audit_log

channel_routes (provider, external_id) → workspace_id   # không RLS; chỉ định tuyến webhook
```

## Thực thể chi tiết

### users
- `id` UUID PK, `google_sub` UNIQUE, `email`, `name`, `created_at`

### workspaces
- `id`, `slug` UNIQUE, `name`, `owner_email`, `active`, `settings` JSONB, `created_at`

### memberships
- `workspace_id`, `user_id` nullable (mời trước khi user login), `email`, `role` ∈ {owner,assistant,viewer}
- UNIQUE(workspace_id, email)

### domains
- `hostname` PK, `workspace_id`, `verified`, `verification_token`, `created_at`

### sessions / oauth_states
- Session: `token_hash` PK, `user_id`, `expires_at`
- OAuth: `state_hash`, `browser_hash`, `verifier`, optional user/workspace, `provider`, `request_origin`, `expires_at`

### customers
- Thuộc workspace; `phone` + `phone_normalized`; UNIQUE(workspace_id, phone_normalized) WHERE NOT NULL
- `interest` ∈ high|medium|low|unknown; `stage` ∈ new|consulting|viewing|negotiating|won|lost
- `budget` ≥ 0; `assigned_to` → users; `avatar_url`; `merged_into` → customers (cùng workspace)
- Index active: WHERE `merged_into IS NULL`

### tasks
- `kind` call|message|viewing; `status` pending|done|cancelled; FK composite workspace+customer

### activities
- `kind` call|message|meeting; `note`; actor `user_id`

### connections
- `provider` drive|calendar; `encrypted_token`; UNIQUE(workspace,user,provider)

### calendar_links
- PK (`connection_id`,`task_id`) → `event_id`

### channel_connections
- `provider` meta_page|zalo_oa; UNIQUE(workspace,provider); UNIQUE(provider,external_id)
- `encrypted_secrets`, `status` connected|error|disconnected

### channel_routes
- PK (provider, external_id) → workspace_id (webhook lookup)

### channel_identities
- UNIQUE(workspace, provider, external_user_id); provider meta_page|zalo_oa|instagram
- `avatar_url`, `metadata` JSONB

### channel_messages
- `direction` inbound|outbound; unique partial (workspace,provider,external_message_id)

### merge_suggestions
- `reason` (vd phone_match), `status` pending|accepted|dismissed

### audit_log
- `workspace_id`, `actor_id`, `action`, `entity_id`, `created_at`

## Quy tắc RLS

Bật ENABLE + FORCE trên: customers, tasks, activities, connections, channel_connections, channel_identities, channel_messages, merge_suggestions.

Policy `workspace_isolation`: `workspace_id::text = current_setting('app.workspace_id', true)`.

Không RLS trên: users, workspaces, memberships, domains, sessions, oauth_states, channel_routes, audit_log (kiểm soát ở API / platform admin). [NEEDS CLARIFICATION: có siết RLS/audit chặt hơn không?]

## Migration strategy

1. Giữ `001_initial.sql`.
2. Thêm `002_channels.sql`, `003_identity_enrichment.sql` vào runner migrate (theo thứ tự tên file).
3. Migrate runner đọc mọi `database/*.sql` sorted — thay vì hardcode một file.
4. Mọi thay đổi schema sau này = file số mới; có ghi chú rollback trong PR.
