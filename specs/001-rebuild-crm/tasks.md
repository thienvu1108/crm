# Tasks: Làm lại Mayhomes CRM

**Input**: `/specs/001-rebuild-crm/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: `node:test` + PGlite RLS (gồm hardening) + `web` build/check
**Hosting**: Vercel primary; Docker optional dev only
**Baseline kênh**: tái hiện PR #1/#2 trong rebuild (không merge-first)

## Phase 1: Setup

- [x] T001 Tạo cây `server/{routes,services,db}/`, `web/` SvelteKit, `database/`, `tests/`, giữ `api/`
- [x] T002 [P] Scaffold SvelteKit `web/` + `@sveltejs/adapter-vercel` + scripts monorepo
- [x] T003 [P] PWA plugin (`@vite-pwa/sveltekit`): manifest Việt, icons, installable
- [x] T004 [P] `.env.example` đầy đủ (Google, META/ZALO/TIKTOK, VAPID, JOB_SECRET, DATABASE_URL)
- [x] T005 [P] `.gitignore` + ghi chú `Dockerfile` optional-dev trong README (không primary deploy)
- [x] T006 [P] `vercel.json`: builds, rewrites `/api` `/auth` `/webhooks`, **crons** → `/api/jobs/worker`

---

## Phase 2: Foundational (blocking)

- [x] T007 Migrate runner sorted `database/*.sql`
- [x] T008 [P] `server/security.mjs` + `tests/security.test.mjs`
- [x] T009 [P] `server/db/pool.mjs` + `tx` set `app.workspace_id` (Vercel pool nhỏ)
- [x] T010 Router `server/index.mjs` + `api/index.mjs` adapter
- [x] T011 [P] Error JSON Việt; chặn ghi khi `workspaces.active=false`
- [x] T012 [P] Migration `007_rls_hardening.sql` — FORCE RLS + policies **audit_log, memberships, domains** (+ bảng tenant sẵn có)
- [x] T013 [P] Tests RLS cross-tenant cho audit/memberships/domains/customers
- [x] T014 [P] SvelteKit layout mobile-first + nav (Tổng quan/Khách/Inbox/Lịch/Cài đặt)
- [x] T015 Gate: `npm run check` + `cd web && npm run build`

**Checkpoint**: Foundation + RLS hardening sẵn sàng

---

## Phase 3: US1 Auth, workspace, lock (P1) 🎯

- [x] T016 [P] [US1] Test OAuth state/session
- [x] T017 [P] [US1] Test lock workspace → 403 ghi
- [x] T018 [P] [US1] `server/services/google.mjs` PKCE
- [x] T019 [US1] Routes auth/me/config (+ VAPID public)
- [x] T020 [US1] Platform workspaces + PATCH `active`
- [x] T021 [US1] UI login, chọn không gian, admin khóa/mở, banner khóa
- [x] T022 [US1] Demo mode thiếu secrets

---

## Phase 4: US2 CRM lõi PWA (P1)

- [x] T023 [P] [US2] Test phone unique + assignment
- [x] T024 [US2] Schema customers/tasks/activities ổn định
- [x] T025 [US2] Routes data/customers/tasks/activities
- [x] T026 [US2] UI mobile Tổng quan/Khách/Hồ sơ/Lịch/Báo cáo
- [x] T027 [US2] Offline cache xem; ghi offline không giả OK
- [x] T028 [US2] Audit giao việc/stage

**Checkpoint MVP**: US1+US2 trên mobile staging

---

## Phase 5: US3 Thành viên & domain (P2)

- [ ] T029 [P] [US3] Test không xóa owner; TXT verify
- [ ] T030 [US3] Routes members/settings
- [ ] T031 [US3] Routes domains/verify
- [ ] T032 [US3] UI thành viên + hostname

---

## Phase 6: US4 Job queue backup, restore, Calendar (P2)

- [ ] T033 [P] [US4] Migration `006_jobs_queue.sql` (+ restore sessions nếu chưa)
- [ ] T034 [P] [US4] Test enqueue/claim SKIP LOCKED/retry/dead
- [ ] T035 [P] [US4] Test restore cancel vs confirm transactional
- [ ] T036 [US4] `services/jobs.mjs` + `backup.mjs` + `restore.mjs`
- [ ] T037 [US4] Routes export, enqueue drive backup, restore preview/confirm/cancel, GET jobs monitor, POST worker (`JOB_SECRET`)
- [ ] T038 [US4] Calendar sync + DELETE connections
- [ ] T039 [US4] UI sao lưu, giám sát job/retry/error, restore preview/confirm, Calendar

---

## Phase 7: US5 Fanpage/Zalo/IG + Push — tái hiện PR #1 (P2)

- [ ] T040 [P] [US5] Port hành vi/tests từ PR #1 vào modules mới (không merge branch)
- [ ] T041 [P] [US5] Test IG nhận only; chữ ký sai
- [ ] T042 [P] [US5] Test Web Push khi inbound Meta/Zalo
- [ ] T043 [US5] `002_channels.sql` + `004_push_subscriptions.sql`
- [ ] T044 [P] [US5] `services/meta.mjs` `zalo.mjs` `push.mjs` `channels.mjs`
- [ ] T045 [US5] Webhooks + API connections/messages
- [ ] T046 [US5] UI kết nối Page/OA; hội thoại hồ sơ; push subscribe + SW
- [ ] T047 [US5] Docs Meta/Zalo/VAPID trên Vercel HTTPS

---

## Phase 8: US7 Inbox đa kênh (P2)

- [ ] T048 [P] [US7] Test Inbox theo assignment
- [ ] T049 [P] [US7] Test trả lời từ Inbox
- [ ] T050 [US7] API `/api/inbox` (+ read-state nếu cần)
- [ ] T051 [US7] UI `web/src/routes/inbox` mobile lọc kênh
- [ ] T052 [US7] Push click → deep-link Inbox/thread

---

## Phase 9: US8 TikTok Lead (P2)

- [ ] T053 [P] [US8] Test lead → customer; reject bad auth
- [ ] T054 [US8] Migration provider `tiktok_lead`
- [ ] T055 [US8] `services/tiktok.mjs` + webhook/callback
- [ ] T056 [US8] UI kết nối TikTok + docs

---

## Phase 10: US6 Identity/merge — tái hiện PR #2 (P3)

- [ ] T057 [P] [US6] Port tests/hành vi PR #2 (không merge branch)
- [ ] T058 [US6] `003_identity_enrichment.sql`
- [ ] T059 [US6] Match/merge services + API + UI gộp

---

## Phase 11: US9 Demo & docs Vercel (P3)

- [ ] T060 [P] [US9] Banner demo
- [ ] T061 [P] [US9] README/VERCEL: Postgres, Cron, PWA, queue jobs, **không** Docker primary
- [ ] T062 [P] [US9] CI: API check + web build
- [ ] T063 [US9] Walkthrough quickstart

---

## Phase 12: Non-goals

- [ ] T064 [US10] README ghi hoãn sản phẩm/cơ hội; không schema/UI
- [ ] T065 [US10] Không nút gửi Instagram chuyên biệt

---

## Phase 13: Polish

- [ ] T066 [P] Tap target/a11y mobile
- [ ] T067 [P] Rà soát RLS toàn bộ bảng + job worker không bypass
- [ ] T068 Full check + analyze lại nếu đổi spec
- [ ] T069 Gỡ/đánh dấu Dockerfile “dev only”
- [ ] T070 Chuẩn bị triển khai Vercel (env/cron) — chưa push trừ khi Phong yêu cầu

---

## Dependencies

Setup → Foundational (RLS) → US1 → US2 (MVP) → US3 ∥ US4 → US5 → US7 → US8 → US6 → US9 → Non-goals → Polish

US7 after US5; US6 after US5/US8 inbound; US4 queue độc lập tương đối.

## MVP
Phase 1–4 (Setup, Foundational, US1, US2): đăng nhập, lock, CRM mobile PWA trên Vercel staging.
