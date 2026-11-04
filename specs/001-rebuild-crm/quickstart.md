# Quickstart: Mayhomes CRM (rebuild / Spec Kit)

**Date**: 2026-11-04

## Yêu cầu

- Node.js 24.x
- PostgreSQL (local hoặc managed)
- (Tuỳ chọn) tài khoản Google Cloud OAuth, Meta, Zalo

## Cài Spec Kit CLI (máy dev)

```sh
uv tool install specify-cli
specify --version
```

## Clone & nhánh làm việc

```sh
git clone https://github.com/thienvu1108/crm.git
cd crm
git checkout speckit/rebuild   # nhánh artifacts SDD (local)
export SPECIFY_FEATURE=001-rebuild-crm
```

## Chạy demo (không cần DB)

```sh
npm ci
npm run demo
# mở http://127.0.0.1:3000 → Trải nghiệm với dữ liệu mẫu
```

## Chạy máy chủ thật (local)

```sh
cp .env.example .env
# điền DATABASE_URL, ENCRYPTION_KEY (32 bytes base64), GOOGLE_*, PLATFORM_ADMIN_EMAILS, JOB_SECRET
npm run db:migrate
npm start
```

Tạo không gian bằng tài khoản trong `PLATFORM_ADMIN_EMAILS` → Quản trị nền tảng.

## Kiểm tra

```sh
npm run check
```

## Đọc artifacts SDD

1. `.specify/memory/constitution.md`
2. `specs/001-rebuild-crm/spec.md`
3. `plan.md` → `research.md` → `data-model.md` → `contracts/` → `tasks.md`

**Chưa triển khai code rebuild trên nhánh này** — chỉ artifacts + init Spec Kit. Không push/PR cho đến khi Phong duyệt câu hỏi `[NEEDS CLARIFICATION]`.
