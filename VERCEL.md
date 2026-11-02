# Triển khai Mayhomes CRM lên Vercel

## 1. Import repository

1. Đăng nhập Vercel, chọn **Add New → Project**.
2. Import `thienvu1108/crm`, nhánh `main`.
3. Chọn Framework **Other**, Root Directory giữ ở gốc repository.
4. Cấu hình đã có trong `vercel.json`: build `npm run check`, output `dist`, API tại `api/index.mjs`. Không dùng Dockerfile hoặc đặt output là thư mục mã nguồn.
5. Chọn Node.js **24.x**. Giữ cài dependency mặc định, bao gồm dev dependencies để chạy tests khi build.
6. Deploy. Nếu chưa đặt các biến môi trường backend, giao diện vẫn cho trải nghiệm bằng dữ liệu giả; API ghi và đăng nhập thật sẽ chưa hoạt động.

## 2. Database PostgreSQL

Dùng PostgreSQL ngoài (ví dụ nhà cung cấp qua Vercel Marketplace). Cần:

- Database riêng cho production và staging.
- Kết nối pooled/TLS theo hướng dẫn nhà cung cấp. Runtime pool giới hạn 3 kết nối mỗi instance, được gắn `attachDatabasePool`.
- Chạy `npm run db:migrate` bằng tài khoản migration qua máy local hoặc tác vụ quản trị an toàn; không tự chạy migration trong mỗi request/build preview.
- Role dùng cho `DATABASE_URL` của runtime không có superuser/BYPASSRLS; cấp quyền bảng cần thiết. Không đưa role quản trị database vào runtime.
- Backup database của nhà cung cấp, ngoài bản sao lưu Drive.

Không có database bền vững trong filesystem của Vercel Function. Dữ liệu khách nằm trong PostgreSQL.

## 3. Environment Variables

Trong **Project → Settings → Environment Variables**, nhập cho đúng môi trường:

| Tên | Giá trị |
|---|---|
| `APP_ORIGIN` | URL chuẩn đang sử dụng, ví dụ `https://crm.mayhomes.com.vn` |
| `DATABASE_URL` | Connection string PostgreSQL của role runtime |
| `ENCRYPTION_KEY` | Khóa ngẫu nhiên 32 bytes, base64; tạo và giữ trong secrets |
| `GOOGLE_CLIENT_ID` | Google OAuth Web client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `PLATFORM_ADMIN_EMAILS` | Gmail quản trị nền tảng đã chọn |
| `JOB_SECRET` | Bí mật riêng cho tác vụ sao lưu từ scheduler, nếu bật |
| `NODE_ENV` | `production` |

Không nhập secret vào GitHub, giao diện demo hoặc chat. Redeploy sau khi đổi cấu hình.

Thiếu bất kỳ biến backend bắt buộc nào: `/api/config` trả `mode: demo`; API nghiệp vụ trả 503, không giả lập lưu database thành công. Đã cấu hình đủ nhưng database chưa migrate/kết nối sai: API báo lỗi, không chuyển dữ liệu thật sang localStorage.

## 4. Google OAuth

Bật Google Drive API/Calendar API và tạo OAuth client loại Web. Đăng ký callback khớp domain:

`https://crm.mayhomes.com.vn/auth/google/callback`

Nếu thử trên domain `.vercel.app`, đăng ký callback cho domain đó và đổi `APP_ORIGIN` khớp. Preview deployment không tự được cấp quyền production. Dùng secrets/database riêng cho Preview nếu cần kiểm thử backend.

## 5. Gắn tên miền Tenten

1. **Project → Settings → Domains → Add Domain**: `crm.mayhomes.com.vn`.
2. Vercel trả bản ghi cần tạo; sao chép chính xác tên/loại/giá trị.
3. Tại Tenten, thêm bản ghi DNS cho `crm`; giữ nguyên bản ghi domain gốc và email.
4. Đợi Vercel xác nhận DNS/HTTPS, cập nhật `APP_ORIGIN` và Google callback, redeploy.

Custom hostname cho từng sale còn phải được đăng ký và xác minh TXT trong CRM. Đồng thời thêm domain đó trong Vercel và callback Google tương ứng. Không tự tạo domain cho mọi workspace.

## 6. Tác vụ nền

Vercel Functions có thời lượng thực thi giới hạn. Bản đầu không cấu hình cron tự động: backup dùng endpoint POST `/api/jobs/backups` với bearer `JOB_SECRET` từ scheduler ngoài. Không gắn trực tiếp endpoint POST vào Vercel Cron GET. Khi tăng số không gian, cần queue/chia lô để tránh quá thời lượng; không dùng một request dài để sao lưu tất cả.

## 7. Kiểm thử trước dữ liệu thật

- Build và GitHub Actions qua; trang chủ, CSS, JS và `/api/config` phản hồi đúng.
- Gmail quản trị tạo được không gian và cấp quyền cho Gmail sale.
- Hai tài khoản chỉ nhìn thấy dữ liệu được cấp, không mở chéo bằng API/URL.
- OAuth Drive/Calendar thật, backup JSON tải được và lịch chỉ tạo/cập nhật đúng công việc liên kết.
- Kiểm tra log Vercel không ghi secret hoặc nội dung khách nhạy cảm.

Chưa có tài khoản/dịch vụ Vercel được kết nối thì việc chuẩn bị source không có nghĩa đã deploy thành công.
