# Tasks: Làm lại Mayhomes CRM

**Input**: `/specs/001-rebuild-crm/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: `node:test` bắt buộc; SvelteKit check/build bắt buộc sau khi scaffold `web/`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo API + SvelteKit PWA

- [ ] T001 Tạo cây `server/{routes,services,db}/`, `web/` (SvelteKit), `database/`, `tests/` theo plan
- [ ] T002 [P] Scaffold SvelteKit trong `web/` (TypeScript khuyến nghị) + script root workspace/`package.json`
- [ ] T003 [P] Cấu hình PWA (`@vite-pwa/sveltekit` hoặc tương đương): manifest tiếng Việt, icons, installable
- [ ] T004 [P] Cập nhật `.env.example` (Google, JOB_SECRET, META/ZALO/TIKTOK, VAPID_*)
- [ ] T005 [P] `.gitignore`: `.env`, `web/.svelte-kit`, `web/build`, secrets; giữ `.specify/`

---

## Phase 2: Foundational (Blocking)

**⚠️ CRITICAL**: Chặn mọi user story

- [ ] T006 Migrate runner sorted `database/*.sql` trong `server/db/migrate.mjs`
- [ ] T007 [P] `server/security.mjs` + `tests/security.test.mjs`
- [ ] T008 [P] `server/db/pool.mjs` + `tx` set `app.workspace_id`
- [ ] T009 Router mỏng `server/index.mjs` + `api/index.mjs` Vercel adapter
- [ ] T010 [P] JSON error tiếng Việt + no-store; chặn ghi khi `workspaces.active=false`
- [ ] T011 [P] Layout mobile-first shell SvelteKit (`web/src/routes/+layout`) + nav Tổng quan/Khách/Inbox/Lịch/Cài đặt
- [ ] T012 Tenant-isolation PGlite tối thiểu `tests/tenant-isolation.test.mjs`
- [ ] T013 Gate: root `npm run check` + `cd web && npm run build` (PWA generate)

**Checkpoint**: Foundation sẵn sàng

---

## Phase 3: User Story 1 - Auth, workspace & khóa/mở (P1) 🎯

**Goal**: Google login, admin tạo/khóa workspace, chọn không gian

**Independent Test**: Khóa workspace → POST khách 403

### Tests
- [ ] T014 [P] [US1] Test session/OAuth state hash
- [ ] T015 [P] [US1] Test platform lock/unlock `active` + 403 ghi

### Implementation
- [ ] T016 [P] [US1] `server/services/google.mjs` PKCE start/connect/callback
- [ ] T017 [US1] Routes auth + `/api/me` + `/api/config` (+ VAPID public)
- [ ] T018 [US1] Routes platform workspaces CRUD-lite + **PATCH active**
- [ ] T019 [US1] UI SvelteKit: đăng nhập, chọn không gian, admin khóa/mở, banner workspace khóa
- [ ] T020 [US1] Demo mode khi thiếu secrets

**Checkpoint**: US1 OK trên mobile viewport

---

## Phase 4: User Story 2 - CRM lõi PWA (P1)

**Goal**: Khách/task/activity/tổng quan/báo cáo; offline xem

### Tests
- [ ] T021 [P] [US2] Test normalizePhone + unique 409
- [ ] T022 [P] [US2] Test assignment assistant/viewer

### Implementation
- [ ] T023 [US2] Xác nhận schema customers/tasks/activities `001_initial.sql`
- [ ] T024 [US2] Routes `/api/data|customers|tasks|activities`
- [ ] T025 [US2] UI mobile: Tổng quan, Khách, Hồ sơ, Lịch, Báo cáo
- [ ] T026 [US2] PWA runtime cache cho GET snapshot/danh sách đã tải; ghi offline → thông báo rõ
- [ ] T027 [US2] Audit giao việc / đổi stage

**Checkpoint**: MVP sale mobile dùng được

---

## Phase 5: User Story 3 - Thành viên & domain (P2)

### Tests
- [ ] T028 [P] [US3] Không xóa owner membership
- [ ] T029 [P] [US3] Verify TXT mock

### Implementation
- [ ] T030 [US3] Routes members + settings
- [ ] T031 [US3] Routes domains + verify
- [ ] T032 [US3] UI Thành viên + gắn/verify hostname (mobile)

---

## Phase 6: User Story 4 - Backup, restore confirm & Calendar (P2)

### Tests
- [ ] T033 [P] [US4] Encrypt connections; JOB_SECRET timing-safe
- [ ] T034 [P] [US4] Restore cancel sau preview = DB không đổi; confirm = apply + audit

### Implementation
- [ ] T035 [US4] Migration/`backup_restore_sessions` (hoặc tương đương) trong `database/005_*.sql`
- [ ] T036 [US4] `server/services/backup.mjs` + `restore.mjs` (preview/confirm/cancel transactional)
- [ ] T037 [US4] Routes export/drive/jobs/backups/restore/* / calendar/sync / DELETE connections
- [ ] T038 [US4] UI sao lưu, preview restore, confirm/hủy, Calendar sync

---

## Phase 7: User Story 5 - Fanpage, Zalo & IG nhận + Web Push (P2)

### Tests
- [ ] T039 [P] [US5] `tests/channels.test.mjs` chữ ký/parser/PKCE
- [ ] T040 [P] [US5] IG inbound hiển thị; không có send IG
- [ ] T041 [P] [US5] Push service mock gửi khi inbound Meta/Zalo

### Implementation
- [ ] T042 [US5] `database/002_channels.sql` + `004_push_subscriptions.sql`
- [ ] T043 [P] [US5] `server/services/meta.mjs`, `zalo.mjs`, `push.mjs`
- [ ] T044 [US5] Channels routes + webhooks meta/zalo; subscribe apps
- [ ] T045 [US5] UI Kết nối Page/OA; hội thoại hồ sơ (IG read-only send)
- [ ] T046 [US5] UI xin quyền + `/api/push/subscribe`; SW push handler tiếng Việt rút gọn
- [ ] T047 [US5] README Meta/Zalo/VAPID; `vercel.json` `/webhooks/*`

---

## Phase 8: User Story 7 - Inbox đa kênh (P2)

**Goal**: Một Inbox Fanpage+Zalo+IG

### Tests
- [ ] T048 [P] [US7] Inbox chỉ hiện khách trong quyền assignment
- [ ] T049 [P] [US7] Trả lời Zalo/Meta từ Inbox tạo outbound + hiện thread

### Implementation
- [ ] T050 [US7] Optional `inbox_read_states` migration; GET `/api/inbox` + thread detail
- [ ] T051 [US7] UI `web/src/routes/inbox` mobile: lọc kênh, chưa đọc, mở thread
- [ ] T052 [US7] Deep-link Inbox → hồ sơ khách; đồng bộ với push click

---

## Phase 9: User Story 8 - TikTok Lead thật (P2)

### Tests
- [ ] T053 [P] [US8] Webhook lead hợp lệ → customer nguồn TikTok
- [ ] T054 [P] [US8] Chữ ký/token sai → không ghi

### Implementation
- [ ] T055 [US8] Migration provider `tiktok_lead` + secrets
- [ ] T056 [US8] `server/services/tiktok.mjs` + webhook `/webhooks/tiktok` + OAuth/callback nếu cần
- [ ] T057 [US8] UI Kết nối TikTok + map field; khớp SĐT với merge policy
- [ ] T058 [US8] README TikTok Lead tiếng Việt + `.env.example`

---

## Phase 10: User Story 6 - Identity match & merge (P3)

### Tests
- [ ] T059 [P] [US6] Auto-link vs suggestion
- [ ] T060 [P] [US6] Merge chuyển quan hệ + `merged_into`

### Implementation
- [ ] T061 [US6] `database/003_identity_enrichment.sql`
- [ ] T062 [US6] Inbound enrich/match (Meta/Zalo/TikTok phone)
- [ ] T063 [US6] API link/merge/suggestions + UI gộp / chọn kênh trả lời

---

## Phase 11: User Story 9 - Demo & tài liệu (P3)

- [ ] T064 [P] [US9] Banner demo SvelteKit; không ghi DB thật khi mode demo
- [ ] T065 [P] [US9] README + VERCEL + PWA/push/iOS giới hạn tiếng Việt
- [ ] T066 [P] [US9] CI: API check + `web` build
- [ ] T067 [US9] Chạy lại quickstart.md máy sạch

---

## Phase 12: Non-goals / hoãn (không implement)

- [ ] T068 [US10] Ghi rõ trong README: kho sản phẩm & nhiều cơ hội **hoãn**; không tạo schema/UI
- [ ] T069 [US10] Đảm bảo không có nút gửi Instagram chuyên biệt

---

## Phase 13: Polish & Cross-Cutting

- [ ] T070 [P] A11y/tap target mobile; dark-safe contrast cơ bản
- [ ] T071 [P] Rà FORCE RLS bảng mới (channels, push, restore)
- [ ] T072 Full check API + web build + checklist requirements
- [ ] T073 Cập nhật plan/research khi Phong trả lời hosting / PR baseline / RLS / queue
- [ ] T074 Ghi chú chiến lược merge PR #1/#2 (local only cho đến khi được phép push)

---

## Dependencies & Execution Order

- Phase 1 → 2 → US1 → US2 (MVP) → US3/US4 song song → US5 → US7 (Inbox) → US8 (TikTok) → US6 → US9 → Non-goal notes → Polish
- US7 phụ thuộc US5 (messages)
- US6 nên sau US5/US8 (inbound sources)
- US4 restore độc lập tương đối với kênh

### MVP First
1. Setup + Foundational  
2. US1 + US2 (PWA CRM lõi)  
3. STOP & VALIDATE trên mobile  
4. Backup/restore + kênh + inbox + TikTok  

## Notes

- Không implement trên commit artifacts; không push.
- Mọi UI tiếng Việt, mobile-first trước desktop.
