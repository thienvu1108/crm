# Quickstart

**Date**: 2026-11-04

## Stack đã chốt
Vercel + Postgres/Neon-compatible + Vercel Cron · Node API · SvelteKit PWA · tái hiện PR #1/#2 · RLS hardening · job queue backup.

## Spec Kit
```sh
uv tool install specify-cli && specify --version
export SPECIFY_FEATURE=001-rebuild-crm
```

## Local API
```sh
cp .env.example .env
# DATABASE_URL (Neon/Vercel Postgres), ENCRYPTION_KEY, GOOGLE_*, PLATFORM_ADMIN_EMAILS,
# JOB_SECRET, META_*, ZALO_*, TIKTOK_*, VAPID_*
npm ci && npm run db:migrate && npm start
```

## Local web
```sh
cd web && npm ci && npm run dev
```

## Vercel
- Import repo; Node 24; env Production/Preview
- `vercel.json`: build web+api, crons → `/api/jobs/worker`
- adapter-vercel cho SvelteKit
- Docker: chỉ khi muốn dev container — **không** deploy path chính

## Check
```sh
npm run check
cd web && npm run build
```

Clarifications: **0 còn mở**. Chưa implement code trên nhánh artifacts; không push cho đến khi Phong bảo triển khai.
