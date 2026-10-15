# Morfra 开发入口

`morfra/` 是 Morfra 当前代码目录；目录名、npm 包名和 Bundle Identifier 均已对齐 Morfra。

开始开发前必须从仓库根目录依次读取：

1. `AGENTS.md`
2. `PROJECT-CONTEXT.md`
3. `Product-Spec.md`
4. `Design-Brief.md`
5. `DEV-PLAN.md` 中当前获批准的 Phase
6. Git 状态、目标代码及其直接测试

边界：

- 当前代码仍包含 Phase 1–31 的 `Requirement`、`Schema`、`Stage` 和 Markdown 存储实现；它们是待替换的旧实现，不是 v3 需求来源。
- `docs/archive/` 与 `docs/future/` 默认不进入开发上下文。
- AI 表格助手由 `initiatives/ai-assistant/` 独立工作流负责；修改共享入口前必须保留其未提交改动。
- 每次只执行一个获批准 Phase，完成统一验证门禁后等待下一次批准。
- 未经用户明确要求，不提交、不推送。

常用命令在 `morfra/` 目录执行：

```bash
pnpm test
pnpm build
pnpm tauri dev
```
