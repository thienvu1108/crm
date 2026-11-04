# Kế hoạch kỹ thuật: Làm lại Mayhomes CRM

**Branch**: `speckit/rebuild` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Đặc tả từ `/specs/001-rebuild-crm/spec.md`

## Summary

Làm lại Mayhomes CRM theo SDD: tái cấu trúc mã nguồn dễ bảo trì, giữ **Node.js 24 + PostgreSQL** (không đổi stack trừ khi Phong quyết định khác), tái hiện toàn bộ hành vi `main` cộng baseline kênh Meta/Zalo (PR #1) và khớp/gộp identity (PR #2), đồng thời chừa chỗ cho các khoảng trống được Phong chọn. Frontend mặc định **giữ vanilla JS module** trong `dist/` (hoặc `frontend/`) để giảm rủi ro; nếu Phong chọn framework sẽ cập nhật plan.

## Technical Context

**Language/Version**: Node.js 24.x (ESM), SQL (PostgreSQL 15+)

**Primary Dependencies**: `pg`, `@vercel/functions` (adapter), Google OAuth/Drive/Calendar REST, Meta Graph, Zalo OA Open API; test `@electric-sql/pglite` + `node:test`

**Storage**: PostgreSQL với RLS FORCE trên bảng tenant; secrets/token mã hóa AES-256-GCM

**Testing**: `node --test` (security, tenant-isolation, vercel-adapter, channels, identity-match); `npm run check` = syntax + tests

**Target Platform**: Web responsive; deploy Vercel Functions và/hoặc Docker/Node process sau reverse proxy HTTPS

**Project Type**: Web application (API Node + static frontend)

**Performance Goals**: Đủ cho đội sale nhỏ–trung (≤ vài trăm user active, ≤ ~10k khách/workspace ở bản đầu); p95 API CRUD < 500ms trên staging vừa

**Constraints**: Cách ly tenant tuyệt đối; không BYPASSRLS runtime; không lưu plaintext token; UI tiếng Việt; không wildcard OAuth; Functions cold start chấp nhận được

**Scale/Scope**: Đa workspace Mayhomes; 1 Fanpage + 1 Zalo OA / workspace ở bản kênh đầu; mở rộng queue backup khi số workspace tăng

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Trạng thái |
|---|---|
| I. Spec trước code | Đạt — artifacts trong `specs/001-rebuild-crm/` |
| II. Cách ly đa không gian | Đạt — giữ RLS + membership; mở rộng policy cho bảng kênh/merge |
| III. Bảo mật dữ liệu | Đạt — ENCRYPTION_KEY, HttpOnly, OAuth chính thức |
| IV. Phân quyền | Đạt — owner/assistant/viewer + platform admin |
| V. Stack đơn giản + test | Đạt — giữ Node/PG; tách module; bắt buộc `npm run check` |

Vi phạm cần biện minh: chưa có (xem Complexity Tracking nếu chọn framework FE hoặc queue riêng).

## Project Structure

### Documentation (this feature)

```text
specs/001-rebuild-crm/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-overview.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root — mục tiêu tái cấu trúc)

```text
api/                     # Vercel adapter (giữ)
server/
├── index.mjs            # HTTP bootstrap + router mỏng
├── routes/              # auth, platform, customers, tasks, backup, channels…
├── services/            # google, meta, zalo, backup, merge…
├── db/                  # pool, tx, migrate runner
└── security.mjs
database/
├── 001_initial.sql
├── 002_channels.sql
├── 003_identity_enrichment.sql
└── …                    # migration mới khi cần
frontend/ hoặc dist/     # UI tiếng Việt (vanilla mặc định)
tests/
├── security.test.mjs
├── tenant-isolation.test.mjs
├── channels.test.mjs
├── identity-match.test.mjs
└── vercel-adapter.test.mjs
```

**Structure Decision**: Giữ monorepo hiện có; **tách** `server/index.mjs` / `dist/app.js` đang nén thành module theo domain. Không microservice. Adapter Vercel `api/index.mjs` gọi cùng handler. Dockerfile giữ cho VPS.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (trống — mặc định) | — | — |
| [NEEDS CLARIFICATION] Framework FE | DX/component nếu đội mở rộng | Vanilla đã chạy; đổi có chi phí rewrite UI |
| [NEEDS CLARIFICATION] Queue backup | Nhiều workspace | Vòng lặp đồng bộ đủ khi số workspace nhỏ |

## Phase 0 → research.md

Nghiên cứu baseline `main` + PR #1/#2, quyết định giữ stack, liệt kê gap.

## Phase 1 → data-model.md, contracts/, quickstart.md

Mô hình dữ liệu thống nhất (gồm kênh + merge); hợp đồng API; hướng dẫn chạy local/staging.
