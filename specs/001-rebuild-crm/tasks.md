# Tasks: Làm lại Mayhomes CRM

**Input**: Design documents từ `/specs/001-rebuild-crm/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Có — bộ `node:test` bắt buộc theo constitution (tenant, security, kênh).

**Organization**: Theo user story để giao MVP độc lập.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Khởi tạo cấu trúc module và Spec Kit đã có sẵn

- [ ] T001 Xác nhận cây thư mục mục tiêu theo plan (`server/routes/`, `server/services/`, `server/db/`, `frontend|dist/`, `database/`, `tests/`) trong repo root
- [ ] T002 [P] Cập nhật `package.json` scripts (`start`, `demo`, `db:migrate`, `test`, `check`) giữ Node 24 + ESM
- [ ] T003 [P] Đồng bộ `.env.example` với Google + JOB_SECRET + chỗ dành META_*/ZALO_* (khi bật kênh)
- [ ] T004 [P] Đảm bảo `.gitignore` loại `.env`, secrets; giữ `.specify/` artifacts trong Git

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nền tảng chặn mọi user story

**⚠️ CRITICAL**: Không bắt đầu US cho đến khi xong phase này

- [ ] T005 Viết migrate runner đọc tuần tự `database/*.sql` trong `server/db/migrate.mjs` (thay hardcode một file)
- [ ] T006 [P] Tách `server/security.mjs` (encrypt/decrypt, normalizePhone, allowed, validators) + test `tests/security.test.mjs`
- [ ] T007 [P] Tạo `server/db/pool.mjs` + helper `tx(ctx)` set `app.workspace_id` local
- [ ] T008 Tách HTTP bootstrap/router mỏng `server/index.mjs` + giữ `api/index.mjs` Vercel adapter
- [ ] T009 [P] Chuẩn hóa JSON error tiếng Việt + header no-store
- [ ] T010 Bộ test tenant-isolation PGlite tối thiểu cho customers/tasks (chưa kênh) trong `tests/tenant-isolation.test.mjs`
- [ ] T011 Gate: `npm run check` xanh trên foundational

**Checkpoint**: Foundation sẵn sàng

---

## Phase 3: User Story 1 - Đa không gian & Google Auth (Priority: P1) 🎯 MVP

**Goal**: Login Google, platform admin tạo workspace, chọn không gian, session/logout

**Independent Test**: 2 workspace, admin tạo owner; user ngoài bị 403

### Tests

- [ ] T012 [P] [US1] Test OAuth state hash/expiry & session cookie flags (mock) trong `tests/security.test.mjs` hoặc `tests/auth.test.mjs`
- [ ] T013 [P] [US1] Test platform-only routes 403 với non-admin

### Implementation

- [ ] T014 [P] [US1] `server/services/google.mjs` — start/connect/callback PKCE
- [ ] T015 [US1] Routes `/auth/google/*`, `/api/logout`, `/api/config`, `/api/me` trong `server/routes/auth.mjs`
- [ ] T016 [US1] Routes `/api/platform/workspaces` GET/POST trong `server/routes/platform.mjs`
- [ ] T017 [US1] UI: màn đăng nhập, chọn không gian, đăng xuất trong `dist/app.js` (hoặc `frontend/`)
- [ ] T018 [US1] Audit `workspace.create`; demo mode khi thiếu secrets

**Checkpoint**: US1 độc lập hoạt động

---

## Phase 4: User Story 2 - Hồ sơ khách & chăm sóc (Priority: P1)

**Goal**: CRUD khách, task, activity, tổng quan, lịch, báo cáo, phân quyền assignment

**Independent Test**: Assistant chỉ thấy khách được giao; chống trùng SĐT

### Tests

- [ ] T019 [P] [US2] Test normalizePhone + unique conflict 409
- [ ] T020 [P] [US2] Test permit read/write theo role + assigned_to

### Implementation

- [ ] T021 [US2] Schema customers/tasks/activities đã có trong `001_initial.sql` — xác nhận constraints/index
- [ ] T022 [US2] Routes `/api/data`, `/api/customers`, `/api/tasks`, `/api/activities` trong `server/routes/crm.mjs`
- [ ] T023 [US2] UI Tổng quan / Khách hàng / Hồ sơ / Lịch hẹn / Báo cáo tiếng Việt responsive
- [ ] T024 [US2] Lọc/tìm kiếm, đổi giai đoạn, dời lịch, ghi kết quả chăm
- [ ] T025 [US2] Audit các thay đổi nhạy cảm (giao việc, đổi stage)

**Checkpoint**: MVP sale dùng được không cần kênh

---

## Phase 5: User Story 3 - Thành viên & tên miền (Priority: P2)

**Goal**: Mời/thu hồi member; đăng ký & verify hostname TXT

**Independent Test**: Verify sai/đúng TXT; member bị thu hồi mất access

### Tests

- [ ] T026 [P] [US3] Test không xóa membership owner
- [ ] T027 [P] [US3] Test verify DNS mock (token khớp/không khớp)

### Implementation

- [ ] T028 [US3] Routes `/api/members`, `/api/settings` (owner)
- [ ] T029 [US3] Routes `/api/platform/domains`, `/domains/verify` + resolveTxt
- [ ] T030 [US3] UI Thành viên & phân quyền; form gắn tên miền / Kiểm tra DNS
- [ ] T031 [US3] [NEEDS CLARIFICATION gated] UI khóa/mở `workspaces.active` nếu Phong chọn

**Checkpoint**: Vận hành đa đội + brand host

---

## Phase 6: User Story 4 - Drive backup & Calendar sync (Priority: P2)

**Goal**: Export JSON, backup Drive, job scheduler, sync Calendar một chiều

**Independent Test**: Mock Google; assistant bị từ chối backup

### Tests

- [ ] T032 [P] [US4] Test mã hóa token connections + reject decrypt giả mạo
- [ ] T033 [P] [US4] Test JOB_SECRET timing-safe; kết quả success/failed per workspace

### Implementation

- [ ] T034 [US4] `server/services/backup.mjs` — export + Drive upload
- [ ] T035 [US4] Routes `/api/backup/export`, `/api/backup/drive`, `/api/jobs/backups`, `/api/calendar/sync`, DELETE connections
- [ ] T036 [US4] UI Kết nối Drive/Calendar, nút sao lưu, đẩy lịch
- [ ] T037 [US4] [NEEDS CLARIFICATION gated] Preview+confirm restore nếu Phong chọn

**Checkpoint**: Vận hành backup/lịch ổn định

---

## Phase 7: User Story 5 - Fanpage & Zalo OA (Priority: P2)

**Goal**: Kết nối Page/OA, webhook, hội thoại, trả lời văn bản

**Independent Test**: 16+ test chữ ký/parser/PKCE/RLS kênh

### Tests

- [ ] T038 [P] [US5] Port/adapt `tests/channels.test.mjs` từ PR #1
- [ ] T039 [P] [US5] Mở rộng tenant-isolation cho bảng kênh

### Implementation

- [ ] T040 [US5] Thêm `database/002_channels.sql` + migrate
- [ ] T041 [P] [US5] `server/services/meta.mjs`, `server/services/zalo.mjs`
- [ ] T042 [US5] `server/services/channels.mjs` + routes API kênh + `/webhooks/meta|zalo`
- [ ] T043 [US5] UI Kết nối kênh thật + hội thoại trong hồ sơ
- [ ] T044 [US5] Cập nhật README/.env.example hướng dẫn Meta/Zalo tiếng Việt
- [ ] T045 [US5] Rewrite `vercel.json` cho `/webhooks/*`

**Checkpoint**: Nhận/gửi tin thử nghiệm (dev app)

---

## Phase 8: User Story 6 - Khớp SĐT & gộp hồ sơ (Priority: P3)

**Goal**: Auto-match phone, multi-identity, merge suggestions, merge thủ công

**Independent Test**: `tests/identity-match.test.mjs` 20/20 tinh thần PR #2

### Tests

- [ ] T046 [P] [US6] Test auto-link vs suggestion khi xung đột dữ liệu
- [ ] T047 [P] [US6] Test merge chuyển quan hệ con + `merged_into`

### Implementation

- [ ] T048 [US6] `database/003_identity_enrichment.sql`
- [ ] T049 [US6] Logic inbound enrich/match trong channels service
- [ ] T050 [US6] API link identity + merge + merge-suggestions
- [ ] T051 [US6] UI gợi ý gộp / gắn hội thoại / chọn kênh trả lời đa identity

**Checkpoint**: Giảm trùng lead kênh

---

## Phase 9: User Story 7 - Demo & tài liệu (Priority: P3)

**Goal**: Preview localStorage; docs vận hành; CI

**Independent Test**: `npm run demo` không cần DATABASE_URL

### Implementation

- [ ] T052 [P] [US7] Giữ/chỉnh `server/preview.mjs` + cảnh báo demo trên UI
- [ ] T053 [P] [US7] Cập nhật README.md + VERCEL.md khớp kiến trúc module mới
- [ ] T054 [P] [US7] Xác nhận `.github/workflows/check.yml` chạy `npm run check`
- [ ] T055 [US7] Chạy lại `specs/001-rebuild-crm/quickstart.md` trên máy sạch

**Checkpoint**: Người mới chạy được demo + hiểu giới hạn

---

## Phase 10: User Story 8 - Gap có điều kiện (Priority: P3)

**Purpose**: Chỉ làm mục Phong chọn sau khi trả lời NEEDS CLARIFICATION

- [ ] T056 [US8] [NEEDS CLARIFICATION] Nhiều cơ hội / kho sản phẩm — spec bổ sung + schema + UI nếu chọn
- [ ] T057 [US8] [NEEDS CLARIFICATION] Hộp thư inbox đa kênh nếu chọn
- [ ] T058 [US8] [NEEDS CLARIFICATION] TikTok Lead — implement / giữ guide / gỡ UI
- [ ] T059 [US8] [NEEDS CLARIFICATION] Giám sát scheduler + retention backup nếu chọn
- [ ] T060 [US8] [NEEDS CLARIFICATION] Observability/rate-limit proxy checklist staging

---

## Phase 11: Polish & Cross-Cutting

- [ ] T061 [P] Format/module hóa hết file từng nén; bỏ dead placeholder nếu đã thay connector thật
- [ ] T062 [P] Rà soát FORCE RLS + role runtime docs
- [ ] T063 Chạy full `npm run check` + checklist `checklists/requirements.md`
- [ ] T064 Cập nhật research/plan nếu quyết định Phong đổi FE/hosting
- [ ] T065 Chuẩn bị ghi chú merge PR #1/#2 hoặc cherry-pick hành vi (không push trong task này)

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → (US1 & US2 song song sau foundation) → US3/US4 → US5 → US6 → US7 → US8 (optional) → Polish
- US5 phụ thuộc foundation + nên có US2 (khách) trước
- US6 phụ thuộc US5
- US4 độc lập tương đối với US5 nhưng cùng Google services

### Parallel Opportunities

- T002–T004; T006–T007; T012–T013; T019–T020; T038–T039; T041; T052–T054 có thể song song

### MVP First

1. Phase 1–2
2. US1 + US2
3. **STOP & VALIDATE** trên staging nội bộ
4. Tiếp US3–US4 rồi kênh US5–US6

## Notes

- Không implement trên commit artifacts này; tasks là kế hoạch thực thi sau khi Phong trả lời clarification.
- Mọi task UI phải tiếng Việt.
- Không commit secrets; không push từ task executor này.
