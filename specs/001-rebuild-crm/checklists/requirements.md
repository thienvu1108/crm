# Checklist chất lượng yêu cầu — 001-rebuild-crm

**Date**: 2026-11-04
**Focus**: Độ đủ / rõ / nhất quán của spec trước khi implement

- [ ] Mọi user story P1 có Independent Test và ≥ 2 acceptance scenarios
- [ ] Phân quyền owner/assistant/viewer được nêu cho từng nhóm API chính
- [ ] Cách ly tenant (membership + RLS) được yêu cầu tường minh
- [ ] Hành vi PR #1 và PR #2 đã phản ánh trong FR/US
- [ ] Tất cả `[NEEDS CLARIFICATION]` đã liệt kê để Phong quyết
- [ ] Non-goals (TikTok thật, mobile, SSO xuyên domain, cookie cá nhân) nhất quán giữa spec & plan
- [ ] Success criteria đo được, không phụ thuộc stack
- [ ] data-model khớp entities trong spec
- [ ] contracts bao phủ auth, CRUD lõi, backup, kênh
- [ ] tasks.md map đủ US1–US8 và phase foundational
