# Hiến pháp Mayhomes CRM

## Nguyên tắc cốt lõi

### I. Spec trước, code sau
Mọi thay đổi nghiệp vụ có ý nghĩa phải bắt đầu bằng đặc tả (spec), rồi kế hoạch kỹ thuật, rồi danh sách nhiệm vụ. Không triển khai tính năng mới khi chưa có `spec.md` và `plan.md` tương ứng trong `specs/`. Spec mô tả *cái gì* và *vì sao*; plan mô tả *làm thế nào*.

### II. Cách ly đa không gian là bất biến
Một mã nguồn phục vụ nhiều không gian (workspace) riêng. Mọi dữ liệu khách, công việc, hoạt động, kết nối và tin nhắn kênh phải bị ràng buộc theo `workspace_id`. PostgreSQL RLS (FORCE) là lớp phòng thủ bổ sung, không thay thế kiểm tra membership/vai trò ở API. Runtime DB role không được superuser và không có BYPASSRLS.

### III. Bảo mật dữ liệu khách hàng thật
Không bao giờ commit secrets, token OAuth, hoặc dữ liệu khách thật vào Git. Token Google/Meta/Zalo/TikTok được mã hóa AES-256-GCM bằng `ENCRYPTION_KEY`. Session dùng cookie HttpOnly. Không yêu cầu người dùng nhập mật khẩu/cookie/token bên thứ ba — chỉ OAuth/API chính thức. Chế độ trải nghiệm (demo) phải rõ ràng không phải production. Web Push chỉ gửi sự kiện đã được phép trong không gian; không lộ nội dung nhạy cảm trên lock screen nếu có thể rút gọn.

### IV. Phân quyền rõ ràng, kiểm tra lại mỗi request
Ba vai trò không gian: `owner` (toàn quyền trong không gian), `assistant` (đọc/ghi khách được giao), `viewer` (chỉ đọc khách được giao). Platform admin chỉ quản lý metadata không gian (gồm khóa/mở không gian), không tự đọc dữ liệu khách nếu chưa là thành viên. Membership được kiểm tra lại trên mọi API có ngữ cảnh không gian. Không gian `active=false` từ chối ghi nghiệp vụ và thông báo rõ trên UI.

### V. Mobile-first PWA (SvelteKit)
Giao diện chính là **SvelteKit**, thiết kế **mobile-first**, đóng gói **PWA cài được** (manifest + service worker). Ưu tiên thao tác một tay trên điện thoại sale hiện trường. Offline: **cache xem** (đọc dữ liệu đã tải / shell app); thao tác ghi khi offline phải xếp hàng hoặc báo chưa khả dụng — không giả lưu thành công. **Web Push** thông báo tin Fanpage/Zalo mới (và kênh đã bật). Mọi màn hình mới phải đạt layout mobile trước desktop.

### VI. Giữ backend đơn giản, có kiểm thử
Backend giữ **Node.js + PostgreSQL**. Tách mã nguồn dễ đọc. Mọi migration idempotent và có chiến lược rollback. `npm run check` (API/tests) và build/check frontend phải xanh trước khi coi giai đoạn hoàn tất. Test cách ly tenant dùng PGlite hoặc tương đương, không đụng DB production.

## Ràng buộc sản phẩm

- Giao diện và thông báo người dùng bằng tiếng Việt.
- Tên miền dự kiến: `crm.mayhomes.com.vn`. Không đụng website/email domain gốc `mayhomes.com.vn`.
- Không gian chỉ cấp theo lời mời (platform admin tạo), không đăng ký công khai.
- Backup Drive là JSON metadata không gian; **restore chỉ sau preview + xác nhận tường minh**; không gửi lại sự kiện/tin từ backup tự động.
- Kênh messaging chính thức (Fanpage / Zalo OA / Instagram nhận cơ bản / TikTok Lead), không dùng cookie tài khoản cá nhân.
- **Hộp thư tổng hợp đa kênh** (Fanpage + Zalo + Instagram) nằm trong phạm vi; kho sản phẩm / nhiều cơ hội per khách **hoãn** sang giai đoạn sau.
- Bản đầu theo dõi một nhu cầu chính/khách (chưa có bảng cơ hội/sản phẩm độc lập).

## Quy trình phát triển

1. Cập nhật/viết spec → làm rõ `[NEEDS CLARIFICATION]` với chủ sở hữu sản phẩm.
2. Viết plan + data-model + contracts.
3. Sinh tasks theo user story; ưu tiên MVP độc lập kiểm thử được.
4. Triển khai theo phase; không nhảy phase khi foundational chưa xong.
5. Converge: đối chiếu code với artifacts; bổ sung task còn thiếu thay vì sửa thầm yêu cầu.

## Quản trị

Hiến pháp này đứng trên thói quen ad-hoc. Sửa đổi phải ghi version, ngày, lý do. Mọi PR/review liên quan CRM phải kiểm tra tuân thủ cách ly workspace, mã hóa token, tiếng Việt UI, và mobile-first PWA. Complexity mới (queue, microservice, đổi backend) cần biện minh trong Complexity Tracking của plan. Việc chọn SvelteKit PWA đã được chủ sở hữu phê duyệt (2026-11-04) và ghi trong plan.

**Version**: 1.1.0 | **Ratified**: 2026-11-04 | **Last Amended**: 2026-11-04
