# Đặc tả tính năng: Làm lại Mayhomes CRM (Spec-Driven)

**Feature Branch**: `speckit/rebuild` (thư mục spec: `001-rebuild-crm`)

**Created**: 2026-11-04

**Status**: Draft

**Input**: Người dùng yêu cầu làm lại `@Crm-Sale` / Mayhomes CRM theo Spec Kit SDD, bao quát toàn bộ chức năng hiện có và các khoảng trống đã biết (README + PR #1 Fanpage/Zalo OA + PR #2 khớp SĐT/gộp hồ sơ).

## Bối cảnh hiện trạng (baseline)

Hệ thống hiện tại (`thienvu1108/crm`, v0.1.0): CRM tiếng Việt cho sale bất động sản; một mã nguồn, nhiều không gian; Node.js 24 + PostgreSQL; frontend vanilla trong `dist/`; Google OAuth (PKCE) + session; Drive backup + Calendar sync một chiều; demo localStorage khi thiếu secrets; triển khai Vercel Functions có sẵn. PR mở: #1 kênh Meta/Zalo; #2 khớp identity/gộp hồ sơ (chưa merge vào `main`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nền tảng đa không gian & đăng nhập Google (Priority: P1)

Quản trị nền tảng đăng nhập bằng Gmail trong danh sách admin, tạo không gian và chỉ định owner. Owner/assistant/viewer đăng nhập Google, chọn không gian được mời, làm việc trong phạm vi quyền. Người lạ không tự đăng ký không gian.

**Why this priority**: Không có auth/workspace thì không có dữ liệu thật an toàn.

**Independent Test**: Tạo 2 không gian, 3 vai trò; xác minh cách ly membership và cookie session.

**Acceptance Scenarios**:

1. **Given** platform admin đã cấu hình, **When** tạo không gian với owner_email, **Then** workspace + membership owner được tạo, audit ghi nhận.
2. **Given** user chưa là thành viên, **When** gọi API dữ liệu không gian, **Then** bị từ chối; Google session vẫn còn nhưng không vào được không gian đã thu hồi.
3. **Given** thiếu secrets backend, **When** mở `/api/config`, **Then** `mode: demo` và API ghi trả 503 rõ ràng.

---

### User Story 2 - Hồ sơ khách & chăm sóc cốt lõi (Priority: P1)

Sale thêm/sửa khách (tên, SĐT chống trùng trong không gian, email, nguồn, mức quan tâm, giai đoạn giao dịch, ngân sách, khu vực, nhu cầu, ghi chú, người phụ trách). Tạo lịch chăm (gọi/nhắn/xem nhà), ghi kết quả, dời lịch. Tổng quan và báo cáo phản ánh số liệu thật của không gian.

**Why this priority**: Đây là giá trị nghiệp vụ chính của CRM sale BĐS.

**Independent Test**: CRUD khách + task + activity trong một workspace; assistant chỉ thấy khách được giao.

**Acceptance Scenarios**:

1. **Given** owner trong không gian, **When** thêm khách trùng SĐT đã chuẩn hóa, **Then** hệ thống từ chối với lỗi rõ.
2. **Given** assistant được giao khách A, **When** truy cập khách B không được giao, **Then** bị chặn.
3. **Given** có task đến hạn, **When** mở Tổng quan / Lịch hẹn, **Then** thấy việc cần chú ý, quá hạn, sắp tới đúng ngữ cảnh.
4. **Given** cập nhật giai đoạn (new→…→won/lost), **When** lưu, **Then** stage được kiểm tra enum và audit/history phù hợp.

---

### User Story 3 - Thành viên, cài đặt không gian & tên miền (Priority: P2)

Owner mời/thu hồi thành viên (assistant/viewer), đổi tên không gian. Platform admin gắn hostname, xác minh TXT DNS `_mayhomes-verification.<host>`, định tuyến hostname đã xác minh về đúng không gian. UI khóa/mở không gian [NEEDS CLARIFICATION: có đưa vào bản rebuild này không?].

**Why this priority**: Cần để vận hành nhiều đội sale và brand riêng, nhưng sau lõi CRM.

**Independent Test**: Thêm member, thu hồi, xác minh DNS giả lập; kiểm tra OAuth callback theo hostname đã verify.

**Acceptance Scenarios**:

1. **Given** owner, **When** thêm membership assistant, **Then** user đó vào được không gian với quyền hạn chế.
2. **Given** hostname chưa verify, **When** kiểm tra DNS sai token, **Then** vẫn `verified=false` và thông báo tiếng Việt.
3. **Given** hostname đã verify, **When** truy cập host đó, **Then** cookie/OAuth gắn host đó; không SSO xuyên domain.

---

### User Story 4 - Sao lưu Drive & đồng bộ Calendar (Priority: P2)

Owner cấp quyền Drive (`drive.file`), tải JSON hoặc sao lưu lên Drive; scheduler ngoài gọi `POST /api/jobs/backups` với `JOB_SECRET`. User cấp Calendar (`calendar.app.created`) và bấm đồng bộ đẩy task mình được phép xem sang Google Calendar (một chiều, không mời khách).

**Why this priority**: An toàn vận hành và lịch làm việc hàng ngày; phụ thuộc Google đã có.

**Independent Test**: Mock Google API; export JSON; tạo/cập nhật calendar link theo task.

**Acceptance Scenarios**:

1. **Given** owner đã kết nối Drive, **When** sao lưu, **Then** file JSON xuất hiện trên Drive của owner và token vẫn mã hóa trong DB.
2. **Given** assistant không phải owner, **When** gọi backup/export, **Then** bị từ chối.
3. **Given** user đã kết nối Calendar, **When** sync, **Then** chỉ tạo/cập nhật event do app tạo cho task được phép xem.
4. **Given** chưa có restore UI, **When** user tìm khôi phục, **Then** hệ thống không tự restore thầm [NEEDS CLARIFICATION: có xây preview+confirm restore trong rebuild này không?].

---

### User Story 5 - Kênh Fanpage Messenger & Zalo OA (Priority: P2)

Owner kết nối một Fanpage và một Zalo OA / không gian bằng OAuth chính thức hoặc dán token; webhook nhận tin; tạo/ghép khách; trả lời trong hồ sơ trong khung thời gian nền tảng (Meta 24h, Zalo ~7 ngày). Token mã hóa; chữ ký webhook được kiểm.

**Why this priority**: Đã có PR #1; là kênh lead thật cho sale BĐS Việt Nam.

**Independent Test**: Test chữ ký/parser/PKCE/RLS kênh; giả lập inbound tạo customer + message.

**Acceptance Scenarios**:

1. **Given** Page/OA đã kết nối, **When** webhook tin văn bản hợp lệ, **Then** tạo hoặc gắn khách, lưu `channel_messages`, hiện hội thoại trong hồ sơ.
2. **Given** chữ ký sai, **When** POST webhook, **Then** từ chối, không ghi DB.
3. **Given** ngoài khung nhắn, **When** sale gửi trả lời, **Then** báo lỗi nền tảng rõ ràng bằng tiếng Việt.
4. **Given** Instagram cùng webhook Page, **When** nhận tin, **Then** hiển thị cơ bản [NEEDS CLARIFICATION: có ưu tiên gửi Instagram chuyên biệt không?].

---

### User Story 6 - Khớp SĐT, nhiều identity & gộp hồ sơ (Priority: P3)

Tin đến khớp SĐT (`0…`/`+84…`) hoặc SĐT Zalo đã chia sẻ; gắn nhiều identity (Messenger/IG/Zalo) vào một khách; gợi ý gộp khi xung đột; owner/assistant chấp nhận gộp hoặc gắn thủ công; hồ sơ cũ `merged_into`.

**Why this priority**: Follow-up PR #2; giảm trùng lead nhưng phụ thuộc US5.

**Independent Test**: Bộ test identity-match; merge chuyển messages/tasks/activities; audit giữ lại.

**Acceptance Scenarios**:

1. **Given** khách có SĐT trùng tin Zalo, **When** inbound, **Then** gắn identity, không tạo lead trống mới nếu đã khớp chắc.
2. **Given** hai hồ sơ có dữ liệu xung đột, **When** hệ thống nghi trùng, **Then** tạo `merge_suggestions` pending, không xóa thầm.
3. **Given** chấp nhận gộp, **When** merge, **Then** chuyển quan hệ con, đặt `merged_into`, ẩn hồ sơ nguồn khỏi danh sách active.

---

### User Story 7 - Trải nghiệm demo & tài liệu vận hành (Priority: P3)

Chế độ trải nghiệm không cần server, dữ liệu mẫu localStorage theo không gian giả. README/VERCEL/.env.example tiếng Việt đủ để staging. CI `check.yml` chạy `npm run check`.

**Why this priority**: Onboarding và sales demo, không thay production.

**Independent Test**: `node server/preview.mjs`; mở UI demo; không ghi DB.

**Acceptance Scenarios**:

1. **Given** chưa cấu hình secrets, **When** mở app trên Vercel, **Then** chỉ demo, cảnh báo không nhập dữ liệu thật.
2. **Given** dev chạy preview, **When** thêm khách mẫu, **Then** dữ liệu chỉ nằm localStorage không gian đó.

---

### User Story 8 - Khoảng trống sản phẩm đã biết (Priority: P3 / backlog có điều kiện)

Các khoảng trống README cần quyết định phạm vi rebuild:

- Nhiều cơ hội/nhu cầu trên một khách; kho sản phẩm độc lập.
- UI upload tài liệu Drive; khôi phục backup có preview/confirm.
- Hộp thư tổng hợp đa kênh ngoài hồ sơ khách.
- Connector TikTok Lead (hiện chỉ màn hình hướng dẫn).
- Giám sát scheduler backup, retention, thông báo lỗi, queue khi nhiều workspace.
- UI tạm khóa/mở không gian cho platform admin.
- Rate limit theo user ở proxy; quan sát lỗi (observability).

**Why this priority**: Quan trọng cho production nhưng chưa có trong `main`; cần Phong chọn cái nào vào MVP rebuild.

**Independent Test**: Từng mục nếu được chọn sẽ có spec con hoặc mở rộng FR tương ứng.

**Acceptance Scenarios**:

1. **Given** Phong chọn phạm vi, **When** cập nhật spec, **Then** các mục không chọn chuyển Explicit Non-Goals.

---

### Edge Cases

- User bị thu hồi membership giữa phiên: API tiếp theo 403, không lộ dữ liệu.
- SĐT nhập `+84`, `84`, có dấu cách/ký tự: chuẩn hóa về `0…` trước khi unique.
- Webhook trùng `external_message_id`: idempotent, không nhân bản.
- Refresh token Zalo một lần / xoay vòng: lỗi refresh → status `error` trên connection, UI báo kết nối lại.
- Hostname chưa HTTPS/callback Google: OAuth fail với hướng dẫn tiếng Việt, không partial login.
- Backup job một workspace fail: các workspace khác vẫn chạy; kết quả `success|failed` từng cái.
- Khách đã `merged_into`: không hiện trong danh sách active; deep-link cũ chuyển/ thông báo đã gộp.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST hỗ trợ đăng nhập Google OAuth code + PKCE, session HttpOnly, và đăng xuất hủy session.
- **FR-002**: Hệ thống MUST hỗ trợ nhiều workspace; chỉ platform admin tạo workspace theo lời mời owner_email.
- **FR-003**: Hệ thống MUST thực thi vai trò owner/assistant/viewer trên mọi API có ngữ cảnh workspace.
- **FR-004**: Hệ thống MUST CRUD khách hàng với chống trùng `phone_normalized` trong từng workspace và enum interest/stage hợp lệ.
- **FR-005**: Hệ thống MUST quản lý tasks chăm sóc (call/message/viewing) và activities (call/message/meeting), gồm dời lịch và hoàn tất.
- **FR-006**: Hệ thống MUST cung cấp Tổng quan, danh sách khách (lọc/tìm), Lịch hẹn, Báo cáo, Hồ sơ chi tiết bằng tiếng Việt, responsive.
- **FR-007**: Owner MUST mời/thu hồi thành viên (trừ xóa owner) và cập nhật settings không gian.
- **FR-008**: Platform admin MUST đăng ký hostname + xác minh TXT và định tuyến host đã verify.
- **FR-009**: Owner MUST export JSON và sao lưu Drive; job `POST /api/jobs/backups` dùng `JOB_SECRET`.
- **FR-010**: User MUST kết nối Calendar và đồng bộ một chiều task được phép xem; không tự mời khách.
- **FR-011**: Token Google/Meta/Zalo MUST mã hóa AES-256-GCM; ENCRYPTION_KEY không nằm trong backup JSON.
- **FR-012**: Hệ thống MUST cách ly tenant bằng membership + `app.workspace_id` + FORCE RLS trên bảng dữ liệu khách/kênh.
- **FR-013**: Hệ thống MUST hỗ trợ chế độ demo/localStorage khi backend chưa sẵn sàng, với cảnh báo rõ.
- **FR-014**: Hệ thống MUST tích hợp Fanpage Messenger + Zalo OA (OAuth/token, webhook ký, gửi/nhận văn bản, 1 page + 1 OA / workspace) — baseline lấy từ PR #1.
- **FR-015**: Hệ thống MUST khớp identity theo SĐT, hỗ trợ nhiều identity/khách, gợi ý và gộp hồ sơ — baseline lấy từ PR #2.
- **FR-016**: Hệ thống MUST ghi audit_log các hành động nhạy cảm (tạo workspace, đổi quyền, backup, merge…).
- **FR-017**: Migration SQL MUST idempotent; runtime role không BYPASSRLS.
- **FR-018**: [NEEDS CLARIFICATION: Có đưa kho sản phẩm / nhiều cơ hội per khách vào phạm vi rebuild không?]
- **FR-019**: [NEEDS CLARIFICATION: Có xây restore backup có preview+confirm trong phạm vi này không?]
- **FR-020**: [NEEDS CLARIFICATION: Có xây hộp thư tổng hợp đa kênh (inbox) ngoài hồ sơ khách không?]
- **FR-021**: [NEEDS CLARIFICATION: TikTok Lead API — làm thật, giữ hướng dẫn, hay loại khỏi UI?]
- **FR-022**: [NEEDS CLARIFICATION: Frontend rebuild giữ vanilla JS (`dist/`) hay chuyển framework (React/Vue/Svelte)?]
- **FR-023**: [NEEDS CLARIFICATION: Hosting mục tiêu production — Vercel, VPS/Docker, hay cả hai?]
- **FR-024**: [NEEDS CLARIFICATION: Có merge PR #1/#2 vào baseline trước khi rewrite hay coi là yêu cầu tái hiện trong rebuild?]

### Key Entities

- **User**: Tài khoản Google (sub, email, name).
- **Workspace**: Không gian sale (slug, name, owner_email, active, settings).
- **Membership**: Quan hệ user/email–workspace–role.
- **Domain**: Hostname gắn workspace + trạng thái xác minh TXT.
- **Session / OAuthState**: Phiên đăng nhập và state PKCE.
- **Customer**: Hồ sơ khách BĐS; optional `merged_into`, `avatar_url`.
- **Task / Activity**: Lịch chăm và nhật ký tương tác.
- **Connection / CalendarLink**: Token Drive/Calendar đã mã hóa và liên kết event.
- **ChannelConnection / ChannelRoute / ChannelIdentity / ChannelMessage**: Kết nối OA/Page, định tuyến webhook, định danh người nhắn, hội thoại.
- **MergeSuggestion**: Gợi ý gộp hồ sơ trùng.
- **AuditLog**: Nhật ký hành động.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sale hoàn tất thêm khách + tạo lịch chăm + ghi kết quả trong ≤ 3 phút trên staging.
- **SC-002**: 100% API workspace-scoped từ chối cross-tenant trong bộ test PGlite/RLS.
- **SC-003**: `npm run check` xanh gồm unit/security/tenant/channel (khi bật kênh).
- **SC-004**: Demo mode không ghi PostgreSQL; production mode từ chối hoạt động khi thiếu secrets bắt buộc.
- **SC-005**: Webhook chữ ký sai = 0 bản ghi tin được tạo trong test.
- **SC-006**: Owner khôi phục được bản sao lưu JSON thủ công (download) sau khi xóa dữ liệu thử trên staging (không cần restore tự động nếu chưa chọn FR-019).
- **SC-007**: Tài liệu tiếng Việt đủ để người vận hành cấu hình Google + (nếu có) Meta/Zalo trên staging mà không hỏi lại kỹ thuật cơ bản.

## Assumptions

- Giữ Node.js 24 + PostgreSQL + `pg` trừ khi Phong yêu cầu đổi stack.
- Phạm vi ngôn ngữ UI: tiếng Việt; mã nguồn/comment có thể Việt–Anh lẫn.
- PR #1 và #2 là nguồn sự thật hành vi kênh/identity cần tái hiện, dù chưa merge `main`.
- Không hỗ trợ SSO xuyên domain; mỗi hostname verified có OAuth callback riêng.
- Không gửi email marketing / SMS gateway trong bản rebuild này.
- Không xây app mobile native.
- Dữ liệu mẫu demo không phải dữ liệu khách Mayhomes thật.
