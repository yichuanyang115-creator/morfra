# Development Plan — Morfra v3

> 文档类别：当前开发计划
>
> 当前状态：Phase 32～44 已完成并通过 Code Review、测试、编译和功能验证；Phase 45「顶栏与表导航迭代」已批准并进行中（2026-08-12）；Phase 46「字段管理模态导航重构」已批准并进行中（2026-08-14）
>
> 当前事实来源：`Product-Spec.md`、`Design-Brief.md`；两份活跃文档均只保留 v3 当前事实
>
> 历史阶段：Phase 1–31 已完成，索引见 `docs/archive/PHASE-HISTORY-01-31.md`；不得作为 v3 实现指令。

---

## 1. 当前状态与执行边界

- 项目代码目录继续使用 `reqflow/`；用户可见名称在 v3 中统一为 `Morfra`，代码目录、npm 包名与 Bundle Identifier 暂不做无收益的路径迁移。
- Phase 32～44 已完成；Phase 45 已获用户整体批准，当前只执行该 Phase。
- 当前工作区存在 AI 独立进程的未提交改动。任何 Phase 开始前必须重新检查 Git 状态；不得覆盖 `reqflow/src/**/ai/`、`reqflow/src/components/chat/`、`reqflow/src/components/app-settings/AI*`、`reqflow/src-tauri/src/ai/` 及其共享入口中的并行改动。
- v3 不迁移旧 Markdown、`schema.json` 或旧看板业务数据；可以替换旧主数据链路，但不得借机删除 AI 独立工作流的数据和配置。
- 每次只执行一个获批准 Phase。完成后必须通过 Code Review、测试完整性、编译验证和功能测试，再等待下一 Phase 批准；用户未明确要求时不提交、不推送。当前用户要求以真实应用逐项验收为界，验收前仅执行字段管理重构的定向验证，不提前触发全套收口门禁。

## 2. 计划来源台账

| 来源 | 分类 | 当前判断 | 对根计划的处理 |
|---|---|---|---|
| `Product-Spec.md` | 当前事实 / 已确认 | 146 条稳定编号，OPEN-001～009 已关闭；文件中不再夹带 v2 正文 | 全量进入覆盖矩阵；冻结 v2 只存在于 `docs/archive/Product-Spec-v2.md` |
| `Design-Brief.md` | 当前事实 / 已确认 | 11 条设计方向可直接指导开发；文件中不再夹带 v2 正文，完整视觉稿暂不制作 | 产品外壳 Phase 统一落值，并用真实窗口完成视觉与响应式验收 |
| 本文件 Phase 32～45 | 当前计划 / 已定稿 | Phase 32～44 已完成；Phase 45 已覆盖并获整体批准 | Phase 45 保持进行中，直至用户在真实应用验收后明确说“通过” |
| `initiatives/ai-assistant/*` | 并行 initiative / 已完成独立交接 | 2026-08-12 已完成可复验交接，事实源与契约已纳入 Phase 43 | 主产品按 v3 宿主契约接入，不改 AI Core 所有权 |
| `initiatives/ai-assistant/INTEGRATION-CONTRACT.md` | 并行接入契约 / 已完成交接 | 所有权边界、v3 字段映射、稳定身份、快照与动作错误契约已记录 | Phase 43 继续完成主产品适配与验证 |
| `docs/future/AI-Schema生成-设计方案.md` | 未来提案 | 基于冻结 v2 Schema 模型，不属于 v3 P0 | 与当前入口隔离，不进入根计划 |
| `docs/archive/Schema-自定义机制-讨论稿.md` | 历史归档 | Phase 1～31 的旧模型，已被 v3 推翻 | 仅供旧代码注释和历史回归，不得覆盖当前 Spec |
| `docs/archive/PHASE-HISTORY-01-31.md` | 已完成历史 | Phase 1～31 已完成 | 只保留索引，Git 保存逐行历史，不重新激活 |

## 3. 跨文档覆盖矩阵

下表覆盖 `Product-Spec.md` 全部 146 条稳定编号和 Design Brief 11 条基线。这里的“已映射”只证明没有漏项，不代表 Phase 已获准执行。

| 当前事实 | 承载 Phase | 覆盖状态与说明 |
|---|---|---|
| BRAND-001～003 | 33、44 | 已映射；先改用户可见品牌，内部技术标识仅在有收益时处理 |
| BASE-001～006 | 32～44 全局门禁，重点 33、34、36、40、44 | 已映射；本地单人、表格核心、看板派生、统一术语和成熟惯例贯穿所有 Phase |
| IA-001～002 | 32、34 | 已映射；项目—表—视图身份先进入数据与导航合同 |
| IA-003～004 | 33、45 | 已映射；45 把收起态统一为 48px 图标窄栏，不重写既有宽度偏好 |
| IA-005～009 | 34、45 | 已映射；45 收口项目切换职责、标题栏新建表、表图标与菜单浮层 |
| IA-010 | 34 | 已映射；表头、视图标签和视图工具栏三层结构 |
| IA-011～013 | 33、34、43、45 | 已映射；45 移除标题栏品牌字标并明确左侧控件顺序，不改 AI 宿主 |
| EXP-001～017 | 33、36、37、40、42、44、45 | 已映射；45 定向复验侧栏状态、浮层、键盘和窄窗连续性 |
| DATA-001～003 | 32、45 | 已映射；45 为 `data_tables` 安全补充持久化图标字段与默认回退 |
| DATA-004～005 | 32、36、39、40、44 | 已映射；基准前置，查询、表格、看板及最终性能均留证据 |
| DATA-006 | 42 | 已映射；项目内附件复制及相对引用 |
| DATA-007 | 32、35、38、41、42 | 已映射；Rust 事务基础后贯穿所有写入入口 |
| DATA-008 | 42 | 已映射；升级前、每日、手动备份与恢复 |
| FIELD-001 | 32、35、36 | 已映射；数据不变量、字段管理和冻结主标题分别验收 |
| FIELD-002～010 | 35；其中图片/文件完整链路在 42 | 已映射；字段语义先建，文件系统动作后接 |
| FIELD-011～013 | 32、35、38 | 已映射；Undo 基础、字段逆操作和统一用户入口分层交付 |
| FIELD-014～016 | 35、36 | 已映射；表级字段组结构与视图级布局分开实现 |
| FIELD-017～019 | 35、39 | 已映射；选项事务与视图规则重写共同验收 |
| VIEW-001～004 | 32、34，并由 36、39、40 验证配置隔离 | 已映射 |
| VIEW-005～006 | 34 | 已映射；视图标签平铺、拖拽和溢出行为 |
| TABLE-001～002 | 35、36 | 已映射；表级字段管理与视图级字段显示分工 |
| TABLE-003～006 | 37 | 已映射；选择、编辑和键盘合同 |
| TABLE-007～009 | 38 | 已映射；剪贴板、批量操作和右键菜单 |
| TABLE-010～015 | 39 | 已映射；单级分组、投影、组内新增与拖拽 |
| TABLE-016～023 | 39 | 已映射；搜索、筛选、排序、分组、条件填色与处理顺序 |
| TABLE-024～030 | 36 | 已映射；字段布局、两层表头、列宽、冻结和重置 |
| BOARD-001～017 | 40 | 已映射；全部看板规则由同一记录模型派生 |
| DETAIL-001～007 | 33、41 | 已映射；外壳显隐由 33，详情字段和既有 Tab 复用由 41 |
| DETAIL-008～012 | 41 | 已映射；活动 Tab 显式关联普通单选字段，不扩张 Tab 系统 |
| AI-001～004 | 33、43 + AI 独立计划 | 已映射；独立能力开发与主产品宿主接入分账 |
| TEMPLATE-001～004 | 34、41 | 已映射；项目入口与模板内容分层交付 |
| NON-001～007 | 32～44 范围门禁，44 最终审计 | 已映射；不得因实现便利夹带协作、跨表、额外视图、迁移或导入导出 |
| V3-DB-001～011 | 33，36～44 各自复验 | 已覆盖；33 统一落值，各 UI Phase 在真实窗口复验，不要求预先制作设计稿 |
| AI 接入契约第 2～13 节 | 43 | 已完成交接：所有权边界、v3 映射和动作错误语义已更新；主产品验证进行中 |

### 3.1 覆盖审计结论

- 产品需求覆盖：146 / 146 条已映射，无未覆盖产品编号。
- 设计方向覆盖：11 / 11 条已映射；精确落值和关键状态由对应 UI Phase 在真实窗口中完成。
- 当前全局阻断：无。根计划已满足定稿条件，Phase 32～44 已完成并通过统一验收。
- 当前局部阻断：无交接阻断；仍需完成主产品适配、删除故障注入和全量构建验证。
- 历史与未来材料均已分类，不再与当前事实竞争。

### 3.2 Phase 粒度审计

| Phase | 当前判断 | 定稿动作 |
|---|---|---|
| 32 数据内核与项目包 | 已收敛 | 合并为项目包与数据库、事务与 Undo、最小领域模型与性能基准 3 个内聚交付簇 |
| 33 响应式产品外壳 | 已收敛 | 直接按 Spec 与 Design Brief 在真实窗口实现和验收，不增加前置设计流程 |
| 34 导航生命周期 | 功能内聚，可独立验收 | 保留，按 Product Spec 与 Design Brief 校正组件命名和项目/表/视图操作入口 |
| 35 字段与记录领域 | 已收敛 | 合并为记录/字段类型、字段结构/转换、选项影响事务 3 个交付簇 |
| 36～38 表格基础交互 | 分层合理 | 保留渲染 → 编辑 → 批量/Undo 的依赖顺序，按设计状态补齐文件与验收 |
| 39 视图工具与分组 | 已收敛 | 保留同一 Phase，以查询管线、分组投影、条件填色/工具栏 3 个交付簇统一验收 |
| 40 派生看板 | 功能内聚 | 保留；全屏宽高和可见区是完成门禁，不留给最终收口补救 |
| 41 详情、活动与模板 | 已收敛 | 保留同一 Phase，以详情宿主、活动关联、模板/旧 Tab 回归 3 个交付簇分别验收 |
| 42 附件、备份与恢复 | 已收敛 | 保留同一 Phase，以附件生命周期、备份恢复、故障状态 3 个交付簇分别做故障注入 |
| 43 AI 宿主接入 | 结构合理，已批准实施 | 只通过 v3 宿主适配器接入；不扩张到 AI 写入、跨表分析、文件解析、在线协作或 Phase 44 收口 |
| 44 最终收口 | 已完成 | 保留既有验收结论，不因后续局部迭代重写历史阶段 |
| 45 顶栏与表导航迭代 | 范围已收敛并获批准 | 只改标题栏职责、侧栏双态、表图标持久化和操作菜单，不夹带表格、看板、AI 或数据模型重构 |

结论：Phase 32～44 已完成；Phase 45 作为独立 UI / 存储小迭代，范围已收敛到 3 个内聚交付簇并进入执行。

## 4. 技术方案

### 4.1 现有基线与计划选型

| 层级 | 技术 | 版本 / 基线 | 用途与结论 |
|---|---|---|---|
| 桌面容器 | Tauri | 2.x（现有锁定版本） | 保留现有 macOS 桌面架构、系统菜单、窗口、文件选择与 Rust IPC |
| 前端 | React | 19.1.x（现有） | 产品外壳、表格、看板、详情和 AI 宿主 |
| 语言 | TypeScript | 7.0.x（现有） | 前端领域类型、状态与组件 |
| 状态 | Zustand | 5.0.14（现有） | 当前会话 UI 状态、选择、视图和瞬时 Undo 协调；数据库仍是事实来源 |
| 样式 | Tailwind CSS + CSS 语义 Token | 4.3.3（现有） | 实现 v3 浅色/深色、系统材质降级与组件状态，不引入第二套 UI 框架 |
| 表格状态引擎 | `@tanstack/react-table` | 8.21.3 稳定版 | 用户已选择自建 Morfra 表格交互层；不采用 v9 alpha |
| 可见区渲染 | `@tanstack/react-virtual` | 3.14.8 | 同时虚拟化行与列，满足 10,000 行、200 字段目标 |
| 拖拽 | dnd-kit | 现有锁定版本 | 复用字段、视图、记录和看板拖拽基础设施 |
| 项目数据库 | SQLite + Rust `rusqlite` | `rusqlite` 0.40.1，启用 `bundled`、`backup` | dev-planner 当前建议；随整份计划审阅。每个项目自包含一份数据库，Rust 域命令守住事务、不变量和任意本地项目路径 |
| 测试 | Vitest + Testing Library + Cargo test | 现有锁定版本 | 前端交互、状态、Rust 事务、迁移与故障路径 |
| 包管理器 | pnpm | 现有项目配置 | 依赖安装与前端脚本唯一入口 |

### 4.2 核心架构决策

1. **表格采用 Headless 自建路线**：TanStack Table 负责列、排序、筛选、分组等状态模型，TanStack Virtual 只负责可见行列；单元格选择、编辑、剪贴板、字段控件和状态视觉由 Morfra 实现，避免被第三方整套 Grid 的交互与皮肤锁定。
2. **数据库只通过 Rust 领域命令访问**：前端不得接收任意 SQL 执行能力。Rust 按项目路径打开 `morfra.sqlite3`，验证项目元信息后再提供受类型约束的命令。
3. **动态字段采用关系型核心 + 类型化单元格值**：表、字段、选项、记录和多选关系规范化存储；灵活的视图展示配置使用带版本的 JSON，但必须由 Rust 解析、校验和重写，不能成为不受控字符串。
4. **事务与 Undo 是同一领域边界**：所有数据修改先在 Rust 中完成一次事务；需要撤销的命令把精确逆操作保存在当前会话的 50 步内存栈，`Command + Z` 触发新的原子事务恢复。应用退出即清空，不落数据库、不提供 Redo。
5. **查询与渲染分离**：SQLite 完成候选记录筛选、稳定排序及必要索引；前端只接收当前表/视图需要的数据快照，再进行可见区渲染。不得把 10,000×200 的完整 DOM 或完整 React 组件树一次性挂载。
6. **应用偏好与项目数据分开**：最近项目、外观、侧栏和面板宽度保存在应用级偏好；表、字段、记录、视图、详情布局和活动记录保存在项目数据库。响应式自动收缩只改变瞬时呈现，不覆盖用户偏好。
7. **AI 通过契约接入**：主产品只提供稳定 `tableId`、只读快照、当前选择和打开记录动作；不读取或改写 AI 会话内部文件。Phase 43 接入前已完成 AI 独立流程交接并复核 `initiatives/ai-assistant/INTEGRATION-CONTRACT.md`。

### 4.3 项目文件包

```text
<Morfra 项目>/
├── project.json              # 项目标识、名称、格式版本
├── morfra.sqlite3            # 表、字段、记录、视图、详情与活动数据
├── attachments/              # 复制进入项目的图片与文件
└── backups/                  # 最近 7 份自动/手动备份
```

- SQLite 开启外键约束、WAL、合理的 busy timeout 和事务回滚；数据库结构升级前先生成备份。
- `project.json` 只保存发现项目所需的最小元信息，不复制数据库内业务结构。
- 备份必须使用 SQLite 在线备份 API 或等价一致性机制，不得在数据库写入时直接复制主文件。

## 5. 数据库表

| 表名 | 首次建立 Phase | 用途 |
|---|---|---|
| `project_meta` | Phase 32 | 项目标识、名称、格式版本和创建/修改时间 |
| `data_tables` | Phase 32 | 项目内多张表及稳定顺序 |
| `views` | Phase 32 | 表格/看板视图身份、名称、类型和顺序 |
| `view_configs` | Phase 32 | 带版本的筛选、排序、分组、布局、条件填色等视图配置 |
| `field_groups` | Phase 35 | 表级单层字段组及基准顺序 |
| `fields` | Phase 35 | 字段类型、主标题约束、配置和表级顺序 |
| `field_options` | Phase 35 | 单选/多选选项、颜色和顺序 |
| `records` | Phase 35 | 记录身份、创建/修改时间、自动编号和手动顺序 |
| `cell_values` | Phase 35 | 文本、数字、日期、布尔、链接等类型化单元格值 |
| `multi_select_values` | Phase 35 | 多选字段的记录—选项有序关系 |
| `board_column_orders` | Phase 40 | 看板视图内列顺序与折叠状态 |
| `board_card_positions` | Phase 40 | 看板视图内记录投影的独立位置 |
| `detail_layouts` | Phase 41 | 表级详情显示字段及顺序 |
| `detail_tabs` | Phase 41 | 模板带入的既有 Tab 定义及活动字段关联 |
| `activity_events` | Phase 41 | 关联单选字段变化的时间、字段名及前后值快照 |
| `activity_comments` | Phase 41 | 活动节点说明与评论 |
| `attachments` | Phase 42 | 图片/文件元数据、项目内相对路径和引用关系 |

数据库迁移文件从 `reqflow/src-tauri/migrations/001_v3_init.sql` 开始；迁移编号只增不改，测试必须覆盖空库升级、重复打开和失败回滚。

## 6. 功能依赖图

```text
Phase 32 SQLite 数据内核
   ├──> Phase 33 v3 视觉与响应式外壳
   │       └──> Phase 34 项目 / 表 / 视图导航
   │                └──> Phase 35 字段与记录领域
   │                         └──> Phase 36 虚拟化表格画布
   │                                  └──> Phase 37 选择、编辑与键盘
   │                                           └──> Phase 38 剪贴板、批量操作与 Undo
   │                                                    └──> Phase 39 视图工具与表格分组
   │                                                             └──> Phase 40 派生看板
   │                                                                      └──> Phase 41 详情、活动与模板
   └──> Phase 42 附件、备份与恢复

Phase 34 + Phase 38 + Phase 41
   └──> Phase 43 AI 宿主契约接入

Phase 32–43
   └──> Phase 44 性能、可访问性与 v3 收口

Phase 44
   └──> Phase 45 顶栏与表导航迭代

Phase 35 + 当前字段布局维护
   └──> Phase 46 字段管理模态导航重构
```

Phase 42 的底层备份机制可在 Phase 33–41 期间独立开发，但默认按编号顺序执行，避免同一进程同时修改 Rust 存储边界。

## 7. 分阶段开发计划

**全部 Phase 通用产品门禁：** BASE-001、BASE-002、BASE-006、NON-001～004。任何 Phase 都必须保持 macOS 本地单人定位，只借鉴而不复刻竞品；未定义的成熟表格交互按 BASE-006 处理，并禁止夹带在线协作、跨表计算、AI 写入、额外视图或自动化工作流。该门禁必须与当前 Phase 的“关联需求”一起进入实现和 Code Review 上下文。

## Phase 32：SQLite 数据内核与本地项目包

**状态：已完成（2026-08-09；Code Review、测试、编译、功能验证均通过）**

**关联需求：** DATA-001～008、IA-001～002、FIELD-001、VIEW-001～004、TEMPLATE-002、NON-005

**交付内容：**

- 建立每项目 `project.json + morfra.sqlite3 + attachments + backups` 的目录合同、Rust 数据库连接、初始迁移、外键/WAL/一致性校验和结构化错误，支持创建、验证、打开及安全关闭项目，不向前端开放任意 SQL。
- 建立表、唯一主标题字段、默认表格视图和空记录集合的最小领域模型，并用 Rust 原子事务与当前会话 50 步 Undo 证明失败零部分写入、重启清空撤销栈。
- 建立 10,000 条记录、200 字段的基准数据生成器与查询基线；空白项目必须能创建、显示最小身份信息并从同一目录重新打开。

**关键文件：**

- `reqflow/src-tauri/src/storage/mod.rs` — 存储模块入口和 Tauri 注册边界。
- `reqflow/src-tauri/src/storage/connection.rs` — 项目数据库连接、PRAGMA 与路径验证。
- `reqflow/src-tauri/src/storage/migrations.rs` — 迁移注册、升级前保护和失败回滚。
- `reqflow/src-tauri/src/storage/repository.rs` — 表、视图、字段和记录的领域仓库。
- `reqflow/src-tauri/src/storage/commands.rs` — 受约束的项目与数据命令。
- `reqflow/src-tauri/src/storage/undo.rs` — 当前会话事务逆操作栈。
- `reqflow/src-tauri/migrations/001_v3_init.sql` — v3 初始数据库结构和索引。
- `reqflow/src-tauri/Cargo.toml`、`reqflow/src-tauri/Cargo.lock` — 增加并锁定 SQLite 依赖；保留 AI 进程已加入的依赖。
- `reqflow/src-tauri/src/lib.rs` — 以增量方式注册 storage 模块和命令，不覆盖 AI 命令注册。
- `reqflow/src/types/domain.ts` — 前端稳定项目、表、字段、视图与记录类型。
- `reqflow/src/lib/ipc/storageClient.ts` — 类型化 Tauri IPC 客户端。

**共享文件规则：** `Cargo.toml`、`Cargo.lock` 与 `src-tauri/src/lib.rs` 当前已有 AI 独立进程改动。Phase 32 开始时必须先读取这三份文件及其未提交 diff，只做保留现有 AI 声明的增量合并；若另一进程仍在同时写入，先完成可隔离的 storage 模块，待其形成稳定存档点后再合并共享入口。共享入口未安全合并前，Phase 32 不得判定完成。

**验收标准：**

- 应用能创建一个空白 Morfra 项目，显示项目名、默认表和默认表格视图；重启后从同一文件夹恢复。
- 任一迁移或多步写入中途失败时，数据库不留下部分表、字段、记录或视图。
- 关闭应用后 Undo 栈为空；同一会话撤销可精确恢复测试事务。
- 基准数据能在 release 构建中完成常用候选查询并记录证据；若任何核心查询明显超过 300ms，不得进入 Phase 33，先修正索引或模型。
- `cargo test`、`cargo check`、`pnpm test`、`pnpm build` 全部通过，现有 AI Rust 命令仍可编译且未被覆盖。

---

## Phase 33：v3 语义视觉与响应式产品外壳

**状态：已完成（2026-08-09；Code Review、测试、编译、功能验证均通过）**

**关联需求：** IA-003～004、IA-010～013、EXP-001～017；Design Brief V3-DB-001～011

**交付内容：**

- 用 v3 中性色阶、固定冷蓝强调色和独立业务/状态色建立统一语义 Token，提供跟随系统、浅色、深色及减少动态/降低透明度适配，并在真实窗口完成对比度与关键状态验收。
- 建立 macOS 标题栏、左侧导航、主显示区、详情和 AI 的响应式宿主，落实固定侧栏、双右栏、合并单栏和互斥抽屉；用户偏好与自动收缩状态分离保存。
- 实现 960×640、临界宽度、常规和全屏的实际宽高连续重排，消除结构性空白，并把用户可见品牌与窗口标题更新为 Morfra，内部技术标识暂不迁移。

**关键文件：**

- `reqflow/src/styles/tokens.css` — v3 浅深模式语义 Token 和材质降级。
- `reqflow/src/styles/global.css` — SF 字体、滚动、焦点、减少动态效果与窗口基础样式。
- `reqflow/src/components/layout/MorfraShell.tsx` — 响应式区域编排根组件。
- `reqflow/src/components/layout/WindowTitlebar.tsx` — 导航与 AI 开关的标题栏宿主。
- `reqflow/src/components/layout/RightPanelHost.tsx` — 详情/AI 双栏、单栏和抽屉状态机。
- `reqflow/src/stores/layoutStore.ts` — 用户偏好与瞬时响应式状态分离。
- `reqflow/src/lib/layout/windowLayout.ts` — 宽度、高度和面板优先级纯函数。
- `reqflow/src-tauri/tauri.conf.json` — Morfra 窗口标题及 960×640 最小尺寸。

**验收标准：**

- 960×640、1199px、1200px、常规窗口和全屏五组尺寸均可操作，主区域按真实剩余宽高填满。
- 详情与 AI 在宽屏可同时打开；空间不足时按 Spec 收缩、合并或抽屉化，恢复宽度后用户偏好不被改写。
- 浅色、深色、跟随系统、减少动态效果和降低透明度均能即时切换且不丢失信息。
- 页面不再使用 v2 紫绿/禁灰 Token 作为 v3 当前视觉事实，普通文字和焦点对比度通过门禁。
- 定向组件测试、布局纯函数测试、`pnpm build` 和 macOS Tauri 窗口回归通过。

---

## Phase 34：项目、表与视图导航生命周期

**状态：已完成（2026-08-09；Code Review、测试、编译和功能验证均通过）**

**关联需求：** IA-005～011、VIEW-001～006、TEMPLATE-001～002

**交付内容：**

- 实现标题栏文件菜单和左侧项目切换器，支持最近项目、新建、打开、移除最近记录和项目整体切换。
- 实现当前项目的单层表列表及完整生命周期：新建、重命名、删除、拖拽排序、最后一张表保护，并预留无副作用的 AI `table-deleted` 端口。
- 实现主区“表头 → 单行视图标签 → 当前视图工具栏”结构及视图完整生命周期，覆盖横向滚动、全部视图菜单和当前标签自动可见，不夹带表搜索、文件夹或全局搜索。

**关键文件：**

- `reqflow/src/components/sidebar/ProjectSwitcher.tsx` — 最近项目及新建/打开入口。
- `reqflow/src/components/sidebar/TableList.tsx` — 当前项目表列表与拖拽排序。
- `reqflow/src/components/workspace/TableHeader.tsx` — 表名与表级操作。
- `reqflow/src/components/workspace/ViewTabBar.tsx` — 单行视图标签及溢出菜单。
- `reqflow/src/components/workspace/ViewToolbar.tsx` — 当前视图工具宿主。
- `reqflow/src/stores/workspaceStore.ts` — 当前项目、表、视图和最近项目协调。
- `reqflow/src-tauri/src/storage/commands.rs` — 项目、表和视图生命周期事务。

**验收标准：**

- 用户能在两个本地项目间切换，每个项目只显示自己的表和视图；重启后最近项目顺序正确。
- 新表自动获得唯一主标题字段和默认表格视图；最后一张表和最后一个视图不可删除。
- 删除表一次事务移除其数据库数据和附件引用，并支持当前会话撤销。
- 50 个视图标签不会被压成不可读宽度；键盘、滚轮/触控板和全部视图菜单均可到达目标视图。
- 定向测试、`cargo test`、`pnpm build` 与最小/全屏窗口回归通过。

---

## Phase 35：字段系统与记录领域

**状态：已完成（2026-08-10；Code Review、测试、编译、功能验证均通过）**

**关联需求：** FIELD-001～019、TABLE-001～002、DETAIL-001～003

**交付内容：**

- 实现记录创建、删除、类型化读写，以及 P0 全部字段类型、唯一主标题、自动编号和创建/最后编辑时间，为表格、看板和详情提供同一底层数据。
- 实现表级字段管理、单层字段组和基准顺序，以及字段新增、重命名、删除、类型转换、有损影响预览和当前会话 Undo。
- 实现单选/多选选项颜色、排序、填写时新增、重命名和删除；已使用选项按“替换/清空”统计影响，并在同一事务中改写记录与视图引用。

**关键文件：**

- `reqflow/src/components/fields/FieldManager.tsx` — 表级字段和字段组管理。
- `reqflow/src/components/fields/FieldEditor.tsx` — 字段类型与配置编辑。
- `reqflow/src/components/fields/OptionEditor.tsx` — 选项颜色、排序和删除影响流程。
- `reqflow/src/components/fields/FieldTypeConversionDialog.tsx` — 有损转换预览与确认。
- `reqflow/src/stores/tableDataStore.ts` — 当前表字段、记录与事务结果状态。
- `reqflow/src/lib/fields/valueConversion.ts` — 与 Rust 同合同的可预览转换规则。
- `reqflow/src-tauri/src/storage/field_repository.rs` — 字段、选项、组及转换事务。
- `reqflow/src-tauri/src/storage/record_repository.rs` — 记录与类型化单元格值。

**验收标准：**

- 一张表可建立 200 个字段并保持唯一主标题约束；字段组不会嵌套，跨视图成员关系一致。
- 字段转换、字段删除和已使用选项删除在失败时零写入，成功后一次撤销精确恢复 ID、配置、值和视图引用。
- 多选替换去重且保留其他选项顺序；清空不误删其他选项，活动历史快照不被重写。
- 所有字段值可由同一记录 API 在后续表格、看板和详情中读取，不保留“阶段”特殊底层字段。
- Rust 事务测试、前端影响预览测试、`cargo check`、`pnpm build` 通过。

---

## Phase 36：虚拟化表格画布与字段布局

**状态：未批准**

**关联需求：** DATA-004～005、TABLE-020、TABLE-024～030、EXP-005、EXP-008、EXP-011～013

**交付内容：**

- 使用 TanStack Table v8 与 TanStack Virtual 建立同时虚拟化行列的表格画布，只挂载可见单元格，并让实际窗口增宽、增高和全屏时显示更多行列。
- 实现行号/详情入口、两层字段组表头、主标题固定、连续冻结区、组折叠占位和横向滚动；滚动区不足 280px 时临时减少有效冻结列而不改偏好。
- 实现字段显隐、组块/组内顺序、列宽拖拽与自动适配、三档行高和当前视图布局重置，保证表头与数据列在全部状态下对齐。

**关键文件：**

- `reqflow/src/components/table/DataGrid.tsx` — 表格状态与虚拟化编排。
- `reqflow/src/components/table/GridHeader.tsx` — 字段组、列头、冻结和宽度控制。
- `reqflow/src/components/table/GridBody.tsx` — 可见行列渲染。
- `reqflow/src/components/table/GridCell.tsx` — 类型化只读展示基座。
- `reqflow/src/components/table/FieldVisibilityPanel.tsx` — 当前视图字段布局。
- `reqflow/src/lib/table/columnLayout.ts` — 组块、冻结和有效宽度计算。
- `reqflow/src/lib/table/virtualGrid.ts` — 行列虚拟窗口与 overscan 合同。

**验收标准：**

- 10,000×200 基准表滚动时 DOM 只包含可见区及有限 overscan，不一次性创建全部单元格。
- 960×640 和全屏下都能水平、垂直滚动；冻结列不会吞掉全部编辑区，新增空间不会形成结构性空白。
- 字段组跨冻结边界、折叠/展开、隐藏/恢复和布局重置均保持表头与数据列对齐。
- 视图切换后列宽、显隐、顺序、冻结和行高准确恢复；复制视图完整复制布局。
- 生产构建滚动回归、布局纯函数测试、组件测试和 `pnpm build` 通过。

---

## Phase 37：单元格选择、编辑与键盘合同

**状态：未批准**

**关联需求：** TABLE-003～006、EXP-014～016

**交付内容：**

- 实现活动单元格、连续矩形区域、整行连续/非连续选择及稳定覆盖层，并区分只读、错误、焦点、选中和编辑状态。
- 实现先选中后编辑、直接输入替换、提交/取消和全部 P0 类型化编辑器入口，确保虚拟滚动及窗口变化不会卸载编辑上下文。
- 实现方向键、Tab、Return、Shift、Space 和 macOS 右键语义，自动保持目标可见，并完成键盘、屏幕阅读器及减少动态效果验收。

**关键文件：**

- `reqflow/src/components/table/GridSelectionLayer.tsx` — 单元格区域与活动格视觉。
- `reqflow/src/components/table/GridCell.tsx` — 选中、编辑和只读状态切换。
- `reqflow/src/components/table/editors/CellEditorHost.tsx` — 类型化编辑器宿主。
- `reqflow/src/components/table/editors/SelectEditor.tsx` — 单选/多选草稿和提交。
- `reqflow/src/components/table/editors/DateEditor.tsx` — 日期/时间编辑。
- `reqflow/src/lib/table/selectionModel.ts` — 区域、行选择和活动格纯模型。
- `reqflow/src/lib/table/keyboardNavigation.ts` — 选中/编辑键盘状态机。
- `reqflow/src/stores/gridInteractionStore.ts` — 当前视图瞬时选择与编辑状态。

**验收标准：**

- TABLE-003～006 的鼠标与键盘合同逐项通过；边界处停止，不循环、不自动增行。
- 编辑状态在滚动、窗口变化和鼠标移出时不丢失；错误、焦点、选中、悬停和条件填色优先级正确。
- 只读单元格可选择复制但不能编辑，尝试编辑能得到非阻断原因提示。
- 键盘操作始终保持目标可见，屏幕阅读器能读出行列、字段名、值及编辑错误。
- 组件交互测试、状态机单测、生产构建和 macOS 键盘回归通过。

---

## Phase 38：剪贴板、批量操作与事务撤销

**状态：未批准**

**关联需求：** FIELD-011～013、TABLE-007～009、DATA-007、NON-007

**交付内容：**

- 实现 TSV 与 Morfra 内部类型语义的复制粘贴，支持矩形映射、单值填充和原子补行；粘贴前全量校验，任何非法目标都整次拒绝并汇总原因。
- 实现 Delete 清空、同字段统一设置、连续/非连续行批量删除和上下文菜单，把所有修改统一接入 Rust 原子事务与 50 步 Undo。
- 实现带撤销的轻量 Toast、持续自动保存失败状态和重试；普通自动保存成功保持安静。

**关键文件：**

- `reqflow/src/lib/table/clipboard.ts` — TSV 与内部类型剪贴板编码。
- `reqflow/src/lib/table/pastePlan.ts` — 目标映射、转换和完整校验计划。
- `reqflow/src/components/table/GridContextMenu.tsx` — 单元格、同字段与行上下文操作。
- `reqflow/src/components/table/BulkDeleteDialog.tsx` — 记录数量确认。
- `reqflow/src/stores/undoStore.ts` — 当前会话 Undo 协调和 Toast 摘要。
- `reqflow/src-tauri/src/storage/mutation_commands.rs` — 单值、批量、粘贴和删除事务。
- `reqflow/src-tauri/src/storage/undo.rs` — 精确逆操作执行。

**验收标准：**

- 与外部表格之间的中英文、空值、日期、数字和选项 TSV 复制粘贴可互通。
- 任一目标单元格非法时整次粘贴无写入；合法粘贴和自动补行只产生一个 Undo 项。
- 批量清空、统一设值和删除记录分别一次撤销，恢复所有值、活动节点和视图可见结果。
- Undo 深度恒为 50、退出即清空、无 Redo；保存失败不显示成功状态。
- 前端剪贴板测试、Rust 故障注入事务测试、`cargo test`、`pnpm build` 通过。

---

## Phase 39：视图工具、条件填色与单级表格分组

**状态：未批准**

**关联需求：** TABLE-010～023、FIELD-012、FIELD-017～019

**交付内容：**

- 实现临时搜索、顶层 AND/OR 多条件筛选、多字段稳定排序和固定数据处理管线，并在目标规模下满足响应时间。
- 实现单级分组、组序、折叠、计数、组内新增/排序和跨组字段写入，正确处理多选投影的底层唯一、同步编辑与唯一总数。
- 实现字段自身条件填色、规则管理、浅深模式业务色对，以及工具栏激活态、数量徽标、窄宽度“更多”收纳和视图配置自动保存。

**关键文件：**

- `reqflow/src/components/table/tools/SearchControl.tsx` — 临时搜索。
- `reqflow/src/components/table/tools/FilterPanel.tsx` — 类型化筛选条件。
- `reqflow/src/components/table/tools/SortPanel.tsx` — 多字段稳定排序。
- `reqflow/src/components/table/tools/GroupPanel.tsx` — 单级分组设置。
- `reqflow/src/components/table/tools/ConditionalColorPanel.tsx` — 条件填色规则。
- `reqflow/src/lib/table/viewPipeline.ts` — 筛选、搜索、分组、排序和渲染顺序。
- `reqflow/src/lib/table/groupProjection.ts` — 单值/多值投影及唯一计数。
- `reqflow/src-tauri/src/storage/query_repository.rs` — 索引化筛选、排序和候选记录查询。

**验收标准：**

- 固定执行顺序与 Spec 一致；清除某一工具不会修改其他配置或底层记录。
- 所有可分组字段、空组、选项空列、动态组、折叠和正倒序规则逐项通过。
- 多选投影总数保持唯一，跨组拖拽事务和撤销只改变预期选项。
- 条件填色永远不遮蔽错误、编辑、焦点、选中和拖拽状态，浅深模式文字均可读。
- 10,000 条记录下常用搜索、筛选、排序和视图切换在 release 构建中不超过 300ms。

---

## Phase 40：派生看板视图

**状态：未批准**

**关联需求：** BASE-003～004、BOARD-001～017、EXP-005、EXP-008

**交付内容：**

- 基于同一表记录和视图配置实现任意非主标题字段分组、单/多值投影、动态列、未分组和唯一计数，不建立第二套“阶段”数据模型。
- 实现列顺序/折叠、卡片独立位置、字段显示/排序、筛选/搜索，以及列内新增、卡片编辑、跨列拖拽、移出分组和删除的事务与撤销。
- 使用可见列/卡片窗口化，使看板按实际可用宽高和全屏真实扩展，并用 10,000 记录数据验证渲染范围。

**关键文件：**

- `reqflow/src/components/board/KanbanView.tsx` — v3 看板编排与可见区。
- `reqflow/src/components/board/KanbanColumn.tsx` — 列头、折叠、计数和快速新增。
- `reqflow/src/components/board/KanbanCard.tsx` — 主标题、字段展示和直接编辑。
- `reqflow/src/lib/board/boardProjection.ts` — 任意字段分组和多值投影。
- `reqflow/src/lib/board/boardOrdering.ts` — 列顺序与各投影位置。
- `reqflow/src-tauri/src/storage/board_repository.rs` — 看板位置、列配置和跨组事务。

**验收标准：**

- 同一记录在表格、看板和其他视图中只有一份底层数据，任一入口修改后同步呈现。
- 多选记录可在多个列独立排序；从 A 拖到 C 只移除 A、加入 C并保留其他值。
- 更换分组字段不改记录数据，手动位置失效前提示且可撤销。
- 全屏后看板列和视口延伸到可用底部并利用横向空间，不再只平移常规窗口画布。
- 看板组件测试、投影纯函数测试、拖拽回归和 10,000 记录可见区验证通过。

---

## Phase 41：记录详情、活动关联与项目模板

**状态：未批准**

**关联需求：** DETAIL-001～012、TEMPLATE-001～004、NON-006

**交付内容：**

- 实现表级详情显示字段及顺序，主标题位于详情头部，详情显隐遵守外壳状态机；复用既有 Tab 内容，不重做未定义 Tab。
- 为活动 Tab 实现显式单选字段关联、改绑/失效和历史快照，让全部字段修改入口以同一事务生成节点并支持撤销。
- 实现空白项目与需求管理模板；模板只预置普通字段、视图和既有 Tab，不保留隐藏字段特权，并完成非活动 Tab 回归。

**关键文件：**

- `reqflow/src/components/detail/RecordDetailPanel.tsx` — v3 详情宿主与字段区。
- `reqflow/src/components/detail/DetailFieldVisibility.tsx` — 表级详情字段配置。
- `reqflow/src/components/detail/tabs/ActivityTab.tsx` — 关联状态与历史时间线适配。
- `reqflow/src/components/settings/ActivityFieldBinding.tsx` — 活动 Tab 单选字段关联。
- `reqflow/src-tauri/src/storage/activity_repository.rs` — 活动快照、评论和联动事务。
- `reqflow/src-tauri/src/storage/templates.rs` — 空白与需求管理模板创建。
- `reqflow/src/lib/templates/requirementManagement.ts` — 模板前端展示描述与预览。

**验收标准：**

- 详情显示字段不与表格显隐、冻结或看板卡片字段互相覆盖；重启时详情默认关闭。
- 关联字段从表格、粘贴、批量操作、看板或详情变化时，均产生同样的活动节点；初始值和同值写回不产生节点。
- 选项重命名/删除、字段改绑/删除后历史字段名和前后值文本保持原快照。
- 空白项目只含一张表和主标题；需求模板中的“阶段”只是普通单选字段，活动 Tab 通过可见配置关联它。
- 既有非活动 Tab 行为定向回归通过；Rust 事务测试、组件测试和 `pnpm build` 通过。

---

## Phase 42：附件、备份、恢复与故障状态

**状态：未批准**

**关联需求：** DATA-006～008、FIELD-002～004、EXP-016

**交付内容：**

- 实现图片/文件复制进项目附件目录、稳定元数据和相对路径，以及预览/打开、替换、移除和级联引用清理；失败不得留下孤儿或半复制文件。
- 实现每天首次打开、结构升级前和立即备份，轮换最近 7 份；恢复前先保护当前状态，恢复过程包含完整性校验与失败回滚。
- 实现项目/表加载失败、附件缺失、自动保存失败和恢复结果的局部可恢复状态，并用文件系统故障注入验证两个故障域。

**关键文件：**

- `reqflow/src-tauri/src/storage/attachments.rs` — 项目内复制、命名、引用和清理。
- `reqflow/src-tauri/src/storage/backup.rs` — 在线备份、轮换、恢复和完整性校验。
- `reqflow/src/components/fields/ImageCell.tsx` — 图片缩略图、预览和失败状态。
- `reqflow/src/components/fields/FileCell.tsx` — 文件名、打开、替换和缺失状态。
- `reqflow/src/components/settings/BackupSettings.tsx` — 立即备份、备份列表和恢复入口。
- `reqflow/src/stores/recoveryStore.ts` — 备份/恢复进度与错误状态。

**验收标准：**

- 移动或复制整个项目文件夹后，数据库和附件仍能重新打开，绝对旧路径不会写入项目数据。
- 附件复制或事务失败时不产生可见半成品；删除表提示并清理对应附件引用，可通过表删除 Undo 恢复。
- 每天只自动生成首份备份，始终最多保留最近 7 份；结构升级前一定先有可恢复备份。
- 恢复失败时当前项目保持原状态，恢复成功后数据库通过完整性检查并可正常编辑。
- 文件系统故障注入、备份/恢复测试、`cargo test`、macOS 文件打开回归和生产构建通过。

---

## Phase 43：AI 表格助手宿主契约接入

**状态：已完成（2026-08-12）；两阶段审查、自动测试、真实 macOS Keychain smoke 与 Tauri 生产构建均通过**

**关联需求：** IA-011～013、AI-001～004、`initiatives/ai-assistant/INTEGRATION-CONTRACT.md`

**交付内容：**

- 实现主产品 `TableDataAdapter` 和 HostActions，提供稳定表身份、同一捕获时点的只读全表快照、当前有效选择及打开引用记录能力，同时保留 AI 会话与滚动上下文。
- 将标题栏单一 AI 开关接入双栏、合并栏和窄窗抽屉，并在表删除事务中协调 AI 会话删除；任何失败不得静默留下无归属历史。
- 保持 AI Core 与主产品 Store/文件隔离；交接已完成，当前合并共享入口并完成独立、适配、删除和生产构建全量回归。

**关键文件：**

- `reqflow/src/adapters/ai/currentStorageTableAdapter.ts` — 主产品 v3 只读表快照适配与 HostActions。
- `reqflow/src/lib/ai/integrationChecks.ts` — AI 数据生命周期校验与删除级联协调。
- `reqflow/src/components/storage/StorageAIHost.tsx` — 真实存储宿主、面板与删除事件接线。
- `reqflow/src/components/layout/WindowTitlebar.tsx` — 唯一 AI 开关。
- `reqflow/src/components/layout/RightPanelHost.tsx` — AI 的栏位/抽屉宿主状态。
- `reqflow/src/stores/workspaceStore.ts` — 活动表与选择事件源。
- `reqflow/src-tauri/src/lib.rs` — 存储与 AI 命令共同注册的共享入口。

**验收标准：**

- AI 快照包含整张逻辑表且不受当前筛选、搜索、排序、分组和视图影响；字段与记录来自同一捕获时点。
- 点击 AI 记录引用会打开正确表和记录详情，AI 面板、会话及滚动位置不丢失。
- 宽屏、合并单栏和窄窗口抽屉下只有一个 AI 开关真相；响应式变化不改写开关偏好。
- AI 只能读取数据，不能创建、修改或删除表、字段和记录；附件只提供元数据，不读取正文。
- AI 独立测试、主产品适配测试、删除级联故障路径、全量前端/Rust 测试和生产构建通过。

---

## Phase 44：性能、可访问性与 v3 收口

**状态：已完成（2026-08-12；Stage 1/2 审查、性能、macOS 手工验收与统一验证门禁均通过）**

**关联需求：** DATA-004～005、EXP-001～017、BASE-005、BRAND-001～003、全部 v3 验收边界

**交付内容：**

- 完成目标容量、300ms 常用操作、960×640/临界/常规/超宽/全屏矩阵验收，只依据证据优化索引、快照和渲染热点，不把前序功能拖到收口阶段补做。
- 完成浅色/深色/跟随系统、减少动态、降低透明度、键盘、屏幕阅读器、对比度、空/加载/错误/撤销和 Morfra 品牌一致性审计。
- 在新链路全部通过后退出旧看板/Schema/Markdown 数据入口和旧术语，保留必要 AI 适配与历史归档，不删除未授权数据，并输出可复验的 v3 验收证据。

**关键文件：**

- `reqflow/src/App.tsx` — v3 启动、错误恢复和唯一工作区入口。
- `reqflow/src/components/layout/MorfraShell.tsx` — 最终窗口矩阵修正。
- `reqflow/src/components/table/DataGrid.tsx` — 性能与可访问性收口。
- `reqflow/src-tauri/src/storage/query_repository.rs` — 查询计划、索引和性能修正。
- `reqflow/src/styles/tokens.css` — 最终浅深模式与对比度落值。
- `reqflow/src/styles/global.css` — 动效、滚动、焦点和系统设置收口。
- `reqflow/src-tauri/tauri.conf.json` — 用户可见 Morfra 桌面配置。

**验收标准：**

- release 构建中，10,000 条记录下常用筛选、排序、搜索和视图切换 P95 不超过 300ms；测试记录包含机器、数据规模和操作定义。
- 所有窗口矩阵均保留可查看、录入和编辑的主表格；全屏表格/看板按实际宽高扩展，无固定容器底部大空白。
- 浅深模式全部页面和状态通过文字 4.5:1、焦点/非文本控件 3:1 门禁；不以颜色作为唯一反馈。
- 全键盘可完成项目/表/视图切换、单元格选择编辑、工具配置、详情开关和撤销；减少动态/透明度设置生效。
- Code Review Stage 1/2、全量 `pnpm test`、`pnpm build`、`cargo test`、`cargo check`、Tauri 生产构建和 macOS 功能回归全部通过。

---

## Phase 45：顶栏与表导航迭代

**状态：进行中（已批准；等待真实应用验收）**

**关联需求：** IA-004～007、IA-009～011、FIELD-020、VIEW-005、TABLE-016、TABLE-028、TABLE-031、EXP-001、EXP-006、EXP-014～017、DATA-002、DATA-007

**交付内容：**

- 收口标题栏职责：移除 `morfra` 品牌字标；侧栏收放按钮右侧新增“网格 + 小加号”的仅图标新建表入口，项目名称与切换入口继续位于标题栏，并保留足够窗口拖拽区域与既有 AI 开关。
- 修复侧栏新建表命名流程：临时输入框进入列表末尾且自动滚动/聚焦；空白失焦取消，有效名称 Enter 或失焦提交，Esc 无条件取消并恢复触发按钮焦点；创建防重，失败保留名称、错误和可重试焦点，成功后自动选中并打开新表。
- 重做侧栏展开 / 紧凑双态：展开态只显示当前项目的表 Emoji、完整表名和必要操作；48px 紧凑态只显示可点击表 Emoji 和完整表名提示，当前、悬停、聚焦与默认状态有非颜色差异；窄窗浮层、滚动、切表和项目切换继续沿用既有状态机。移除侧栏可见撤销按钮，表生命周期撤销只响应 `Command + Z`。
- 为表增加持久化 Emoji 标识：空库直接建兼容字段，既有项目安全幂等补列并把旧线性图标回退为 `📋`，不重建或改写表内容；新表默认 `📋`，表菜单通过 Portal 打开应用内 Emoji 选择器。目录由 Unicode Emoji 17.0 RGI 与 CLDR 中英文元数据生成，覆盖九类标准 Emoji，提供搜索、分类、跨项目最近使用和重置默认；肤色变体可搜索并折叠在基础 Emoji 的二级变体条中。网格使用约 18px Emoji、28px 点击格和每行约 10 个的紧凑密度，左侧边栏图标尺寸保持不变。选择结果原子更新，失败完整回滚；菜单在可视区域内自动翻转并保留鼠标、键盘、Esc、点击外部关闭和焦点恢复。
- 将左侧边栏完整背景更为不透明、低饱和的 Codex 参考色系极光毛玻璃：以 2–3 个有可感知体积的主体云团与少量近白雾层代替均匀散雾，仅装饰层以 CSS 缓慢无缝自主流动且轻微聚焦/散开呼吸，内容及交互状态保持静止和清晰；不改标题栏、主内容、右侧 AI 面板或侧栏业务逻辑，不使用真透明、系统背景模糊或鼠标响应。`prefers-reduced-motion` 与现有 `data-reduced-motion` 两种模式下停止动画并保留静态画面。
- 为侧栏分隔条增加连续拖拽吸附：96–360px 为可停留且持久化的完整表导航，表名在窄宽度按既有规则裁切，不切换为图标化布局；收起阈值贴近既有 48px 状态，反向越过略大的展开阈值时从 96px 继续跟随指针。保持按钮、偏好持久化、键盘调整、ARIA 与窄窗口规则的既有语义，不新增存储字段。
- 精简表格主工作区：移除表头以下的重复摘要与表格内统计/新建记录横条；视图栏下保留一条纯工具栏，搜索在左、现有视图工具居中、“新建记录”在右。字段表头改为类型纯图标、字段名、更多操作，并在真实字段末尾提供默认文本字段的快速“＋ 添加字段”；记录改为单行，详情入口移至主标题单元格右端；按既有视图类型自动显示网格/分栏图标，不改变记录分组逻辑、数据模型、备份或字段管理位置。
- 统一字段新增：表头与字段管理均先选类型、立即创建同类型中文默认名字段，成功后全选内联改名；允许重名并由字段 ID 区分。创建失败保留选择器和错误，禁止前端假字段；Esc 只取消改名不删除字段。

**关键文件：**

- `reqflow/src/components/layout/WindowTitlebar.tsx` — 标题栏控件顺序、项目切换和新建表入口。
- `reqflow/src/components/layout/MorfraShell.tsx` — 48px 侧栏双态、窄窗浮层与创建流程编排。
- `reqflow/src/components/layout/LayoutResizer.tsx`、`MorfraShell.tsx`、`reqflow/src/lib/layout/windowLayout.ts`、`reqflow/src/stores/layoutStore.ts` — 侧栏拖拽阈值、回弹差、同手势反向展开与真实收起宽度语义。
- `reqflow/src/components/sidebar/TableList.tsx`、`TableActionsMenu.tsx`、`TableEmojiPicker.tsx` — 表列表双态、Emoji 与不裁切菜单。
- `reqflow/src/lib/tableEmojiCatalog.ts`、`reqflow/src/lib/tableEmojiPreferences.ts`、`emojibase-data` — Unicode / CLDR Emoji 分类、双语搜索元数据与应用级最近记录。
- `reqflow/src/stores/projectStore.ts`、`reqflow/src/lib/ipc/storageClient.ts`、`reqflow/src/types/domain.ts` — Emoji 状态、IPC 与前端领域类型。
- `reqflow/src-tauri/src/storage/`、`reqflow/src-tauri/src/commands/` — SQLite 兼容升级、查询映射和 Emoji 原子更新命令。
- `reqflow/src/styles/02-shell.css` — 标题栏、48px 窄栏、状态与浮层样式。
- `reqflow/src/styles/global/02-shell.css` — 仅侧栏的极光毛玻璃装饰层、静态基底与减少动态效果降级。
- `reqflow/src/components/storage/StorageWorkspace.tsx`、`reqflow/src/components/table/{DataGrid,GridHeader,GridBody,GridCell}.tsx`、`reqflow/src/components/view/{TableHeader,ViewToolbar,ViewTools}.tsx` — 表格层级、工具栏、字段表头、记录详情入口与快速新增字段。

**完成标准：**

- 标题栏不再显示品牌字标；项目名称可直接展开切换，切换后表名、图标和主内容来自新项目；新建表按钮有 Tooltip、可访问名称、清晰焦点与 ≥28×28px 热区，并进入既有“未命名表”编辑流程。
- 展开 / 收起 / 再展开、960～1199px 窄窗浮层、≥1200px 常规窗口、侧栏滚动和切表均无文字裁切、项目残留、异常空白或状态丢失；紧凑态只显示图标且可从提示获知完整表名。
- 新旧项目、重复打开和进程重启后 Emoji 一致；新表默认 `📋`，旧表安全回退 `📋`；空值、超长值或故障注入不会留下半更新；兼容迁移不改变任何表内容，相关 Rust 迁移、持久化、重启和回滚测试通过。
- 表菜单完整可见、空间不足时翻转，鼠标和键盘均可重命名、更换 Emoji 或删除；Emoji 选择器覆盖 Unicode Emoji 17.0 的标准 RGI 目录及九类系统分类，可用中英文搜索、跨项目最近记录和重置默认；网格约 18px/28px/10 列且不改变侧栏 Emoji 大小；外部点击和 Esc 关闭后焦点回到原三点按钮。
- 新建表后不显示撤销按钮；焦点不在文本编辑控件时按 `Command + Z` 可撤销当前表生命周期操作，且不会与表格或输入框自己的撤销行为重复触发。
- 仅左侧边栏为不透明低饱和冰蓝/浅蓝紫/柔和薰衣草紫/近白雾光极光毛玻璃，以 2–3 个大尺度云团而非均匀散雾建立体积，光彩自然渗透无硬边与条带；动画缓慢、轻微、无缝并有聚焦/散开呼吸感，不响应鼠标或表项状态，不引起内容位移或重排。所有表项状态保持清晰；减少动态效果下转为同色系静态画面。
- 展开侧栏可停留在 96–360px：中间宽度仍显示 Emoji、表名和必要操作，表名按既有规则裁切；松开与重启后保留该宽度。仅贴近 48px 时才吸附为既有完全收起状态。同手势反向越过较大展开阈值后先显示 96px 再连续跟随指针增宽。临界区不抖动、不跳回原始宽度；按钮、键盘、ARIA、偏好持久化、窗口缩放、空项目和多表项目保持既有行为。
- 表格视图仅在顶层显示一次表名和记录数；视图栏后为纯工具栏并直接进入网格。“新建记录”只在工具栏右侧，字段类型为无交互的纯图标，字段更多菜单显示类型；记录保持单行，标题点击与独立详情入口不冲突。真实字段后显示“＋ 添加字段”，字段画布延伸至容器右侧且不生成伪单元格；表格/看板视图类型图标与自定义视图名保持正确映射。既有“未分组”的记录分组逻辑不作为本轮交付改动。
- 两个字段新增入口先显示类型选择器；选择任意类型一次只创建一个真实字段，默认中文名可重复；成功后新字段立即可见且名称全选编辑，Esc 保留默认字段，失败不产生假字段且可重试。字段 ID、已有字段、位置和数据保持正确。

**本轮验证边界：**

- 用户说“通过”前：只运行 Phase 45 直接相关的前端组件 / 状态测试、Rust 存储测试、`cargo fmt --check`、必要 `cargo check`、`pnpm build` 和 `git diff --check`，随后以隔离测试项目启动真实 macOS 应用供用户验收。
- 用户说“本轮收口”后：再统一补齐遗漏测试、运行完整前后端回归、执行 `code-reviewer` Stage 1/2、同步必要文档并等待用户决定是否提交；此前不执行 Phase 44 全量性能矩阵、不制作发布包、不提交、不推送。

## Phase 46：字段管理模态导航重构

**状态：已完成（字段管理业务能力已交付；中央模态承载层由 Phase 47 修正）**

**关联需求：** TABLE-002、TABLE-024、FIELD-001～019、VIEW-001～004

**交付内容：**

- 将字段管理从右侧占位面板替换为窗口内居中、焦点受限的模态设置层；不改底层表格、记录详情或 AI 面板的尺寸与布局，背景点击不关闭。
- 在同一模态中实现字段列表页和单字段编辑页的单列导航：列表页即时保存当前视图显隐与完整字段顺序；编辑页维持名称、类型和专属配置草稿，只有“确定”才原子写入。
- 废弃字段行下方编辑器；保留独立删除影响确认、既有类型转换影响确认、字段类型选择与新增字段流程，不改变字段/记录/视图数据模型。
- 实现列表滚动位置、编辑入口和打开触发器的焦点恢复；返回、关闭、Esc 面对未保存草稿时提供放弃确认；保存失败保留编辑页草稿并提供就近重试。

**关键文件：**

- `reqflow/src/components/fields/FieldManager.tsx` — 模态容器、列表/编辑页面导航、焦点限制、退出确认、滚动与焦点恢复。
- `reqflow/src/components/fields/FieldEditor.tsx`、`FieldEditPage.tsx` — 紧凑字段列表行与草稿编辑页的职责拆分。
- `reqflow/src/components/fields/FieldEditor.test.tsx`、`FieldManager.test.tsx` — 列表、编辑导航、草稿、关闭与焦点交互覆盖。
- `reqflow/src/components/storage/StorageWorkspace.tsx`、`reqflow/src/components/workspace/TableHeader.tsx` — 维持字段管理触发器和关闭后的焦点返回。

**完成标准：**

- 常规窗口内字段管理以约 520～600px 居中模态显示，底层各工作区不压缩；模态具备对话框语义、焦点限制、稳定标题/页脚、内部滚动与减少动态效果降级。
- 字段列表仅渲染一份连续字段行；显隐、拖拽和键盘排序保持当前视图级保存且隐藏字段不跳位；底部新增字段入口始终可访问。
- 编辑字段在同一模态切换到单字段编辑页；草稿取消不写入、确定原子保存、失败保留草稿；类型转换和删除继续进入既有影响确认，主标题限制不变。
- 返回列表后恢复原滚动位置与字段编辑焦点；关闭后焦点返回字段管理触发器；背景点击不关闭，Esc 遵循编辑页返回/列表关闭/草稿确认层级。

**本轮验证边界：**

- 用户说“通过”前：只运行字段管理组件与布局持久化的定向测试、`pnpm build`、`git diff --check`，并启动真实 Morfra 应用供用户验收。
- 用户说“本轮收口”后：再执行完整门禁、`code-reviewer`、全量回归、发布与提交决策；此前不执行。

## Phase 47：字段管理锚定浮层修正

**状态：进行中（已批准；等待真实应用验收）**

**关联需求：** TABLE-002、TABLE-024、FIELD-001～020

**交付内容：**

- 仅将已实现字段管理的中央模态承载层替换为字段管理按钮下方的非模态锚定浮层；复用已有字段列表、显隐、当前视图排序、新增、删除、编辑、保存、类型转换和持久化逻辑。
- 浮层默认宽度收至 380px，右边缘与触发按钮右边缘对齐；窗口边界不足时仍优先保持可用范围与内部滚动。
- 将标题、字段行、图标、操作、内边距、编辑页设置行和页脚统一收至工具栏级密度；编辑页基础设置改由带当前值或占位内容的输入框/下拉框直接表达，去除重复左侧标签。
- 字段管理入口创建成功后保留在列表页；不重做表头入口既有的内联命名流程。
- 移除全局遮罩与焦点限制，接入现有工具浮层的打开态、互斥、外部点击、Esc、边界翻转/避让和焦点恢复规则；打开其他工具时关闭字段管理，字段管理打开时关闭其他工具。
- 保留同一容器内列表/编辑页切换、滚动位置和编辑入口焦点恢复；返回、取消、关闭或切换工具时直接丢弃未保存草稿，不显示放弃确认；保存失败仍留在编辑页。
- 单字段编辑页移除取消/保存页脚与草稿状态；字段类型和类型专属设置改为控件变更即调用既有原子写入，失败恢复控件的已保存值并就近显示重试错误。有损类型转换继续先走既有影响确认，确认后立即写入并停留在编辑页。

**关键文件：**

- `reqflow/src/components/fields/FieldManager.tsx`、`FieldEditPage.tsx` — 非模态锚定容器、页内导航、草稿离开规则与焦点。
- `reqflow/src/components/storage/StorageWorkspace.tsx`、`reqflow/src/components/workspace/TableHeader.tsx`、`reqflow/src/components/table/tools/ViewTools.tsx` — 触发器 ARIA、工具浮层互斥与焦点协作。
- `reqflow/src/components/fields/FieldManager.test.tsx`、`reqflow/src/components/workspace/TableHeader.test.tsx` — 打开、关闭、草稿丢弃、互斥与 ARIA 定向覆盖。

**完成标准：**

- 字段管理从触发按钮下方打开，无全局遮罩或模态阻断；窗口边界内紧凑显示并仅内部滚动，底层工作区几何不变。
- 列表与编辑能力完整保留；编辑页不再提供取消或保存，类型与类型专属设置即时保存；写入失败恢复已保存值并显示错误。有损转换的确认取消不改变字段，确认成功后仍停留在编辑页。
- 鼠标、键盘、ARIA 状态、激活态、工具互斥、翻转和焦点恢复均符合 TABLE-024，并由真实 Morfra 应用人工验收。

**本轮验证边界：**

- 用户说“通过”前：只运行字段管理与触发器的定向组件测试、`pnpm build`、`git diff --check`，随后以隔离测试项目启动真实 macOS 应用供人工验收；不运行全量门禁、不派 `code-reviewer`、不提交或推送。

## Phase 48：字段配置草稿与统一设置控件

**状态：已批准，待开发**

**关联需求：** TABLE-024、FIELD-017～019

**交付内容：**

- 将单字段编辑的类型、类型专属设置及单选/多选选项操作从分散即时写入收归为本地草稿；固定“取消 / 保存”页脚，离开直接作废，最终保存经单一原子领域命令提交，失败完整保留草稿。
- 复用既有字段类型图标和浮层锚定机制，提供字段类型/数字格式的自定义选择器；提供完整 switch 设置行、紧凑选项草稿列表和业务颜色色板，不保留原生 select、裸 checkbox 或颜色字符串输入。
- 保留字段名称列表内即时重命名、字段显隐与当前视图排序即时保存、字段删除影响确认和字段管理锚定浮层合同；有损转换与被引用选项的影响处理移动到最终保存边界。
- 字段管理默认宽度收为约 280px：字段行、选择器、开关、选项行与页脚在紧凑宽度内稳定对齐；不保留无功能留白，只有确有内容无法清晰操作时才有限扩展。

**关键文件：**

- `reqflow/src/components/fields/FieldEditPage.tsx`、`FieldManager.tsx` — 草稿生命周期、保存/取消/影响确认与焦点恢复。
- `reqflow/src/components/fields/OptionEditor.tsx`、新增设置组件 — 自定义选择器、switch 设置行、选项草稿列表与颜色色板。
- `reqflow/src/stores/tableDataStore.ts`、`reqflow/src/lib/ipc/storageClient.ts`、`reqflow/src-tauri/src/storage/*` — 原子字段配置命令及失败回滚。
- 对应字段组件测试与 Rust 存储测试 — 草稿取消、原子提交、失败回滚、引用选项影响处理及键盘交互。

**完成标准：**

- 选择器、开关和选项列表均无原生控件或工程化字符串输入外观；鼠标、键盘、浅深模式与减少动态效果下状态清晰。
- 取消或任一离开路径不产生字段/选项写入；保存一次成功或完全不生效，失败保留整页草稿。
- 真实 Morfra 应用中完成字段类型、格式、开关、选项新增/重命名/色彩/排序/删除、引用选项处理及列表即时操作的人工验收。

**本轮验证边界：**

- 用户说“通过”前：只运行字段设置组件、草稿和原子领域命令的定向测试、必要 Rust 存储测试、`pnpm build`、`git diff --check`，随后启动真实 Morfra 应用供验收；不执行全套门禁、不派 `code-reviewer`、不提交或推送。

## 布局修正项：主显示区表格平铺画布

**状态：已批准，开发中**

**关联需求：** 现有主显示区与表格画布视觉基线

**交付内容：**

- 移除表格工作区外层的卡片式画布内边距、圆角、完整边框、独立底色和悬浮感；表名行、视图标签行、工具栏与当前视图画布直接组成主显示区。
- 网格占用顶部三条横栏以下的全部可用空间；记录结束后的区域保持连续空白画布，不生成伪记录、伪行号或可编辑伪单元格。
- 保持网格独立滚动、字段表头、冻结列、选择状态、浮层锚点以及左右面板现有布局与持久化逻辑不变；右侧面板开合及窗口尺寸变化只重排实际可用视口。

**关键文件：**

- `reqflow/src/components/storage/StorageWorkspace.tsx` — 主显示区语义容器。
- `reqflow/src/styles/global/03-navigation.css`、`05-table.css` — 连续画布与网格边界层级。

**完成标准：**

- 主显示区不再出现包裹表名、视图标签、工具栏和网格的大圆角卡片或无功能外边距。
- 网格左右直接衔接可用工作区边界，窗口放大及右侧面板开合后连续扩展，内容尺寸不被拉伸。
- 常规窗口、全屏、右侧面板开合、少量记录和横向滚动下，表头、冻结列、滚动条及工具浮层均保持正确。

**本轮验证边界：**

- 用户说“通过”前：只运行工作区与网格的定向测试、必要编译检查、`git diff --check`，随后启动真实 Morfra 应用供人工验收；不执行全套门禁、不派 `code-reviewer`、不提交或推送。

## 视觉修正项：数据表格独立卡片与边界裁切

**状态：已批准，开发中**

**关联需求：** 表格视图数据画布边界；既有面板调整与持久化规则

**交付内容：**

- 只将字段表头、数据行、自然空白画布及横向滚动条所在的数据区域置入完整的紧凑卡片；表名、视图标签、搜索与工具栏继续直接平铺在主工作区。
- 卡片左右各保留 8px 缓冲，使用小圆角、细边框、极弱阴影和严格内部裁切；其尺寸随主工作区变化，不改变列宽、行高、横向滚动或数据画布自然空白。
- 保持现有 8px 分隔条的命中范围、鼠标指针、键盘调整、宽度限制、吸附和保存逻辑；其热区叠在主工作区接缝上而不另占可见过渡带，卡片装饰不覆盖分隔条，双右栏的详情—AI 接缝不改。

**关键文件：**

- `reqflow/src/components/storage/StorageWorkspace.tsx` — 仅为表格视图标记数据画布卡片。
- `reqflow/src/styles/tokens/morfra.css`、`global/05-table.css` — 浅深模式卡片阴影 Token、极窄边距与内容裁切。

**完成标准：**

- 表格标题、视图标签、搜索和工具栏均在卡片外；卡片从字段表头起覆盖至数据画布与横向滚动条。
- 横向滚动至任意位置时，字段、图标、单元格、选中态和滚动内容均不越过卡片边界；加载、空表、无结果与错误状态保持完整卡片尺寸。
- 面板开合、窗口缩放和拖拽期间卡片连续适应可用宽度；左右面板尺寸、分隔条与持久化行为不变，并在真实 Morfra 应用中覆盖浅深模式和降低透明度验收。

**本轮验证边界：**

- 用户说“通过”前：只运行布局与分隔条的定向组件测试、必要 TypeScript 检查、`git diff --check`，随后使用真实 Morfra 应用人工验收；不执行全套门禁、不派 `code-reviewer`、不提交或推送。

## 表格交付项：末尾添加字段虚拟操作列

**状态：已批准，开发中**

**关联需求：** FIELD-020、TABLE-025、TABLE-031；数据网格卡片边界

**交付内容：**

- 将数据网格卡片左右缓冲由 4px 调整为 8px，不修改上下间距、侧栏尺寸或分隔条热区。
- 在最后一个可见真实字段后投影一个约 40px 的末尾虚拟操作列：表头仅有具名“添加字段”的加号按钮；每条真实记录下绘制无内容、无编辑和无 Tab 停靠的单元格与连续表格线。
- 操作列随字段区域横向滚动，绝不固定胆位、持久化、参与字段管理或任何筛选、排序、分组、条件填色；点击与键盘激活复用已有字段类型选择与创建流程，取消后焦点返回加号。

**关键文件：**

- `reqflow/src/components/table/GridHeader.tsx`、`GridBody.tsx`、`DataGrid.tsx` — 虚拟列投影、结构与交互。
- `reqflow/src/lib/table/columnLayout.ts`、`reqflow/src/styles/global/05-table.css` — 统一宽度令牌和卡片/列样式。

**完成标准：**

- 末尾加号只在已加载字段结构的表格中可用；新字段创建后操作列自动继续位于其后，空表不生成伪记录。
- 滚动、冻结、选择、编辑与卡片裁切不受影响，操作列自身不接收单元格选择或编辑。

**本轮验证边界：**

- 用户说“通过”前：只运行 GridHeader、GridBody、DataGrid 的定向测试、必要 TypeScript 检查、`git diff --check`，随后在真实 Morfra 应用中人工验收；不执行全套门禁、不派 `code-reviewer`、不提交或推送。

## 视觉修正项：表格顶部上下文与工具栏层级

**状态：已批准，开发中**

**关联需求：** 表格顶部视觉层级；Design Brief「表格信息层级」

**交付内容：**

- 移除表格标题—视图标签、视图标签—工具栏与工具栏—数据卡片之间用于切段的全宽实体横线；标题和视图标签保持同一连续基础表面。
- 工具栏本体使用现有浅深模式 `surface-canvas` 令牌作为极浅中性色嵌入式操作面，左右各留 8px、上方留 4px 的基础表面；下方复用数据卡片既有的 4px 过渡，并使用小圆角与细边界；不新增阴影、胶囊式标签或工具按钮背景。
- 工具栏与数据卡片之间保持 4px 紧凑过渡，维持既有数据卡片的左右间距、边框、圆角、滚动和字段行为。

**关键文件：**

- `reqflow/src/styles/global/03-navigation.css`、`04-workspace.css`、`05-table.css` — 顶部连续表面、Tabs 选中线与嵌入式工具栏边界。

**完成标准：**

- 表名仍通过现有字号与字重优先于视图项；当前视图的强调文字、底部选中线与键盘焦点保持可辨。
- 视图、搜索、各工具浮层和新建记录功能不变；浅色与深色主题均通过 Token 保持顶部层级，顶部总高度只增加 4px 的卡片过渡。

**本轮验证边界：**

- 用户说“通过”前：只运行 TableHeader、ViewTabBar 与工作区的定向测试、必要 TypeScript 检查、`git diff --check`，随后使用真实 Morfra 应用人工验收；不执行全套门禁、不派 `code-reviewer`、不提交或推送。

## 视觉修正项：统一输入焦点单层边界

**状态：已批准，开发中**

**关联需求：** Design Brief「输入焦点边界」

**交付内容：**

- 移除应用于文本、数字、日期、搜索、选择和多行输入的全局 2px 外描边；默认细灰边界在焦点时直接变为主题蓝，不叠加外发光或第二层圆角壳。
- 将当前默认即为蓝色的标题、视图重命名、侧栏与表重命名输入恢复为灰色默认边界；焦点再变蓝。
- 对搜索等输入嵌在外壳中的结构，以外壳 `:focus-within` 维持一层边界反馈；网格编辑器、复选框、按钮、色块和非输入式选择器保持各自现有语义与焦点反馈。

**关键文件：**

- `reqflow/src/styles/global/01-foundation.css`、`02-shell.css`、`03-navigation.css`、`04-workspace.css`、`05-table.css`、`07-panels.css` — 全局输入焦点、既有输入边界与搜索外壳。

**完成标准：**

- 键盘与鼠标聚焦任一常规输入时均只呈现一层可辨识的蓝色边界；失焦恢复灰色边界，不影响输入、选择、编辑、保存或焦点顺序。
- 深浅主题均使用现有 Token；非输入控件的焦点表达不因移除输入外描边而消失。

**本轮验证边界：**

- 用户说“通过”前：只运行标题、视图标签和字段编辑的定向组件测试、必要 TypeScript 检查、`git diff --check`，随后使用真实 Morfra 应用人工验收；不执行全套门禁、不派 `code-reviewer`、不提交或推送。

## 8. 每个 Phase 的统一验证门禁

1. **Code Review**：永远由 `code-reviewer` 子 Agent 对照关联 Spec、Design Brief 和本 Phase 交付清单执行两阶段审查。
2. **测试完整性**：新增行为、错误路径、事务回滚和撤销必须有对应自动测试；只测成功路径不算完成。
3. **编译验证**：执行受影响前端定向测试、全量 `pnpm test`、`pnpm build`；涉及 Rust 时增加 `cargo test`、`cargo check`。
4. **功能测试**：在 macOS Tauri 窗口中验证用户可观察行为；涉及布局必须覆盖 960×640、1199px、1200px、常规窗口和全屏。
5. **性能与数据安全**：涉及表格、查询、存储或附件时使用目标规模数据与故障注入；不得用小样本和“看起来很快”代替证据。
6. **Git 边界**：通过全部门禁后仍不自动 commit 或 push；只在用户明确要求后执行。

## 9. 已知风险与控制

| 风险 | 控制措施 |
|---|---|
| 自建表格交互工作量大 | 把渲染、选择编辑、批量操作、视图工具拆成 Phase 36–39；每层使用纯状态模型和可见区性能证据 |
| 动态字段查询退化 | Phase 32 先建目标规模基准；类型化单元格、必要复合索引和查询计划在进入 UI 前验证 |
| 虚拟化与冻结/编辑冲突 | 行列虚拟化、冻结布局和编辑状态分别建纯合同；编辑中的活动格强制保留在渲染范围 |
| Undo 只恢复部分数据 | 逆操作由同一 Rust 域事务生成，字段值、活动节点、视图引用和附件动作共同验证 |
| AI 并行开发发生覆盖 | AI 文件保持独立所有权；交接已完成，主产品只新增适配器并在共享入口做最小合并 |
| 全屏仍只是平移旧画布 | Phase 33 建实际可用宽高状态机，Phase 36/40 分别验收表格和看板，Phase 44 重跑完整矩阵 |
| 旧 v2 代码干扰新模型 | v3 新领域边界先建立；旧链路仅在 Phase 44 且新功能通过验收后移出，不提前大删除 |

## 10. 外部技术依据

- [TanStack Table 官方虚拟化指南](https://tanstack.com/table/latest/docs/guide/virtualization)：Table 本身不内置虚拟化，可与 TanStack Virtual 组合并分别处理行列。
- [TanStack Virtual 官方介绍](https://tanstack.com/virtual/v3/docs/introduction)：Headless、支持横向与纵向虚拟化，保留全部标记和样式控制。
- [TanStack Table React 安装说明](https://tanstack.com/table/latest/docs/installation)：React 适配器支持 React 19；v3 计划固定使用稳定 v8，不采用 v9 alpha。
- [Tauri SQL 官方文档](https://v2.tauri.app/plugin/sql/)：插件通过前端绑定访问 SQL，数据库路径默认相对 AppConfig 且写入需要 execute 权限；Morfra 因任意本地项目路径与领域事务要求改用 Rust 仓库层。
- [`rusqlite` 0.40.1 文档](https://docs.rs/rusqlite/latest/rusqlite/)：提供 SQLite 连接、事务、Savepoint、预编译语句和可选在线备份能力。
- [`rusqlite::Transaction` 文档](https://docs.rs/rusqlite/latest/rusqlite/struct.Transaction.html)：事务默认在未显式提交时回滚，符合原子修改和故障路径要求。
- [`rusqlite` 在线备份 API](https://docs.rs/rusqlite/latest/rusqlite/backup/index.html)：支持运行中数据库的一致性备份，适合每日备份与升级前备份。
- [SQLite WAL 官方说明](https://sqlite.org/wal.html)：用于本地读写并发与提交性能；仍需在恢复和复制项目前执行一致性检查与 checkpoint 策略。

## 11. 下一步

- **Phase 32～44** 已完成统一验收。
- UI Phase 直接以 Product Spec 与 Design Brief 为依据，在真实 macOS 应用中验收窄窗、常规、全屏及关键交互状态；设计稿为可选评审工具，不阻塞开发。
- AI 独立流程已完成真实进度与字段契约交接；主产品接入只消费契约，不覆盖 AI 文件。
- Phase 44 已完成统一验收；不自动提交或推送。
