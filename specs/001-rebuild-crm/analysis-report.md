# Specification Analysis Report — 001-rebuild-crm

**Date**: 2026-11-04  
**Command**: Spec Kit analyze-style (sau khi đóng mọi clarification)  
**Scope**: constitution ↔ spec ↔ plan ↔ tasks (+ data-model/contracts)

## Findings table

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| — | — | — | — | Không có finding CRITICAL/HIGH/MEDIUM | Tiếp tục implement theo MVP khi được phép |

## Coverage Summary

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 | yes | T018, T019, T016 | Google OAuth PKCE + session HttpOnly + logout. |
| FR-002 | yes | T020 | Đa workspace; chỉ platform admin tạo theo lời mời. |
| FR-003 | yes | T023, T011 | Vai trò owner/assistant/viewer trên API. |
| FR-004 | yes | T023, T024, T025 | CRUD khách + chống trùng phone_normalized + enum interest/st |
| FR-005 | yes | T025, T026 | Tasks + activities (dời lịch, hoàn tất). |
| FR-006 | yes | T014, T026 | UI SvelteKit mobile-first tiếng Việt (tổng quan/khách/lịch/b |
| FR-007 | yes | T030, T032 | Owner quản lý thành viên + settings. |
| FR-008 | yes | T020, T021, T031 | Platform admin domains TXT + **khóa/mở workspace UI**. |
| FR-009 | yes | T033, T034, T036, T037, T039 | Owner enqueue backup Drive/export; **job queue Postgres + Ve |
| FR-010 | yes | T035, T036, T037, T039 | Restore **preview + confirm**; cancel = no-op. |
| FR-011 | yes | T038, T039 | Calendar sync một chiều. |
| FR-012 | yes | T008 | Token mã hóa AES-256-GCM. |
| FR-013 | yes | T012, T013, T067 | Membership + `app.workspace_id` + **FORCE RLS** trên bảng te |
| FR-014 | yes | T022, T060 | Demo mode khi thiếu secrets. |
| FR-015 | yes | T040, T044, T045 | Fanpage + Zalo OA (tái hiện PR #1 trong rebuild). |
| FR-016 | yes | T041, T065 | Instagram chỉ nhận/hiển thị cơ bản. |
| FR-017 | yes | T057, T058, T059 | Identity match/merge (tái hiện PR #2 trong rebuild). |
| FR-018 | yes | T050, T051 | Inbox đa kênh Fanpage+Zalo+IG. |
| FR-019 | yes | T054, T055, T056 | TikTok Lead tích hợp thật. |
| FR-020 | yes | T003, T027, T046 | PWA installable + offline xem + Web Push Fanpage/Zalo. |
| FR-021 | yes | T028, T020 | Audit hành động nhạy cảm (lock, restore, merge, backup jobs… |
| FR-022 | yes | T007, T012 | Migration idempotent; runtime không BYPASSRLS. |
| FR-023 | yes | T002, T003, T014 | Frontend **SvelteKit** PWA. |
| FR-024 | yes | T064 | Không implement kho sản phẩm / nhiều cơ hội (hoãn). |
| FR-025 | yes | T006, T061, T069 | Production hosting **Vercel** (Postgres/Neon-compatible, Cro |
| FR-026 | yes | T040, T057 | **Tái hiện** hành vi PR #1/#2 trong rebuild; **không** yêu c |
| FR-027 | yes | T012, T013, T067 | RLS hardening audit_log + memberships + domains **IN scope** |
| FR-028 | yes | T033, T034, T036, T037, T039 | Backup qua **job queue** (Postgres-backed) + Cron + retries  |

## Constitution Alignment Issues

Không có. Hiến pháp **1.2.0** khớp plan/spec (Vercel, SvelteKit PWA, RLS mở rộng, queue+Cron, tái hiện PR #1/#2).

## Unmapped Tasks

Không có task mồ côi nghiêm trọng; T066–T070 là polish/deploy hygiene.

## Metrics

- Total Requirements (FR): **28**
- Total Success Criteria: **9**
- Total Tasks: **70**
- Total Phases: **13**
- Coverage % (FR có ≥1 task): **100%**
- Ambiguity Count (open NEEDS markers): **0**
- Duplication Count: **0** (FR-025..028 đã thành quyết định cụ thể, không còn trùng câu hỏi)
- Critical Issues Count: **0**
- Orphan task id refs in mapping: **0** 

## Next Actions

- Không còn clarification — có thể `/speckit.implement` bắt đầu **MVP = Phase 1–4 (US1+US2)**.
- Không push/PR cho đến khi Phong yêu cầu.
- Optional: sau implement chạy lại analyze + converge.
