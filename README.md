# Mayhomes CRM — v0.1.0

Website CRM tiếng Việt cho sale bất động sản. Một mã nguồn, nhiều không gian riêng. Repository đích: https://github.com/thienvu1108/crm. Tên miền dự kiến: `crm.mayhomes.com.vn`.

## Trạng thái bản đầu

- Giao diện responsive: tổng quan, hồ sơ khách, lọc/tìm kiếm, lịch chăm, nhật ký, dời lịch, giai đoạn giao dịch, báo cáo, thành viên và quản trị không gian.
- Chế độ trải nghiệm hoạt động không cần máy chủ; lưu dữ liệu mẫu vào localStorage theo không gian. Đây không phải cơ chế bảo mật hay dữ liệu production.
- Máy chủ Node.js + PostgreSQL: đăng nhập Google (OAuth code + PKCE), session HttpOnly, không gian theo lời mời, phân quyền phía máy chủ, lịch sử thay đổi, chống trùng số điện thoại trong từng không gian.
- Chủ không gian cấp quyền Drive để sao lưu JSON. Người dùng cấp quyền Calendar để đẩy lịch một chiều bằng nút đồng bộ. Không tự gửi lời mời lịch cho khách.
- Có endpoint sao lưu nền để scheduler ngoài gọi. Chưa tự thiết lập scheduler, thời hạn giữ bản hoặc phục hồi tự động.
- Meta Fanpage (Messenger) và Zalo OA: kết nối chính thức theo không gian (OAuth hoặc token), webhook nhận tin, trả lời trong hồ sơ khách. TikTok vẫn là màn hình hướng dẫn. Tài khoản cá nhân theo dõi chăm sóc thủ công, không đồng bộ inbox.
- Bản đầu theo dõi một nhu cầu chính/khách; chưa có bảng cơ hội nhiều nhu cầu hoặc kho sản phẩm độc lập.
- Chưa có UI upload tài liệu Drive hoặc khôi phục backup. Bản sao lưu có danh sách dữ liệu, không sao chép nội dung file bên ngoài.
- Bản Sites là bản demo tĩnh, riêng tư; backend Node/PostgreSQL không chạy trên Sites. Không nhập thông tin thật vào demo.

## Chạy bản trải nghiệm

Node.js 24:

```sh
node server/preview.mjs
```

Mở http://127.0.0.1:3000 rồi chọn “Trải nghiệm với dữ liệu mẫu”.

## Chạy máy chủ thật

1. Chuẩn bị Node.js 24 và PostgreSQL. Tenten là nhà cung cấp tên miền, chưa xác định gói hosting hiện có có hỗ trợ Node.js/process chạy nền hay không. Nếu chỉ có shared hosting PHP, cần VPS/container hoặc dịch vụ Node riêng.
2. `npm ci`.
3. Sao chép `.env.example` thành `.env`, điền bí mật trong hosting/secret manager; không commit `.env`.
4. `npm run db:migrate` bằng tài khoản migration.
5. Cấp quyền cho role ứng dụng **không phải superuser và không có BYPASSRLS**. Role runtime cần SELECT/INSERT/UPDATE/DELETE trên các bảng của CRM. Không dùng tài khoản quản trị PostgreSQL cho runtime. FORCE RLS được bật trên bảng dữ liệu khách.
6. `npm start` hoặc build Dockerfile. Reverse proxy phải giữ Host gốc. Thiết lập HTTPS ở proxy, không bật cache cho `/api` và `/auth`.
7. Đăng nhập bằng Gmail thuộc `PLATFORM_ADMIN_EMAILS`, mở Quản trị nền tảng, tạo không gian và chỉ định Gmail chủ sở hữu. Không gian chỉ cấp theo lời mời, không đăng ký công khai.
8. Chủ sở hữu đăng nhập, kết nối Drive/Calendar khi cần.

`APP_ORIGIN` là cổng chung. Dùng `https://crm.mayhomes.com.vn` khi triển khai thật. Với hostname đã xác minh, OAuth dùng callback trên chính hostname đó và cookie riêng theo host; phải đăng ký thêm từng callback trong Google OAuth client. Không hỗ trợ wildcard callback hoặc SSO phiên đăng nhập xuyên domain.

### Google Cloud

- Tạo OAuth client loại Web Application; bật Google Drive API và Google Calendar API.
- Authorized redirect URI: `https://crm.mayhomes.com.vn/auth/google/callback`; local: `http://localhost:3000/auth/google/callback`.
- Đăng nhập xin `openid email profile`. Drive xin riêng `drive.file`. Calendar xin riêng `calendar.app.created`, chỉ quản lý lịch do ứng dụng tạo.
- Cấu hình consent screen, người dùng thử và các yêu cầu xác minh/xuất bản tương ứng trước khi mở rộng cho người ngoài. Phải kiểm thử refresh token và vòng đời quyền trong cấu hình ứng dụng thực tế.
- Google account khi cấp quyền Drive/Calendar phải là cùng account đang đăng nhập CRM. Không yêu cầu user nhập mật khẩu, cookie hoặc token.
- Drive của chủ không gian lưu backup toàn không gian. Calendar gắn với từng người và chỉ nhận công việc người đó được phép xem.
- Token được mã hóa AES-256-GCM bằng `ENCRYPTION_KEY`. Sao lưu khóa bằng hệ thống secrets riêng, không đưa vào backup dữ liệu CRM.

### DNS tại Tenten

- Không thay đổi website hoặc email ở domain gốc `mayhomes.com.vn`.
- Tạo bản ghi `crm` trỏ về địa chỉ do hosting thực tế cung cấp: A tới IP VPS hoặc CNAME tới hostname của nền tảng. Chỉ điền khi biết đích thật, không dùng giá trị minh họa.
- Cấp SSL/TLS, cấu hình APP_ORIGIN và Google callback khớp chính xác.
- Bản đầu dùng cổng chung và bộ chọn không gian, đồng thời có đăng ký hostname và kiểm tra TXT DNS trong trang quản trị. Hostname xác minh ánh xạ về đúng không gian ở phía máy chủ. Cần trỏ DNS, cấp HTTPS ở hosting và thêm từng OAuth callback theo hostname trước khi sử dụng. Chưa tự cấp HTTPS hoặc thay đổi DNS; chưa kiểm thử OAuth trên domain thật.
- Tên miền con hiển thị trong demo chỉ là ví dụ, chưa được tạo trên DNS.


## Kết nối Facebook Fanpage và Zalo OA

Chỉ **chủ không gian** được kết nối. Không hỗ trợ đăng nhập cookie/tài khoản cá nhân.

### Biến môi trường thêm

- `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
- `ZALO_APP_ID`, `ZALO_APP_SECRET` (và tùy chọn `ZALO_OA_SECRET` nếu không lưu OA secret theo từng kết nối)

Webhook công khai (cần HTTPS trên domain thật):

- Meta: `https://crm.mayhomes.com.vn/webhooks/meta`
- Zalo: `https://crm.mayhomes.com.vn/webhooks/zalo`

Token Page/OA được mã hóa AES-256-GCM bằng `ENCRYPTION_KEY`, giống token Google.

### Meta (Facebook Page / Messenger)

1. Tạo ứng dụng tại [Meta for Developers](https://developers.facebook.com/), thêm sản phẩm **Messenger** và **Webhooks**.
2. Cấu hình Webhook URL như trên, Verify Token trùng `META_WEBHOOK_VERIFY_TOKEN`, đăng ký field `messages` (và tùy chọn postbacks/deliveries).
3. Xin quyền `pages_messaging`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`. App ở chế độ Development chỉ nhắn được với role trên app; khi mở cho khách thật cần **App Review**.
4. Authorized redirect URI: `https://crm.mayhomes.com.vn/auth/meta/callback` (và localhost nếu cần).
5. Trong CRM → Kết nối kênh → Facebook Page: dùng **OAuth** (chọn Fanpage) hoặc dán **Page ID + Page Access Token**.
6. Hệ thống cố gắng gọi `subscribed_apps` cho Page; nếu Meta từ chối vì chưa duyệt quyền, vẫn lưu token và cần hoàn tất subscription trên dashboard Meta.
7. Tin đến tạo/ghép khách theo PSID, ghi hoạt động, hiện hội thoại trong hồ sơ. Trả lời dùng Send API trong **khung 24 giờ**. Instagram Messaging dùng chung webhook `object=instagram` nếu Page đã gắn IG và đủ quyền (hỗ trợ nhận/hiển thị cơ bản).

### Zalo Official Account

1. Tạo ứng dụng trên [Zalo for Developers](https://developers.zalo.me/), liên kết với OA, bật quyền gửi tin tư vấn và nhận sự kiện tin nhắn.
2. Đặt Webhook URL như trên; bật sự kiện `user_send_text` (và các `user_send_*` cần thiết). Không bật lọc cú pháp nếu muốn nhận mọi tin.
3. OAuth v4 (PKCE): trong CRM chọn **Chuẩn bị OAuth v4**, lấy `callback` + `code_challenge`, gắn vào Console nếu bắt buộc, rồi mở link cấp quyền cho admin OA. Callback: `https://crm.mayhomes.com.vn/auth/zalo/callback`.
4. Hoặc lấy Access/Refresh token từ **API Explorer**, vào CRM → nhập OA ID, token, refresh token và **OA Secret Key** (dùng tính MAC `X-ZEvent-Signature`).
5. Access token ~25 giờ; CRM tự làm mới bằng refresh token (dùng một lần, xoay vòng). Tin tư vấn Open API thường trong **khung 7 ngày** kể từ tương tác cuối.
6. Khách mới được tạo theo Zalo `user_id`, nguồn “Zalo OA”.


### Khớp khách và gộp hồ sơ

- Tin đến được quét số điện thoại Việt Nam (`0…` / `+84…`). Nếu trong cùng không gian đã có khách cùng SĐT (sau chuẩn hóa), hệ thống **gắn identity kênh** vào hồ sơ đó.
- Lead tự tạo từ Fanpage/Zalo (hồ sơ trống) sẽ được **gộp mềm** vào khách có sẵn; nếu lead đã có dữ liệu chăm sóc, CRM tạo **gợi ý gộp** để sale duyệt — không xóa thầm dữ liệu.
- Zalo: khi OA được quyền và user đã chia sẻ, CRM đọc `shared_info.phone` / tên / avatar từ API chi tiết người dùng.
- Meta: lấy tên và ảnh đại diện theo PSID khi còn trống trên hồ sơ.
- Một khách có thể gắn nhiều identity (Messenger, Instagram, Zalo OA); hồ sơ hiển thị danh sách kênh, cho phép **gắn hội thoại thủ công** và **gộp hai hồ sơ trùng** (chuyển tin nhắn, identity, hoạt động, lịch; giữ nhật ký; hồ sơ cũ đánh dấu `merged_into`).

### Giới hạn bản này

- Một Fanpage và một Zalo OA cho mỗi không gian.
- Chỉ tin văn bản (đính kèm hiển thị là “[Đính kèm]”).
- Chưa có hộp thư tổng hợp đa kênh ngoài hồ sơ khách; chưa có Instagram gửi tin chuyên biệt hay TikTok Lead API.
- Cần hoàn tất App Review / duyệt quyền Zalo trước khi nhận khách thật ngoài tài khoản thử nghiệm.

## Phân quyền

- Platform admin: xem/tạo metadata không gian; không tự đọc dữ liệu khách nếu chưa là thành viên. Giao diện khóa/mở không gian chưa có trong bản đầu.
- Owner: toàn bộ dữ liệu trong không gian, thành viên, phân công khách, xuất và sao lưu.
- Assistant: chỉ đọc/ghi khách được giao, tạo công việc và ghi kết quả; không xuất dữ liệu/sao lưu/quản lý thành viên.
- Viewer: chỉ đọc khách được giao.
- Membership kiểm tra lại ở mỗi API request. Khi thu hồi membership, phiên Google còn đăng nhập nhưng không thể vào không gian đã bị thu hồi.
- Quyền CRM không thay thế quyền chia sẻ file Google Drive. Người dùng giữ quyền quản lý bản sao trong Drive của họ.

## Backup

Chủ không gian dùng “Tải bản JSON” hoặc “Sao lưu lên Drive”. Endpoint scheduler:

```http
POST /api/jobs/backups
Authorization: Bearer <JOB_SECRET>
```

Cấu hình scheduler ngoài chạy mỗi ngày. Token scheduler không đi vào frontend hoặc GitHub. Bản đầu trả kết quả từng không gian, không tự gửi thông báo, thử lại hay dọn bản cũ. Cần thêm giám sát scheduler, chính sách giữ bản và backup database độc lập ở nhà cung cấp trước khi dùng production. Endpoint có thể cần tách thành queue khi số không gian tăng.

Không tự khôi phục hoặc gửi lại sự kiện/tin nhắn từ backup. Cần xây bước xem trước và xác nhận trước khi có chức năng restore.

## Kiểm tra

```sh
npm run check
```

Test hiện có kiểm tra mã hóa và chống sửa token, chuẩn hóa số điện thoại, quyền vai trò và xác thực dữ liệu. Kiểm tra cách ly dữ liệu chạy PostgreSQL nhúng bằng PGlite, không kết nối hoặc sửa dữ liệu thật. Test browser mẫu đã kiểm tra thêm khách/ghi chăm/lưu lại và chuyển không gian. Chưa xác minh OAuth thật, Google API thật, DNS/SSL hoặc vận hành database production khi chưa có credentials.

## GitHub và triển khai

**Vercel:** source đã có adapter API, `vercel.json` và pool PostgreSQL cho môi trường Functions. Xem [VERCEL.md](VERCEL.md) để import repository, cấu hình database, Google OAuth và domain. Khi chưa cấu hình đủ secrets, bản triển khai chỉ mở chế độ trải nghiệm, không nhận dữ liệu thật.

Workflow `.github/workflows/check.yml` chạy kiểm tra khi push/PR. Chưa tự deploy vào Tenten vì chưa có hosting endpoint/credentials. Mã nguồn không chứa dữ liệu khách thật hoặc secrets. Nếu xuất bản từ repo trên hosting, trỏ lệnh start là `npm start`; migration chạy trước khi rollout. Thiết lập dev/staging/production với database và Google OAuth client riêng.

Không tạo bản fork cho từng sale. Tạo workspace trong quản trị. Khách yêu cầu hạ tầng riêng có thể deploy cùng source với database, secrets và domain độc lập.

## Cần hoàn tất trước khi nhận khách thật

- Kiểm thử OAuth, PostgreSQL/RLS và Google API trên staging với role runtime thật.
- Chọn hosting, cấu hình domain, HTTPS và nguồn backup vận hành.
- Kiểm thử xác minh TXT, định tuyến hostname, HTTPS và Google callback trên từng domain trước khi kích hoạt.
- Theo dõi lỗi, giới hạn request theo người dùng ở proxy, timeout và queue cho tác vụ đồng bộ.
- Thêm kiểm thử đồng thời và kiểm tra quyền truy cập khi mở rộng chức năng.

Không xem bản demo là hệ thống đã sẵn sàng xử lý dữ liệu khách hàng thật.
