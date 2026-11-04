# Nghiên cứu: Baseline Mayhomes CRM & quyết định rebuild

**Date**: 2026-11-04 | **Feature**: 001-rebuild-crm

## 1. Hiện trạng mã nguồn (`main`)

- **Frontend**: `dist/app.js` (~57KB) + `style.css` + `index.html` — SPA vanilla tiếng Việt: Tổng quan, Khách hàng, Lịch hẹn, Báo cáo, Hồ sơ, Cài đặt, Quản trị nền tảng, Kết nối kênh (placeholder Meta/Zalo/TikTok trên main).
- **Backend**: `server/index.mjs` (~25KB, ít xuống dòng) gom router/API; `google.mjs`, `security.mjs`, `migrate.mjs`, `preview.mjs`.
- **DB**: `database/001_initial.sql` — users, workspaces, memberships, domains, sessions, oauth_states, customers, tasks, activities, connections, calendar_links, audit_log + RLS.
- **Deploy**: Vercel (`api/index.mjs`, `vercel.json`), Dockerfile, `VERCEL.md`.
- **Test**: security, tenant-isolation (PGlite), vercel-adapter.

## 2. PR chưa merge (hành vi cần đưa vào đặc tả)

### PR #1 `feat/meta-zalo-oa-channels`
- Bảng `channel_connections`, `channel_routes`, `channel_identities`, `channel_messages` + RLS.
- Meta OAuth/Page token, webhook verify + `X-Hub-Signature-256`, Send API 24h.
- Zalo OAuth v4 PKCE / token thủ công, refresh, MAC webhook, gửi tin tư vấn.
- UI kết nối + hội thoại trong hồ sơ; giới hạn 1 Page + 1 OA / workspace; chủ yếu văn bản.

### PR #2 `feat/channel-identity-match-merge` (stack trên #1)
- Khớp SĐT; nhiều identity; avatar/tên; `merge_suggestions`; `customers.merged_into`.
- Gộp thủ công chuyển messages/identities/activities/tasks.

## 3. Quyết định kỹ thuật

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Runtime | Giữ Node.js 24 ESM | Đã có, engines khóa 24.x, Vercel OK |
| DB | Giữ PostgreSQL + `pg` + RLS FORCE | Cách ly tenant đã thiết kế đúng hướng |
| Auth | Giữ Google OAuth PKCE + session hash | Phù hợp sale dùng Gmail; không password |
| FE | Mặc định vanilla; tách module | [NEEDS CLARIFICATION] nếu Phong muốn framework |
| Kênh | Đưa hành vi PR #1+#2 vào phạm vi rebuild | User đã nêu Fanpage+Zalo; PR là nguồn sự thật |
| TikTok | Giữ non-goal hoặc hướng dẫn | Chưa có connector thật |
| Restore | Non-goal trừ khi Phong chọn | README cảnh báo cần preview/confirm |
| Hosting | Hỗ trợ cả Vercel adapter + `npm start` | [NEEDS CLARIFICATION] production chính |

## 4. Rủi ro

- OAuth/domain thật chưa kiểm thử end-to-end trên `crm.mayhomes.com.vn`.
- Meta/Zalo App Review bắt buộc trước khách thật.
- File JS nén khó review → rebuild phải format/module hóa.
- Job backup đồng bộ có thể timeout khi nhiều workspace.

## 5. Alternatives rejected

- Đổi sang Python/Go: chi phí lớn, ít lợi ích tức thì.
- Bỏ RLS chỉ tin app: yếu defense-in-depth.
- Cookie tài khoản cá nhân FB/Zalo: bị từ chối bởi chính sách sản phẩm và rủi ro ToS.
