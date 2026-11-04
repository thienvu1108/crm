# Hợp đồng API (tổng quan) — Mayhomes CRM rebuild

**Date**: 2026-11-04
**Base**: API Node JSON UTF-8; SvelteKit `web/` gọi cùng origin hoặc `PUBLIC_API_ORIGIN`. `Cache-Control: no-store` API nhạy cảm.

## Auth

| Method | Path | Ai | Mô tả |
|---|---|---|---|
| GET | `/auth/google/start` | Public | Login OAuth PKCE |
| GET | `/auth/google/connect` | User | Drive/Calendar |
| GET | `/auth/google/callback` | Public | Callback Google |
| GET | `/auth/meta/callback` | Public | Callback Meta |
| GET | `/auth/zalo/callback` | Public | Callback Zalo |
| GET | `/auth/tiktok/callback` | Public | Callback TikTok (nếu OAuth) |
| POST | `/api/logout` | User | Hủy session |

## Hệ thống

| Method | Path | Ai | Mô tả |
|---|---|---|---|
| GET | `/api/config` | Public | server/googleReady/mode + cờ PWA/VAPID public key |
| GET | `/api/me` | User | Hồ sơ + memberships |
| GET | `/api/data` | Member | Snapshot theo quyền (workspace active) |
| POST | `/api/jobs/backups` | JOB_SECRET | Sao lưu Drive hàng loạt |

## Platform admin

| Method | Path | Mô tả |
|---|---|---|
| GET/POST | `/api/platform/workspaces` | Liệt kê / tạo |
| PATCH | `/api/platform/workspaces/:id` | **Khóa/mở** (`active`) + metadata |
| GET/POST | `/api/platform/domains` | Hostname |
| POST | `/api/platform/domains/verify` | TXT DNS |

## Workspace CRM

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST/PATCH | `/api/customers`… | write | Khách |
| POST/PATCH | `/api/tasks`… | write | Lịch chăm |
| POST | `/api/activities` | write | Nhật ký |
| PATCH | `/api/settings` | owner | Settings |
| POST/DELETE | `/api/members`… | owner | Thành viên |
| DELETE | `/api/connections/:provider` | self/owner | Ngắt Google |
| GET | `/api/backup/export` | owner | Tải JSON |
| POST | `/api/backup/drive` | owner | Sao lưu Drive |
| POST | `/api/backup/restore/preview` | owner | Tạo preview restore |
| POST | `/api/backup/restore/confirm` | owner | Áp dụng sau confirm |
| POST | `/api/backup/restore/cancel` | owner | Hủy preview |
| POST | `/api/calendar/sync` | member+Calendar | Sync một chiều |

## Kênh, Inbox, Push, TikTok

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| CRUD | `/api/channels/connections` | owner | Meta/Zalo/TikTok |
| GET | `/api/inbox` | read | Thread đa kênh (meta/zalo/instagram) |
| GET | `/api/inbox/:threadId` | read | Chi tiết thread |
| POST | `/api/channels/messages` | write | Trả lời (không IG gửi) |
| POST | `/api/channels/identities/link` | write | Gắn identity |
| GET/PATCH | `/api/merge-suggestions` | write policy | Gộp |
| POST | `/api/customers/merge` | policy | Merge |
| POST | `/api/push/subscribe` | user | Lưu Web Push subscription |
| DELETE | `/api/push/subscribe` | user | Hủy subscription |
| GET/POST | `/webhooks/meta` | Meta | Verify + inbound (+ IG) |
| POST | `/webhooks/zalo` | Zalo | Inbound |
| POST | `/webhooks/tiktok` | TikTok | Lead inbound |

## Lỗi

```json
{"error": "Mô tả tiếng Việt"}
```

Workspace locked / thiếu cấu hình: **403** / **503** tương ứng.
