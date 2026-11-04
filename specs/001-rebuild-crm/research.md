# Nghiên cứu: Baseline & quyết định rebuild

**Date**: 2026-11-04 | **Feature**: 001-rebuild-crm

## 1. Hiện trạng (`main`)

- FE vanilla `dist/app.js` (~57KB) — sẽ **thay bằng SvelteKit `web/`**.
- Backend Node nén trong `server/index.mjs` + Google/security/migrate; DB `001_initial.sql` + RLS.
- Vercel adapter + Dockerfile.
- PR #1 kênh Meta/Zalo; PR #2 identity/merge (chưa merge main).

## 2. Quyết định đã chốt (Phong, 2026-11-04)

| Chủ đề | Quyết định |
|---|---|
| Backend | Giữ Node.js 24 + PostgreSQL |
| Frontend | **SvelteKit**, mobile-first, **PWA** (cài được, offline cache xem, Web Push Fanpage/Zalo) |
| Inbox đa kênh | **IN** (Fanpage + Zalo + Instagram nhận) |
| TikTok Lead | **IN** — tích hợp thật |
| Restore backup | **IN** — preview + confirm |
| Instagram | **Chỉ nhận cơ bản** (không gửi chuyên biệt) |
| UI khóa/mở workspace | **IN** |
| Kho sản phẩm / nhiều cơ hội | **Hoãn** (non-goal giai đoạn này) |

## 3. Còn mở

| Chủ đề | Ghi chú |
|---|---|
| Hosting production | Vercel vs VPS/Docker vs cả hai |
| PR #1/#2 baseline | Merge trước vs tái hiện trong rebuild |
| RLS hardening | Siết audit/memberships/domains? |
| Backup job | Đồng bộ vs queue |

## 4. PWA / Push notes

- Dùng `@vite-pwa/sveltekit` (hoặc Workbox) cho precache shell + runtime cache GET idempotent.
- Offline: đọc cache; mutation → fail rõ hoặc outbox (outbox optional MVP: báo offline đủ).
- Web Push: lưu `push_subscriptions`; server gửi khi inbound Meta/Zalo; payload rút gọn tiếng Việt.
- iOS: PWA push cần phiên bản/OS hỗ trợ; document giới hạn trong README.

## 5. Alternatives rejected

- Giữ vanilla: bị Phong bác vì thiếu PWA/mobile-first bền.
- React/Vue: không chọn; SvelteKit đã chốt.
- Làm nhiều cơ hội/sản phẩm ngay: hoãn để tập trung kênh + PWA + restore.
