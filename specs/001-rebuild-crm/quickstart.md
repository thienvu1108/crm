# Quickstart: Mayhomes CRM (rebuild / Spec Kit)

**Date**: 2026-11-04

## Yêu cầu

- Node.js 24.x, PostgreSQL
- (Tuỳ chọn) Google, Meta, Zalo, TikTok apps; VAPID keys cho Web Push

## Spec Kit

```sh
uv tool install specify-cli
specify --version
```

## Repo

```sh
cd /workspace/crm-speckit   # hoặc clone thienvu1108/crm
git checkout speckit/rebuild
export SPECIFY_FEATURE=001-rebuild-crm
```

## Backend (API)

```sh
cp .env.example .env
# DATABASE_URL, ENCRYPTION_KEY, GOOGLE_*, PLATFORM_ADMIN_EMAILS, JOB_SECRET
# META_*, ZALO_*, TIKTOK_*, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
npm ci
npm run db:migrate
npm start
```

## Frontend SvelteKit PWA (`web/`)

```sh
cd web
npm ci
npm run dev          # dev server mobile-first
npm run build        # production build + service worker
```

Mở viewport mobile (DevTools) để kiểm tra layout. Cài PWA trên Chrome Android staging (HTTPS).

## Demo

Khi thiếu secrets backend: UI SvelteKit chế độ demo / không ghi DB thật — xem banner cảnh báo.

## Kiểm tra

```sh
npm run check                 # API + tests (root)
cd web && npm run check       # svelte-check / lint nếu có
```

## Artifacts SDD

`.specify/memory/constitution.md` → `specs/001-rebuild-crm/spec.md` → plan → data-model → contracts → tasks.

**Chưa implement rebuild trên commit artifacts.** Không push cho đến khi Phong trả lời các `[NEEDS CLARIFICATION]` còn lại (hosting, baseline PR, RLS, queue backup).
