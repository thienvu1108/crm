# Kế hoạch kỹ thuật: Làm lại Mayhomes CRM

**Branch**: `speckit/rebuild` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

## Summary

Rebuild trên **Vercel** (Functions + Cron + Postgres/Neon-compatible): API **Node.js 24** + **SvelteKit PWA** mobile-first. Tái hiện PR #1/#2 trong code mới. Inbox, TikTok Lead, restore preview+confirm, lock UI, **RLS siết** audit/memberships/domains, **job queue Postgres** cho backup (retry + giám sát). Docker chỉ optional dev. Hoãn sản phẩm/cơ hội.

## Technical Context

**Language/Version**: Node.js 24 ESM; SvelteKit (+ TS khuyến nghị) trong `web/`

**Primary Dependencies**: `pg`, `@vercel/functions`, `web-push`; SvelteKit + `@vite-pwa/sveltekit` + `@sveltejs/adapter-vercel`; Google/Meta/Zalo/TikTok SDKs/REST; `node:test` + PGlite

**Storage**: Vercel Postgres / Neon-compatible; RLS FORCE mở rộng; Cache Storage offline xem

**Testing**: API tests + `web` build/check; RLS tests gồm audit/memberships/domains

**Target Platform**: Vercel production (HTTPS); PWA mobile; local `vercel dev` / `npm run dev`

**Project Type**: Monorepo web (SvelteKit on Vercel + serverless API)

**Performance Goals**: p95 CRUD < 500ms; Cron/job batch nhỏ tránh timeout Functions; push gần realtime sau webhook

**Constraints**: Không BYPASSRLS; không plaintext token; UI Việt; không vòng backup đồng bộ dài; Functions time/size limits

**Scale/Scope**: Đa workspace Mayhomes; 1 Page + 1 OA + TikTok Lead / workspace; queue backup theo workspace

## Constitution Check

| Nguyên tắc | Trạng thái |
|---|---|
| I Spec trước | Đạt |
| II RLS + tenant (gồm audit/memberships/domains) | Đạt |
| III Bảo mật | Đạt |
| IV Phân quyền + lock | Đạt |
| V SvelteKit PWA | Đạt |
| VI Vercel + queue Cron | Đạt |
| VII Tests | Đạt |

## Project Structure

```text
api/                 # Vercel Functions entry → server handler; cron routes
server/
  routes/ services/ db/ security.mjs
database/            # 001…00N gồm channels, identity, push, tiktok, restore, jobs, rls_hardening
web/                 # SvelteKit + adapter-vercel + PWA
tests/
vercel.json          # rewrites /api /auth /webhooks; crons
Dockerfile           # OPTIONAL local only — không phải deploy path chính
```

**Structure Decision**: Monorepo deploy Vercel. SvelteKit `adapter-vercel`; API giữ `api/*.mjs` hoặc hooks tương thích. Job worker = Function được Cron gọi, claim job từ bảng `jobs`.

## Job queue (Vercel-compatible)

1. Bảng `jobs` (`type`, `workspace_id`, `payload`, `status` queued|running|succeeded|failed|dead, `attempts`, `run_after`, `last_error`, lease/`locked_at`).
2. Owner/API hoặc scheduler enqueue `backup.drive`.
3. `vercel.json` crons: `GET/POST /api/jobs/worker` (bearer `JOB_SECRET`) mỗi N phút.
4. Worker `FOR UPDATE SKIP LOCKED` claim batch nhỏ; retry exponential; vượt max → `dead`; UI owner/admin xem status.
5. Monitoring: đếm failed/dead trên UI + audit; không cần queue ngoài (Inngest/QStash) ở MVP — Postgres đủ và Neon-compatible.

## Complexity Tracking

| Item | Why | Simpler rejected |
|---|---|---|
| SvelteKit PWA | Phong | Vanilla thiếu PWA/push |
| Postgres job queue + Cron | Timeout Functions; retry/monitor | Vòng for sync mọi workspace trong 1 request |
| RLS audit/memberships/domains | Defense in depth Phong | Chỉ tin API |
| Tái viết PR #1/#2 | Tránh phụ thuộc merge/conflict | Merge trước rồi rewrite hai lần |
| Docker optional | Dev thuận tiện | Primary Docker lệch hosting Vercel |

## Phase map
0 research → 1 data-model/contracts/quickstart → tasks → implement (không trong commit này).
