# Hợp đồng API (tổng quan) — Mayhomes CRM rebuild

**Date**: 2026-11-04
**Base**: cùng origin với SPA; JSON UTF-8; `Cache-Control: no-store` cho API nhạy cảm.

## Auth

| Method | Path | Ai | Mô tả |
|---|---|---|---|
| GET | `/auth/google/start` | Public | Bắt đầu login OAuth PKCE |
| GET | `/auth/google/connect` | User | Bắt đầu cấp quyền Drive/Calendar |
| GET | `/auth/google/callback` | Public | Callback OAuth Google |
| GET | `/auth/meta/callback` | Public | Callback Meta (kênh) |
| GET | `/auth/zalo/callback` | Public | Callback Zalo OA |
| POST | `/api/logout` | User | Hủy session |

## Hệ thống

| Method | Path | Ai | Mô tả |
|---|---|---|---|
| GET | `/api/config` | Public | `{server, googleReady, mode}` — demo nếu thiếu secrets |
| GET | `/api/me` | User | Hồ sơ + memberships |
| GET | `/api/data` | Member | Snapshot dữ liệu không gian theo quyền |
| POST | `/api/jobs/backups` | `Authorization: Bearer JOB_SECRET` | Sao lưu Drive mọi workspace active |

## Platform admin

| Method | Path | Mô tả |
|---|---|---|
| GET/POST | `/api/platform/workspaces` | Liệt kê / tạo không gian |
| GET/POST | `/api/platform/domains` | Đăng ký hostname |
| POST | `/api/platform/domains/verify` | Kiểm TXT DNS |

## Workspace (membership bắt buộc)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/customers` | write | Tạo khách |
| PATCH | `/api/customers/:id` | write (+ assignment) | Sửa khách / giai đoạn / giao việc |
| POST | `/api/tasks` | write | Tạo lịch chăm |
| PATCH | `/api/tasks/:id` | write | Đổi trạng thái / dời lịch |
| POST | `/api/activities` | write | Ghi kết quả chăm |
| PATCH | `/api/settings` | owner | Đổi tên/settings |
| POST | `/api/members` | owner | Mời thành viên |
| DELETE | `/api/members/:id` | owner | Thu hồi (không xóa owner) |
| DELETE | `/api/connections/:provider` | self/owner | Ngắt Drive/Calendar |
| GET | `/api/backup/export` | owner | Tải JSON |
| POST | `/api/backup/drive` | owner | Sao lưu Drive |
| POST | `/api/calendar/sync` | member có Calendar | Đẩy lịch một chiều |

## Kênh (PR #1/#2)

| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET/POST/DELETE | `/api/channels/connections` (chi tiết theo implementation PR) | owner | Kết nối/ngắt Meta/Zalo |
| GET | `/api/channels/messages?customer_id=` | read | Hội thoại theo khách |
| POST | `/api/channels/messages` | write | Gửi trả lời |
| POST | `/api/channels/identities/link` | write | Gắn identity thủ công |
| POST | `/api/customers/merge` | owner/assistant theo policy | Gộp hồ sơ |
| GET/PATCH | `/api/merge-suggestions` | owner/assistant | Xem/chấp nhận/bỏ gợi ý |
| GET | `/webhooks/meta` | Meta verify | Hub challenge |
| POST | `/webhooks/meta` | Meta signed | Inbound Messenger/IG |
| POST | `/webhooks/zalo` | Zalo MAC | Inbound OA |

> Chi tiết payload chính xác sẽ bám theo module `server/meta.mjs`, `server/zalo.mjs`, `server/channels.mjs` trên nhánh PR khi implement. Mọi response lỗi dùng message tiếng Việt + HTTP status phù hợp (400/401/403/404/409/503).

## Lỗi chuẩn

```json
{"error": "Mô tả tiếng Việt"}
```

Thiếu cấu hình backend (trừ `/api/config`): **503**.
