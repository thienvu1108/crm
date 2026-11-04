# Nghiên cứu — quyết định cuối

**Date**: 2026-11-04

## Đã chốt (Phong 2026-11-04)

| Chủ đề | Quyết định |
|---|---|
| Backend | Node.js 24 + PostgreSQL |
| Frontend | SvelteKit mobile-first PWA (install, offline xem, Web Push) |
| Hosting | **Vercel** + Postgres/Neon-compatible + **Vercel Cron**; Docker **optional dev only** |
| PR #1/#2 | **Tái hiện hành vi trong rebuild**, không merge trước |
| RLS hardening | **IN** — audit_log, memberships, domains |
| Backup | **Postgres job queue** + Cron + retries + monitoring |
| Inbox | IN (Fanpage+Zalo+IG nhận) |
| TikTok Lead | IN thật |
| Restore | IN preview+confirm |
| Instagram | Chỉ nhận |
| Lock workspace UI | IN |
| Sản phẩm / nhiều cơ hội | Hoãn |

## Còn mở
**Không còn câu hỏi mở** cho feature này (mọi quyết định Phong đã đóng).

## Baseline kỹ thuật
- `main` vanilla + server nén; dùng làm tham chiếu hành vi, không giữ FE.
- PR #1/#2 = đặc tả hành vi kênh/identity để viết lại module sạch trên `server/` + tests.

## Alternatives rejected
- VPS primary / Docker primary
- Merge PR rồi mới rebuild
- Backup sync một request
- Bỏ RLS trên audit/memberships/domains
