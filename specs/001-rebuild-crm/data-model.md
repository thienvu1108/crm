# Mô hình dữ liệu: Mayhomes CRM (rebuild)

**Date**: 2026-11-04

## Sơ đồ quan hệ (logic)

```text
users ──┬── memberships ── workspaces (active) ── domains
        │                      │
        ├── sessions           ├── customers ──┬── tasks
        ├── oauth_states       │               ├── activities
        ├── push_subscriptions │               ├── channel_identities ── channel_messages
        └── connections ── calendar_links      └── merge_suggestions
                               ├── channel_connections (meta_page|zalo_oa|tiktok_lead)
                               ├── channel_routes
                               ├── backup_restore_sessions (optional)
                               └── audit_log
```

## Thay đổi / bổ sung so với baseline

### workspaces
- Dùng `active` cho **khóa/mở**; platform admin PATCH; API ghi kiểm tra `active=true`.

### channel_connections.provider
- Mở rộng CHECK: `meta_page` | `zalo_oa` | `tiktok_lead` (và metadata TikTok trong JSON).
- UNIQUE(workspace, provider) giữ 1 kết nối / loại / không gian ở bản đầu.

### channel_identities / channel_messages.provider
- Thêm/giữ `instagram` cho nhận; `tiktok_lead` cho lead events nếu lưu dạng message/activity.

### push_subscriptions (mới)
- `id`, `workspace_id` nullable hoặc theo user global, `user_id`, `endpoint` UNIQUE, `p256dh`, `auth` (encrypted or protected), `user_agent`, `created_at`
- RLS theo user hoặc workspace membership khi gửi.

### backup_restore_sessions (mới — hoặc ephemeral server-side)
- `id`, `workspace_id`, `actor_id`, `source` (drive_file_id | upload), `preview_summary` JSONB, `status` pending_confirm|applied|cancelled|expired, `expires_at`
- Apply trong transaction; audit `backup.restore`.

### Inbox
- Không bắt buộc bảng riêng: query `channel_messages` gần nhất GROUP BY identity/customer + provider; optional `inbox_read_states(user_id, thread_key, last_read_at)`.

## RLS

FORCE trên: customers, tasks, activities, connections, channel_*, merge_suggestions, push_subscriptions (workspace-scoped), backup_restore_sessions.

[NEEDS CLARIFICATION]: siết RLS cho audit_log / memberships / domains?

## Migration

`001_initial` → `002_channels` → `003_identity_enrichment` → `004_push_subscriptions` → `005_tiktok_and_restore` (đặt tên cuối khi implement). Runner đọc sorted `database/*.sql`.
