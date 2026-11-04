# Kế hoạch kỹ thuật: Làm lại Mayhomes CRM

**Branch**: `speckit/rebuild` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Đặc tả `/specs/001-rebuild-crm/spec.md` + quyết định Phong 2026-11-04 (SvelteKit PWA; inbox; TikTok Lead; restore; lock UI; IG nhận; hoãn sản phẩm/cơ hội).

## Summary

Rebuild Mayhomes CRM theo SDD: **backend Node.js 24 + PostgreSQL** (giữ), **frontend SvelteKit mobile-first PWA** (installable, offline cache xem, Web Push tin Fanpage/Zalo). Tái hiện `main` + hành vi PR #1/#2; thêm Inbox đa kênh, TikTok Lead thật, restore preview+confirm, UI khóa/mở workspace. Hoãn kho sản phẩm / nhiều cơ hội.

## Technical Context

**Language/Version**: Node.js 24.x (ESM) backend; SvelteKit (Svelte 5 nếu ổn định với toolchain chọn lúc implement) + TypeScript khuyến nghị cho `web/`

**Primary Dependencies**: Backend `pg`, `@vercel/functions`, Google/Meta/Zalo/TikTok APIs, `web-push` (VAPID). Frontend SvelteKit, `@vite-pwa/sveltekit` (hoặc tương đương), adapter theo hosting. Test: `node:test` + PGlite; FE unit/e2e tối thiểu khi có.

**Storage**: PostgreSQL + RLS FORCE; token mã hóa AES-256-GCM; Cache Storage / IndexedDB cho offline xem (không phải source of truth)

**Testing**: `node --test` (security, tenant, channels, identity, tiktok, restore); `npm run check`; `npm run build` trong `web/`

**Target Platform**: Mobile-first PWA (Android/iOS Safari trong giới hạn PWA); desktop OK; HTTPS bắt buộc cho Push/install

**Project Type**: Web app — API Node tách + SvelteKit frontend (monorepo)

**Performance Goals**: p95 API CRUD < 500ms staging; TTI mobile 4G chấp nhận được cho shell PWA; push gần realtime sau webhook

**Constraints**: Tenant isolation; không BYPASSRLS; không plaintext token; UI Việt; không wildcard OAuth; offline không giả ghi thành công

**Scale/Scope**: Đa workspace; 1 Fanpage + 1 Zalo OA / workspace; TikTok Lead / workspace; Inbox gộp Meta/Zalo/IG

## Constitution Check

| Nguyên tắc | Trạng thái |
|---|---|
| I. Spec trước code | Đạt |
| II. Cách ly đa không gian | Đạt — mở rộng bảng kênh/TikTok/push/restore |
| III. Bảo mật | Đạt — thêm VAPID/TikTok secrets mã hóa |
| IV. Phân quyền + lock workspace | Đạt |
| V. Mobile-first PWA SvelteKit | Đạt — đã phê duyệt |
| VI. Backend Node/PG + test | Đạt |

## Project Structure

### Documentation

```text
specs/001-rebuild-crm/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/api-overview.md
└── checklists/requirements.md
```

### Source Code (mục tiêu)

```text
api/                      # Vercel adapter → server handler
server/
├── index.mjs
├── routes/               # auth, platform, crm, backup, channels, inbox, push, tiktok…
├── services/             # google, meta, zalo, tiktok, backup, restore, merge, push…
├── db/
└── security.mjs
database/                 # 001_initial, 002_channels, 003_identity, 004_push, 005_tiktok, …
web/                      # SvelteKit app (mobile-first PWA)
├── src/routes/           # tổng quan, khách, inbox, lịch, báo cáo, cài đặt, admin…
├── src/lib/
├── static/               # icons, manifest assets
└── vite.config / PWA plugin
tests/                    # API / integration
```

**Structure Decision**: Monorepo; **thay** `dist/` vanilla bằng `web/` SvelteKit; backend module hóa `server/`. Static build SvelteKit có thể serve từ Node hoặc CDN/Vercel tùy hosting (còn mở FR-025). Không microservice.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| SvelteKit + PWA thay vanilla | Phong yêu cầu mobile-first, installable, offline xem, Web Push | Vanilla không đủ PWA/push/maintain UI lớn một cách bền |
| Web Push + VAPID | Thông báo tin Fanpage/Zalo khi sale ngoài hiện trường | Chỉ polling Inbox không đủ kịp thời |
| TikTok Lead connector | Phong chọn tích hợp thật | Giữ màn hình hướng dẫn không đáp ứng lead thật |
| Restore preview/confirm | An toàn khôi phục dữ liệu khách | Export-only dễ mất dữ liệu khi thao tác nhầm |
| [NEEDS CLARIFICATION] Queue backup | Scale nhiều workspace | Vòng lặp đồng bộ có thể timeout — chờ Phong |
| [NEEDS CLARIFICATION] RLS siết audit/memberships | Defense in depth thêm | API-only control đủ cho bản đầu? — chờ Phong |

## Phase 0 → research.md

Baseline + quyết định FE/PWA/kênh đã chốt một phần.

## Phase 1 → data-model, contracts, quickstart

Bổ sung push subscriptions, TikTok connection, restore session; Inbox API; SvelteKit scripts.
