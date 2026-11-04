# Hiến pháp Mayhomes CRM

## Nguyên tắc cốt lõi

### I. Spec trước, code sau
Mọi thay đổi nghiệp vụ có ý nghĩa phải bắt đầu bằng đặc tả (spec), rồi kế hoạch kỹ thuật, rồi danh sách nhiệm vụ. Không triển khai tính năng mới khi chưa có `spec.md` và `plan.md` tương ứng trong `specs/`. Spec mô tả *cái gì* và *vì sao*; plan mô tả *làm thế nào*.

### II. Cách ly đa không gian là bất biến
Một mã nguồn phục vụ nhiều không gian (workspace) riêng. Mọi dữ liệu khách, công việc, hoạt động, kết nối và tin nhắn kênh phải bị ràng buộc theo `workspace_id`. PostgreSQL RLS (FORCE) là lớp phòng thủ bổ sung **bắt buộc trên mọi bảng mang dữ liệu hoặc metadata không gian**, gồm customers/tasks/activities/connections/channel_*/merge_suggestions/push_subscriptions/backup_*/job_*/**audit_log**, **memberships**, **domains** (và bảng tương đương). Không thay thế kiểm tra membership/vai trò ở API. Runtime DB role không được superuser và không có BYPASSRLS.

### III. Bảo mật dữ liệu khách hàng thật
Không bao giờ commit secrets, token OAuth, hoặc dữ liệu khách thật vào Git. Token Google/Meta/Zalo/TikTok được mã hóa AES-256-GCM bằng `ENCRYPTION_KEY`. Session dùng cookie HttpOnly. Chỉ OAuth/API chính thức. Demo không phải production. Web Push rút gọn nội dung trên lock screen khi có thể.

### IV. Phân quyền rõ ràng, kiểm tra lại mỗi request
Ba vai trò: `owner`, `assistant`, `viewer`. Platform admin quản lý metadata không gian (tạo, **khóa/mở**), không tự đọc dữ liệu khách nếu chưa là thành viên. Membership kiểm tra lại mỗi API. Workspace `active=false` từ chối ghi nghiệp vụ.

### V. Mobile-first PWA (SvelteKit)
Giao diện **SvelteKit**, **mobile-first**, **PWA cài được**. Offline: cache xem; ghi offline không giả thành công. Web Push tin Fanpage/Zalo (và kênh bật push).

### VI. Backend Node/PostgreSQL trên Vercel
Backend **Node.js + PostgreSQL** (Vercel Postgres / Neon-compatible). **Production hosting = Vercel** (Functions, Cron). Docker chỉ **tuỳ chọn cho dev local**, không phải đường triển khai chính. Job nền (backup…) dùng **hàng đợi Postgres + Vercel Cron** với retry và giám sát — không vòng lặp đồng bộ dài trong một request.

### VII. Kiểm thử trước khi đóng giai đoạn
Migration idempotent + rollback note. `npm run check` (API) và build/check `web/` phải xanh. Test tenant/RLS bằng PGlite hoặc tương đương.

## Ràng buộc sản phẩm

- UI/thông báo tiếng Việt; domain dự kiến `crm.mayhomes.com.vn`.
- Không gian theo lời mời; kênh chính thức (Fanpage/Zalo/IG nhận/TikTok Lead).
- Inbox đa kênh IN; restore chỉ sau preview+confirm; sản phẩm/nhiều cơ hội **hoãn**.
- Hành vi PR #1/#2 **tái hiện trong rebuild**, không phụ thuộc merge PR trước.

## Quy trình phát triển

1. Spec → làm rõ điểm mơ hồ với chủ sở hữu trước khi plan.
2. Plan + data-model + contracts.
3. Tasks theo user story; MVP độc lập kiểm thử.
4. Implement theo phase; foundational chặn US.
5. Analyze/converge trước khi coi xong.

## Quản trị

Hiến pháp đứng trên thói quen ad-hoc. Sửa đổi ghi version/ngày/lý do. PR phải tuân thủ RLS mở rộng, mã hóa token, PWA mobile-first, Vercel production. SvelteKit PWA, Vercel hosting, queue backup, RLS hardening, tái hiện PR #1/#2 đã được Phong phê duyệt 2026-11-04.

**Version**: 1.2.0 | **Ratified**: 2026-11-04 | **Last Amended**: 2026-11-04
