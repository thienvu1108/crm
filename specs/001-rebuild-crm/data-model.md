# Mô hình dữ liệu

**Date**: 2026-11-04

## Quan hệ

```text
users ── memberships ── workspaces(active) ── domains
  │                         ├── customers ── tasks/activities/identities/messages/merges
  ├── sessions              ├── channel_connections/routes
  ├── oauth_states          ├── connections/calendar_links
  ├── push_subscriptions    ├── backup_restore_sessions
  └── …                     ├── jobs / job_attempts
                            └── audit_log
```

## RLS (bắt buộc FORCE)

**Có RLS workspace (hoặc policy tương đương an toàn):**
customers, tasks, activities, connections, channel_connections, channel_identities, channel_messages, merge_suggestions, push_subscriptions, backup_restore_sessions, jobs (theo workspace_id), **audit_log**, **memberships**, **domains**.

Policy mẫu: `workspace_id::text = current_setting('app.workspace_id', true)` với WITH CHECK; memberships/domains/audit cần policy phù hợp (platform admin vs member) — ghi rõ trong migration `00N_rls_hardening.sql`. `channel_routes` vẫn lookup webhook không RLS nhưng chỉ map id→workspace.

## Jobs

`jobs`: id, workspace_id, type (`backup.drive`…), payload jsonb, status, attempts, max_attempts, run_after, locked_at, locked_by, last_error, created_at, updated_at, finished_at  
`job_attempts` (optional): job_id, attempt, error, created_at

## Restore / Push / Channels
Như plan trước + provider `tiktok_lead`; Instagram trên identity/message.

## Migrations (ý)
001_initial → 002_channels → 003_identity → 004_push → 005_tiktok_restore → 006_jobs_queue → 007_rls_hardening
