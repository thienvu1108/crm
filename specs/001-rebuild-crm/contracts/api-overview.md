# Hợp đồng API

**Date**: 2026-11-04  
Deploy: **Vercel**; Cron gọi worker với `JOB_SECRET`.

## Auth / config / me / logout
Như trước (`/auth/google|meta|zalo|tiktok/*`, `/api/config` có VAPID public + mode).

## Platform
- GET/POST `/api/platform/workspaces`
- PATCH `/api/platform/workspaces/:id` — `active` lock/unlock
- domains + verify

## CRM / members / settings / calendar
Như trước; mọi ghi kiểm tra workspace active + RLS.

## Backup & jobs
- GET `/api/backup/export` owner
- POST `/api/backup/drive` owner → **enqueue** job (202 + job id)
- POST `/api/backup/restore/preview|confirm|cancel` owner
- GET `/api/jobs?type=backup` owner — giám sát status/attempts/error
- POST `/api/jobs/worker` — Cron/bearer `JOB_SECRET`; claim batch SKIP LOCKED
- (Giữ tương thích) POST `/api/jobs/backups` có thể enqueue hàng loạt mọi workspace active thay vì chạy sync

## Channels / inbox / push / webhooks / merge
Như trước (meta/zalo/tiktok webhooks; inbox; push subscribe; merge).

## Errors
`{"error":"…"}` tiếng Việt; 403 locked; 503 thiếu config.
