# Đặc tả tính năng: Làm lại Mayhomes CRM (Spec-Driven)

**Feature Branch**: `speckit/rebuild` (thư mục spec: `001-rebuild-crm`)

**Created**: 2026-11-04

**Status**: Draft

**Input**: Làm lại `@Crm-Sale` / Mayhomes CRM theo Spec Kit SDD. Quyết định Phong (2026-11-04): FE = SvelteKit mobile-first PWA; inbox đa kênh IN; TikTok Lead thật IN; restore preview+confirm IN; Instagram chỉ nhận cơ bản; UI khóa/mở không gian IN; kho sản phẩm/nhiều cơ hội = hoãn.

## Bối cảnh hiện trạng (baseline)

Hệ thống hiện tại (`thienvu1108/crm`, v0.1.0): CRM tiếng Việt cho sale BĐS; Node.js 24 + PostgreSQL; frontend vanilla `dist/`; Google OAuth PKCE; Drive/Calendar; demo localStorage; Vercel adapter. PR mở: #1 Fanpage/Zalo; #2 khớp/gộp identity. Rebuild thay FE bằng **SvelteKit PWA**, giữ backend Node/PG, mở rộng kênh (inbox, TikTok Lead, restore, lock workspace).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nền tảng đa không gian & đăng nhập Google (Priority: P1)

Quản trị nền tảng đăng nhập Gmail admin, tạo không gian, chỉ định owner; **khóa/mở không gian** trên UI quản trị. Owner/assistant/viewer đăng nhập Google, chọn không gian; không gian bị khóa không cho ghi nghiệp vụ.

**Why this priority**: Nền tảng bắt buộc trước dữ liệu thật.

**Independent Test**: Tạo 2 không gian; khóa một không gian → API ghi 403; member ngoài bị từ chối.

**Acceptance Scenarios**:

1. **Given** platform admin, **When** tạo không gian + owner_email, **Then** workspace + membership owner + audit.
2. **Given** admin khóa không gian, **When** member thử tạo khách, **Then** bị từ chối với thông báo tiếng Việt; đọc có thể bị hạn chế theo policy (chỉ metadata/thông báo khóa).
3. **Given** thiếu secrets backend, **When** `/api/config`, **Then** `mode: demo` và API ghi 503.

---

### User Story 2 - Hồ sơ khách & chăm sóc cốt lõi trên PWA mobile-first (Priority: P1)

Sale trên điện thoại thêm/sửa khách, lịch chăm, ghi kết quả, tổng quan/báo cáo. App **cài được (PWA)**; offline **xem** được shell + dữ liệu đã cache; ghi khi offline không giả thành công.

**Why this priority**: Giá trị nghiệp vụ chính + trải nghiệm hiện trường.

**Independent Test**: CRUD trên viewport mobile; cài PWA; bật offline xem danh sách đã tải.

**Acceptance Scenarios**:

1. **Given** owner, **When** thêm khách trùng SĐT chuẩn hóa, **Then** lỗi rõ, không tạo trùng.
2. **Given** assistant được giao A, **When** mở khách B, **Then** bị chặn.
3. **Given** PWA đã cài, **When** offline, **Then** xem được màn đã cache; nút ghi báo chưa khả dụng/hàng đợi theo thiết kế.
4. **Given** cập nhật giai đoạn, **When** lưu online, **Then** enum hợp lệ + phản hồi UI mobile.

---

### User Story 3 - Thành viên & tên miền (Priority: P2)

Owner mời/thu hồi thành viên; platform admin gắn hostname + verify TXT; định tuyến host đã verify.

**Independent Test**: Verify TXT sai/đúng; thu hồi membership.

**Acceptance Scenarios**:

1. **Given** owner thêm assistant, **When** assistant đăng nhập, **Then** vào đúng không gian với quyền hạn chế.
2. **Given** TXT sai, **When** verify, **Then** `verified=false` + thông báo Việt.
3. **Given** host verified, **When** OAuth trên host đó, **Then** callback/cookie theo host; không SSO xuyên domain.

---

### User Story 4 - Sao lưu, khôi phục có xác nhận & Calendar (Priority: P2)

Owner export JSON / sao lưu Drive; job `POST /api/jobs/backups`. **Khôi phục**: tải/chọn bản → **preview diff/tóm tắt** → **confirm** mới ghi đè theo policy. Calendar sync một chiều.

**Independent Test**: Mock Google; restore bị hủy ở bước confirm → DB không đổi; assistant không backup/restore.

**Acceptance Scenarios**:

1. **Given** owner có Drive, **When** sao lưu, **Then** JSON trên Drive; token vẫn mã hóa.
2. **Given** bản backup, **When** preview rồi hủy, **Then** không thay dữ liệu.
3. **Given** confirm restore, **When** hoàn tất, **Then** dữ liệu workspace khớp bản đã chọn (trong phạm vi restore đã định) + audit.
4. **Given** Calendar connected, **When** sync, **Then** chỉ event do app tạo cho task được phép xem.

---

### User Story 5 - Kênh Fanpage, Zalo OA & Instagram nhận cơ bản (Priority: P2)

Kết nối 1 Fanpage + 1 Zalo OA / workspace; webhook; trả lời trong hồ sơ (và inbox). **Instagram**: chỉ **nhận/hiển thị cơ bản** qua webhook Page (không gửi IG chuyên biệt ở bản này). Web Push khi có tin Fanpage/Zalo mới.

**Independent Test**: Test chữ ký/parser; inbound IG lưu/hiện; push subscription mock.

**Acceptance Scenarios**:

1. **Given** Page/OA connected, **When** tin văn bản hợp lệ, **Then** tạo/ghép khách + message + có thể đẩy Web Push cho member được phép.
2. **Given** chữ ký sai, **When** webhook, **Then** từ chối, không ghi DB.
3. **Given** object Instagram trên webhook Page, **When** nhận, **Then** hiện hội thoại cơ bản; không có nút gửi IG chuyên biệt.
4. **Given** ngoài khung Meta 24h / Zalo ~7 ngày, **When** gửi, **Then** lỗi tiếng Việt rõ.

---

### User Story 6 - Khớp SĐT, đa identity & gộp hồ sơ (Priority: P3)

Khớp SĐT; nhiều identity; gợi ý gộp; merge thủ công; `merged_into`.

**Independent Test**: identity-match tests; merge chuyển quan hệ con.

**Acceptance Scenarios**:

1. **Given** SĐT trùng tin Zalo, **When** inbound, **Then** gắn identity khi khớp chắc.
2. **Given** xung đột dữ liệu, **When** nghi trùng, **Then** `merge_suggestions` pending, không xóa thầm.
3. **Given** chấp nhận gộp, **When** merge, **Then** chuyển messages/identities/activities/tasks + `merged_into`.

---

### User Story 7 - Hộp thư tổng hợp đa kênh (Priority: P2)

Một màn **Inbox** mobile-first gom hội thoại Fanpage + Zalo + Instagram (nhận), lọc chưa đọc/theo kênh, mở thread → hồ sơ khách / trả lời (trừ IG gửi).

**Why this priority**: Phong chọn IN scope; sale cần một chỗ xử lý tin thay vì chỉ trong từng hồ sơ.

**Independent Test**: Inbound 3 kênh xuất hiện trong Inbox; lọc theo provider; quyền assignment tôn trọng.

**Acceptance Scenarios**:

1. **Given** tin mới Meta/Zalo/IG, **When** mở Inbox, **Then** thấy thread sắp xếp theo hoạt động mới nhất.
2. **Given** assistant, **When** mở Inbox, **Then** chỉ thread khách được giao (hoặc policy đã ghi).
3. **Given** thread Zalo, **When** trả lời từ Inbox, **Then** tin outbound lưu và hiện ở hồ sơ + Inbox.

---

### User Story 8 - TikTok Lead tích hợp thật (Priority: P2)

Kết nối TikTok Lead chính thức (không cookie cá nhân): nhận lead → tạo/ghép khách + nguồn TikTok; cấu hình trong Kết nối kênh; mã hóa secret.

**Independent Test**: Webhook/lead mock tạo customer; chữ ký/token sai bị từ chối.

**Acceptance Scenarios**:

1. **Given** TikTok connected, **When** lead hợp lệ, **Then** khách mới hoặc khớp theo SĐT/field map + activity/nguồn TikTok.
2. **Given** cấu hình thiếu/sai, **When** thử kết nối, **Then** UI hướng dẫn tiếng Việt, status error.
3. **Given** lead trùng SĐT, **When** inbound, **Then** gắn vào khách có sẵn hoặc gợi ý gộp theo cùng policy identity.

---

### User Story 9 - Demo & tài liệu vận hành (Priority: P3)

Demo khi thiếu secrets; README/VERCEL/SvelteKit PWA docs tiếng Việt; CI check API + build FE.

**Acceptance Scenarios**:

1. **Given** thiếu secrets, **When** mở app, **Then** demo + cảnh báo không nhập dữ liệu thật.
2. **Given** dev máy sạch, **When** theo quickstart, **Then** chạy được API + `web` SvelteKit.

---

### User Story 10 - Khoảng trống hoãn / non-goal giai đoạn này (Priority: —)

- **Kho sản phẩm độc lập** và **nhiều cơ hội/nhu cầu trên một khách**: **hoãn** (non-goal giai đoạn rebuild này).
- Gửi Instagram chuyên biệt: non-goal (chỉ nhận cơ bản).

**Acceptance**: Spec/plan/tasks không lên lịch implement các mục trên trừ khi có spec mới.

---

### Edge Cases

- Workspace locked: mọi POST/PATCH nghiệp vụ 403; UI hiện banner khóa.
- Restore confirm timeout / mất mạng giữa chừng: không để DB nửa vời (transaction).
- Web Push user chưa cấp quyền: Inbox/hồ sơ vẫn hoạt động; không spam xin quyền.
- Offline ghi: không đánh dấu “đã lưu” khi chưa ACK server.
- Webhook trùng id: idempotent.
- TikTok field thiếu SĐT: vẫn tạo lead với cảnh báo thiếu SĐT.
- `merged_into`: ẩn khỏi danh sách active; deep-link báo đã gộp.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MUST đăng nhập Google OAuth code + PKCE, session HttpOnly, đăng xuất hủy session.
- **FR-002**: MUST đa workspace; chỉ platform admin tạo theo lời mời owner_email.
- **FR-003**: MUST thực thi owner/assistant/viewer trên API workspace-scoped.
- **FR-004**: MUST CRUD khách + chống trùng `phone_normalized` + enum interest/stage.
- **FR-005**: MUST tasks (call/message/viewing) + activities (call/message/meeting), dời lịch, hoàn tất.
- **FR-006**: MUST Tổng quan, khách (lọc/tìm), lịch, báo cáo, hồ sơ — **SvelteKit, mobile-first, tiếng Việt**.
- **FR-007**: Owner MUST mời/thu hồi thành viên (trừ owner) và cập nhật settings.
- **FR-008**: Platform admin MUST đăng ký/verify hostname TXT và **khóa/mở không gian trên UI**.
- **FR-009**: Owner MUST export JSON, sao lưu Drive; job backups với `JOB_SECRET`.
- **FR-010**: Owner MUST **restore backup với preview + confirm**; hủy preview = không đổi dữ liệu.
- **FR-011**: User MUST Calendar sync một chiều task được phép xem; không tự mời khách.
- **FR-012**: Token Google/Meta/Zalo/TikTok MUST AES-256-GCM; key không nằm trong backup JSON.
- **FR-013**: MUST cách ly tenant bằng membership + `app.workspace_id` + FORCE RLS.
- **FR-014**: MUST demo mode khi backend chưa sẵn sàng, cảnh báo rõ.
- **FR-015**: MUST Fanpage Messenger + Zalo OA (OAuth/token, webhook, văn bản, 1 page + 1 OA / workspace).
- **FR-016**: MUST Instagram **chỉ nhận/hiển thị cơ bản**; không gửi IG chuyên biệt giai đoạn này.
- **FR-017**: MUST khớp identity theo SĐT, đa identity, gợi ý/gộp hồ sơ (baseline PR #2).
- **FR-018**: MUST **Inbox đa kênh** (Fanpage + Zalo + Instagram nhận) mobile-first.
- **FR-019**: MUST **TikTok Lead tích hợp thật** (nhận lead → CRM).
- **FR-020**: MUST PWA: installable, offline cache xem, Web Push tin Fanpage/Zalo mới (và kênh bật push).
- **FR-021**: MUST audit_log hành động nhạy cảm (workspace lock, restore, merge, backup…).
- **FR-022**: Migration SQL MUST idempotent; runtime role không BYPASSRLS.
- **FR-023**: Frontend MUST là **SvelteKit** (đã quyết định — không còn vanilla/React/Vue).
- **FR-024**: Kho sản phẩm / nhiều cơ hội per khách MUST NOT implement ở giai đoạn này (hoãn).
- **FR-025**: [NEEDS CLARIFICATION: Hosting production chính — Vercel, VPS/Docker, hay cả hai?]
- **FR-026**: [NEEDS CLARIFICATION: Merge PR #1/#2 vào baseline trước rewrite hay tái hiện hành vi trong rebuild?]
- **FR-027**: [NEEDS CLARIFICATION: Có siết RLS thêm cho audit_log / memberships / domains không?]
- **FR-028**: [NEEDS CLARIFICATION: Job backup — giữ vòng lặp đồng bộ hay tách queue khi nhiều workspace?]

### Key Entities

- **User**, **Workspace** (gồm `active` cho khóa/mở), **Membership**, **Domain**
- **Session**, **OAuthState**
- **Customer** (`merged_into`, `avatar_url`), **Task**, **Activity**
- **Connection**, **CalendarLink**
- **ChannelConnection** (meta_page | zalo_oa | tiktok_lead…), **ChannelRoute**, **ChannelIdentity**, **ChannelMessage**
- **MergeSuggestion**, **AuditLog**
- **PushSubscription** (user/device endpoint Web Push)
- **BackupRestoreSession** (preview token / trạng thái confirm — logic hoặc bảng tùy plan)

### Non-Goals (giai đoạn này)

- Kho sản phẩm độc lập; nhiều cơ hội/nhu cầu trên một khách
- Gửi tin Instagram chuyên biệt / Instagram DM full
- Cookie tài khoản cá nhân FB/Zalo/TikTok
- App native iOS/Android (PWA thay thế)
- SSO xuyên domain

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sale hoàn tất thêm khách + lịch chăm + ghi kết quả ≤ 3 phút trên mobile staging.
- **SC-002**: 100% API workspace-scoped từ chối cross-tenant trong test PGlite/RLS.
- **SC-003**: `npm run check` (API) + build/lint SvelteKit xanh.
- **SC-004**: Lighthouse/PWA installable trên Chrome Android staging; offline xem được ít nhất shell + danh sách khách đã mở.
- **SC-005**: Webhook chữ ký sai = 0 tin được tạo; restore hủy confirm = 0 thay đổi DB.
- **SC-006**: Inbox hiển thị inbound Meta/Zalo/IG trong ≤ 5s sau khi test webhook (staging).
- **SC-007**: TikTok lead test tạo được khách với nguồn TikTok trên staging.
- **SC-008**: Tài liệu tiếng Việt đủ cấu hình Google + Meta/Zalo/TikTok + PWA push trên staging.

## Assumptions

- Backend giữ Node.js 24 + PostgreSQL + `pg`.
- FE = SvelteKit PWA theo quyết định Phong 2026-11-04.
- Hành vi PR #1/#2 là nguồn sự thật kênh/identity (cách đưa vào baseline còn mở — FR-026).
- Web Push dùng VAPID; cần HTTPS trên domain thật.
- Không email marketing / SMS gateway trong rebuild này.
