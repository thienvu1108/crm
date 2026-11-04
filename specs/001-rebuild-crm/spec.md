# Đặc tả tính năng: Làm lại Mayhomes CRM (Spec-Driven)

**Feature Branch**: `speckit/rebuild` (thư mục: `001-rebuild-crm`)
**Created**: 2026-11-04
**Status**: Draft — clarifications đã đóng
**Input**: Rebuild CRM theo SDD + quyết định Phong 2026-11-04 (đủ bộ).

## Bối cảnh

Baseline `thienvu1108/crm` v0.1.0 (vanilla + Node/PG). Rebuild: **SvelteKit PWA** + API Node trên **Vercel** + Postgres Neon-compatible; **tái hiện** hành vi PR #1/#2 trong code mới (không merge trước); Inbox, TikTok Lead, restore, lock UI, RLS siết, job queue backup.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đa không gian, Google Auth & khóa/mở (P1)
Platform admin tạo/khóa/mở không gian; user đăng nhập Google; workspace khóa từ chối ghi.
**Independent Test**: Khóa workspace → POST khách 403.
**Acceptance**: tạo workspace+owner; lock chặn ghi; thiếu secrets → demo/503.

### User Story 2 - CRM lõi mobile PWA (P1)
Khách/task/activity/tổng quan/báo cáo; PWA cài được; offline xem; ghi offline không giả OK.
**Independent Test**: CRUD mobile + offline xem danh sách đã cache.

### User Story 3 - Thành viên & domain (P2)
Mời/thu hồi member; TXT verify hostname; OAuth theo host.
**Independent Test**: TXT sai/đúng; thu hồi membership.

### User Story 4 - Backup queue, restore confirm & Calendar (P2)
Owner enqueue backup; **Vercel Cron** + **Postgres job queue** xử lý có **retry + giám sát/status**; restore preview→confirm; Calendar sync một chiều.
**Independent Test**: Hủy confirm = DB không đổi; job fail rồi retry; assistant không backup/restore.

### User Story 5 - Fanpage, Zalo, IG nhận + Web Push (P2)
Tái hiện PR #1: 1 Page + 1 OA; webhook; trả lời văn bản; IG chỉ nhận; Web Push.
**Independent Test**: chữ ký sai = 0 ghi; push mock khi inbound.

### User Story 6 - Identity match & merge (P3)
Tái hiện PR #2: khớp SĐT, đa identity, gợi ý/gộp, `merged_into`.
**Independent Test**: merge chuyển quan hệ con.

### User Story 7 - Inbox đa kênh (P2)
Inbox Fanpage+Zalo+IG; lọc; trả lời (trừ gửi IG).
**Independent Test**: 3 kênh hiện trong Inbox theo quyền.

### User Story 8 - TikTok Lead thật (P2)
Connector chính thức; lead → khách nguồn TikTok; khớp SĐT/merge policy.
**Independent Test**: lead mock tạo khách; token sai từ chối.

### User Story 9 - Demo & tài liệu Vercel (P3)
Demo mode; docs Vercel Postgres/Cron/PWA; CI check+build.
**Independent Test**: quickstart máy sạch.

### User Story 10 - Non-goals giai đoạn này
Kho sản phẩm / nhiều cơ hội **hoãn**; không gửi IG chuyên biệt; Docker không phải deploy chính.

### Edge Cases
- Workspace locked; restore nửa chừng (transaction); job hết retry → status `dead` + thấy trên UI/admin; Cron trùng không double-process (lease/lock); offline ghi; webhook idempotent; RLS membership/audit/domains chặn cross-tenant kể cả khi API lỗi.

## Requirements *(mandatory)*

- **FR-001**: Google OAuth PKCE + session HttpOnly + logout.
- **FR-002**: Đa workspace; chỉ platform admin tạo theo lời mời.
- **FR-003**: Vai trò owner/assistant/viewer trên API.
- **FR-004**: CRUD khách + chống trùng phone_normalized + enum interest/stage.
- **FR-005**: Tasks + activities (dời lịch, hoàn tất).
- **FR-006**: UI SvelteKit mobile-first tiếng Việt (tổng quan/khách/lịch/báo cáo/hồ sơ).
- **FR-007**: Owner quản lý thành viên + settings.
- **FR-008**: Platform admin domains TXT + **khóa/mở workspace UI**.
- **FR-009**: Owner enqueue backup Drive/export; **job queue Postgres + Vercel Cron**, retry + monitoring/status.
- **FR-010**: Restore **preview + confirm**; cancel = no-op.
- **FR-011**: Calendar sync một chiều.
- **FR-012**: Token mã hóa AES-256-GCM.
- **FR-013**: Membership + `app.workspace_id` + **FORCE RLS** trên bảng tenant **và** audit_log, memberships, domains (hardening IN).
- **FR-014**: Demo mode khi thiếu secrets.
- **FR-015**: Fanpage + Zalo OA (tái hiện PR #1 trong rebuild).
- **FR-016**: Instagram chỉ nhận/hiển thị cơ bản.
- **FR-017**: Identity match/merge (tái hiện PR #2 trong rebuild).
- **FR-018**: Inbox đa kênh Fanpage+Zalo+IG.
- **FR-019**: TikTok Lead tích hợp thật.
- **FR-020**: PWA installable + offline xem + Web Push Fanpage/Zalo.
- **FR-021**: Audit hành động nhạy cảm (lock, restore, merge, backup jobs…).
- **FR-022**: Migration idempotent; runtime không BYPASSRLS.
- **FR-023**: Frontend **SvelteKit** PWA.
- **FR-024**: Không implement kho sản phẩm / nhiều cơ hội (hoãn).
- **FR-025**: Production hosting **Vercel** (Postgres/Neon-compatible, Cron); Docker optional dev only.
- **FR-026**: **Tái hiện** hành vi PR #1/#2 trong rebuild; **không** yêu cầu merge PR trước.
- **FR-027**: RLS hardening audit_log + memberships + domains **IN scope**.
- **FR-028**: Backup qua **job queue** (Postgres-backed) + Cron + retries + monitoring — không vòng lặp đồng bộ một request.

### Key Entities
User, Workspace(`active`), Membership, Domain, Session, OAuthState, Customer, Task, Activity, Connection, CalendarLink, ChannelConnection/Route/Identity/Message, MergeSuggestion, AuditLog, PushSubscription, BackupRestoreSession, **Job** / **JobAttempt** (queue).

### Non-Goals
Sản phẩm/cơ hội đa nhu cầu; gửi IG chuyên biệt; cookie cá nhân; native app; SSO xuyên domain; Docker là primary deploy; merge PR #1/#2 như điều kiện tiên quyết.

## Success Criteria
- **SC-001**: Sale ≤ 3 phút thêm khách+chăm trên mobile staging.
- **SC-002**: 100% cross-tenant bị chặn kể cả qua bảng audit/memberships/domains trong test RLS.
- **SC-003**: API check + `web` build xanh trên CI.
- **SC-004**: PWA installable; offline xem shell+danh sách đã mở.
- **SC-005**: Webhook chữ ký sai = 0 tin; restore cancel = 0 đổi DB.
- **SC-006**: Inbox hiện inbound ≤ 5s sau webhook test.
- **SC-007**: TikTok lead test tạo khách nguồn TikTok.
- **SC-008**: Backup job fail → retry → thành công hoặc `dead` có thể xem trên UI giám sát.
- **SC-009**: Docs đủ cấu hình Vercel + Postgres + Cron + PWA push.

## Assumptions
- Node 24 + `pg` + SvelteKit; Vercel production; hành vi PR #1/#2 = spec kỹ thuật để viết lại; VAPID HTTPS; không SMS/email marketing.
