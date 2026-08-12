# Development Plan — AI 表格助手

> 文档类别：当前开发计划（AI 独立工作流）
>
> 状态：独立实现与 Phase 7 验收已完成；已由主流程接管契约交接（2026-08-12）
>
> 需求来源：`initiatives/ai-assistant/Product-Spec.md`
>
> 接入边界：`initiatives/ai-assistant/INTEGRATION-CONTRACT.md`

本计划只安排 AI 表格助手的独立开发，不授权修改根目录 `Product-Spec.md`、`DEV-PLAN.md` 或启动主产品接入。实际接入必须在主流程另行同步需求和计划。

## 1. 当前基线

- 主代码目录：`reqflow/`。
- 前端：React 19.1、TypeScript 7、Zustand 5、Tailwind CSS 4、Vite 8、Vitest 4。
- 桌面：Tauri 2，目标为 macOS 13+ Apple Silicon。
- 当前右侧栏：`ChatPanel` + `chatStore`，按项目保存一条假对话消息流到 `_chat.md`。
- 当前应用设置：只有“外观”和“版本”。
- 当前主产品仍明确禁止真实 AI；本计划完成不等于自动并入主产品。
- 工作区已有用户未提交修改和未追踪文件；开发期间只改计划列出的 AI 相关文件，不清理、不覆盖其他改动。
- 本计划不授权 commit 或 push；每个 Phase 验证通过后等待用户明确指令。

### 1.1 2026-08-12 契约交接记录

- AI 独立实现由当前主流程接管交接；`INTEGRATION-CONTRACT.md` 已按 v3 `TableSummary`、`TableDataSnapshot`、`FieldSummary`、`RecordData` 重基线。
- AI Core 继续只依赖 `TableDataAdapter`，不导入主产品 Store、项目路径或详情组件。
- `openRecord` 采用异步结构化结果；宿主错误必须保留会话并提供局部重试。
- 本记录不授权 AI 写入、跨表分析、文件解析、在线协作或 Phase 44 收口。

## 2. 技术方案

### 2.1 选型结论

| 层级 | 技术 | 版本 / 基线 | 用途 |
| --- | --- | --- | --- |
| UI | React | 19.1（现有） | 右侧面板、设置与回答块 |
| 状态 | Zustand | 5.0.14（现有） | 面板、服务配置与会话状态 |
| 桌面边界 | Tauri | 2（现有） | Rust 命令、Keychain、流式通道 |
| HTTP | `tauri-plugin-http` 的 Rust `reqwest` 导出 | 2.5.9（现有） | 从 Rust 发起兼容 API 请求，避免 Key 进入 WebView |
| 密钥存储 | Rust `keyring` | 4.1.6 | macOS Keychain 的 set/get/delete |
| Markdown 渲染 | `react-markdown` | 10.1.0 | 安全渲染模型 Markdown，不执行原始 HTML |
| GFM | `remark-gfm` | 4.0.1 | 表格、列表和删除线等 GFM 语法 |
| 流式 IPC | Tauri Channel | Tauri 2（现有） | 将 Rust 端流式片段有序推送到前端 |
| 测试 | Vitest + Testing Library | 现有锁定版本 | 前端状态、组件与本地分析测试 |
| Rust 测试 | Cargo test | 现有工具链 | Keychain 包装、请求解析与错误映射 |

### 2.2 关键架构决策

1. **Rust 持有密钥和网络请求**：前端只传 `providerConfigId`，Rust 从 Keychain 取 Key 并发起请求；不扩大 WebView 到任意模型域名的 HTTP 权限。
2. **AI 核心只认识表契约**：业务模块依赖 `TableDataAdapter`，不得直接读取 `projectStore`、`requirementStore` 或磁盘项目目录。
3. **本地分析先于模型解释**：模型生成结构化分析计划，本地校验并执行；最终回答只能使用通过校验的结果。
4. **按表存会话，应用级存配置**：会话目录使用稳定 `tableId`；服务配置与面板偏好应用级保存；Key 只在 Keychain。
5. **兼容协议最小面**：第一版只实现 Bearer Key、`GET /models`、`POST /chat/completions`；供应商专有协议以后新增适配器。
6. **现有假对话不进入真实历史**：接入时只迁移面板显隐与宽度，不导入固定假回复消息；旧 `_chat.md` 在主流程批准迁移前不删除。

### 2.3 外部技术依据

- [Tauri HTTP Client](https://v2.tauri.app/plugin/http-client/) 要求 JavaScript 请求预先配置允许 URL；[Tauri Calling Rust](https://v2.tauri.app/develop/calling-rust/) 推荐用 Channel 传输流式 HTTP 响应，因此用户自定义 Base URL 与流式请求统一收口到 Rust 命令。
- [OpenAI Models API](https://developers.openai.com/api/reference/resources/models) 提供模型列表语义；[Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai) 也提供兼容 Base URL，证明“地址 + Key + 模型列表”可行，但不能据此假设所有供应商能力完全一致。
- Rust [`keyring`](https://docs.rs/crate/keyring/latest) 的 macOS 后端使用 Keychain Services，可满足密钥不落普通文件的要求。
- [`react-markdown`](https://github.com/remarkjs/react-markdown) 与 [`remark-gfm`](https://github.com/remarkjs/remark-gfm) 分别承担安全 Markdown 渲染与 GFM 表格语法；不启用原始 HTML 渲染。

## 3. 依赖图

```text
Phase 1 领域契约与持久化地基
   ├──> Phase 2 服务配置与 Keychain
   │       └──> Phase 3 兼容 API、能力探测与流式传输
   └──> Phase 4 表快照、本地分析与质量基线
                └──> Phase 5 按表多会话与双模式编排
                         └──> Phase 6 右侧面板完整产品形态
                                  └──> Phase 7 接入准备与全量验证
```

Phase 2 与 Phase 4 在代码所有权隔离时可并行，但默认按序执行，减少独立工作流中的上下文分叉。

## 4. 分阶段计划

## Phase 1：领域契约与本地持久化地基

**关联需求：** REQ-AI-002、REQ-AI-008、`INTEGRATION-CONTRACT.md`

**目标：** 先建立不依赖当前 `projectId` 的 AI 数据与存储边界，使后续模块可在假表适配器上独立开发。

**交付内容：**

- 定义服务配置、会话、消息、上下文、回答块、分析计划和面板偏好类型。
- 建立应用级配置与按 `tableId` 会话文件的原子读写层，支持新建、更新、删除和清空全部历史。
- 建立 `TableDataAdapter` 测试实现与固定表数据集，证明 AI 核心不依赖主产品 Store。
- 为旧 `_chat.md` 定义只读迁移解析器，只读取 `open/width`，不导入假消息、不删除旧文件。

**关键文件：**

- `reqflow/src/types/ai.ts` — AI 领域类型与持久化版本。
- `reqflow/src/lib/ai/tableDataAdapter.ts` — 只读表数据端口。
- `reqflow/src/lib/ai/paths.ts` — AI 应用级与按表路径。
- `reqflow/src/lib/ai/persistence.ts` — 原子读写、版本校验与损坏回退。
- `reqflow/src/lib/ai/legacyChatMigration.ts` — 旧假聊天偏好迁移解析。
- `reqflow/src/fixtures/aiEvaluationTables.ts` — 独立开发与评估固定数据。

**验证：**

- 单元测试覆盖跨表隔离、原子写入、损坏文件回退、删除会话、清空全部历史和旧文件只读迁移。
- 运行 `pnpm test` 定向测试、`pnpm build`；现有应用可启动，假面板行为不变。
- 检查新持久化样例不含 API Key。

**验收标准：**

- AI 核心测试只注入 `TableDataAdapter` 即可获得两张相互隔离的表快照。
- 表 A 的会话写入、删除和损坏恢复不会改变表 B。
- 旧 `_chat.md` 保持原文件不变，迁移器只产生面板偏好候选值。

---

## Phase 2：多服务配置与 macOS Keychain

**关联需求：** REQ-AI-001、REQ-AI-008、FLOW-AI-001

**目标：** 让用户在应用设置中管理多组服务，Key 全程不进入前端持久化。

**交付内容：**

- 在应用设置新增“AI 服务”，实现配置列表、新建、编辑、删除和全局默认配置。
- 实现 Tauri Rust Keychain 命令，按配置 ID 保存、读取状态和删除密钥；命令永不向前端返回 Key 明文。
- 实现 Base URL 与模型 ID 基础校验；第一版只接受 HTTPS。
- 实现首次数据外传说明与确认状态，未确认时不能发起真实模型请求。

**关键文件：**

- `reqflow/src/components/app-settings/AIServiceSettings.tsx` — 服务配置页面。
- `reqflow/src/components/app-settings/AIProviderEditor.tsx` — 单组配置编辑器。
- `reqflow/src/components/app-settings/AppSettingsNav.tsx` — 增加 AI 服务入口。
- `reqflow/src/components/app-settings/AppSettingsPage.tsx` — 渲染 AI 服务设置。
- `reqflow/src/stores/aiProviderStore.ts` — 非敏感配置状态与持久化。
- `reqflow/src/lib/ai/keychainClient.ts` — 前端 Tauri 命令封装。
- `reqflow/src-tauri/src/ai/keychain.rs` — Keychain set/status/delete。
- `reqflow/src-tauri/src/ai/commands.rs` — 密钥相关命令边界。
- `reqflow/src-tauri/Cargo.toml` — 引入 `keyring`。
- `reqflow/src-tauri/src/lib.rs` — 注册 AI 命令。

**验证：**

- 前端组件测试覆盖新建、编辑、取消、删除确认、默认配置和校验错误。
- Rust 单元测试使用抽象密钥仓库覆盖 set/status/delete，不在自动测试写真实用户 Keychain。
- macOS 手工回归使用测试密钥验证系统 Keychain 项创建与删除。
- 全仓搜索测试文件、配置文件与日志，确认测试 Key 不被持久化。
- 执行定向测试、`cargo test`、`cargo check`、`pnpm build`。

**验收标准：**

- 用户能保存多组非敏感配置，设置页只显示“密钥已配置 / 未配置”。
- 关闭应用重开后配置恢复，Key 可由 Rust 使用但前端无法读取明文。
- 删除配置同步删除 Keychain 项，不删除任何会话文件。

---

## Phase 3：OpenAI 兼容 API、能力探测与流式传输

**关联需求：** REQ-AI-001、REQ-AI-007、REQ-AI-009

**目标：** 建立供应商无关的最小传输层，完成模型加载、手填回退、对话探测、流式输出和停止。

**交付内容：**

- 实现 Base URL 规范化、Bearer 鉴权、模型列表、Chat Completions 和统一错误映射。
- 实现连接测试：对话必需；模型列表、流式、结构化输出 / 工具调用作为可选能力记录。
- 模型列表失败时允许手填模型 ID并单独测试。
- 使用 Tauri Channel 有序推送流式片段，支持取消；不支持流式时回退一次性返回。
- 建立本地假 HTTP 服务测试协议差异、SSE 分片、错误体、限流和断流，不依赖真实用户 Key。

**关键文件：**

- `reqflow/src-tauri/src/ai/provider.rs` — OpenAI 兼容请求与响应解析。
- `reqflow/src-tauri/src/ai/stream.rs` — SSE 解析、Channel 推送和取消控制。
- `reqflow/src-tauri/src/ai/errors.rs` — 用户可理解的错误类型。
- `reqflow/src-tauri/src/ai/commands.rs` — list/test/chat/cancel 命令。
- `reqflow/src/lib/ai/providerClient.ts` — 前端模型列表、测试和流式调用封装。
- `reqflow/src/stores/aiProviderStore.ts` — 能力状态、模型缓存和手填模型。

**验证：**

- Rust 测试覆盖 `/models` 成功 / 404、无效 Key、模型不存在、429、SSE 多字节分片、服务中断和取消。
- 前端测试覆盖加载模型、手填模型、能力降级和具体错误提示。
- 至少用两种真实 OpenAI 兼容服务完成手工连接冒烟；密钥只在本机 Keychain，证据不写入仓库。
- 执行定向测试、`cargo test`、`cargo check`、`pnpm test`、`pnpm build`。

**验收标准：**

- 兼容服务可加载模型并完成一次流式或非流式回答。
- `/models` 不可用时，手填有效模型仍可工作。
- 停止请求后不再向前端写入片段；错误能稳定映射为地址、Key、模型、限流、断网或不兼容。

---

## Phase 4：表快照、本地分析与质量基线

**关联需求：** REQ-AI-003、REQ-AI-004、REQ-AI-005、AI 能力规格

**目标：** 把精确结果从模型中剥离出来，以固定数据集证明表格事实和引用可验证。

**交付内容：**

- 将 `TableSnapshot` 标准化为字段 Schema、主标题字段、记录 ID 与类型化值。
- 实现筛选、计数、分组、求和、平均值、最值、排序和空值判断，并复用主产品可复用的字段类型语义。
- 定义有限的 `AIAnalysisPlan` JSON Schema，完成字段、操作、选项、记录范围和结果大小校验。
- 实现“计划 → 本地执行 → 最小回答上下文”流水线；非法计划有限重试，失败后返回不兼容错误。
- 建立表格问题评估集，覆盖整张表、选择记录、空值、无效字段、数据不足、引用和跨表隔离。

**关键文件：**

- `reqflow/src/lib/ai/tableSnapshot.ts` — 适配并规范化表快照。
- `reqflow/src/lib/ai/analysisPlan.ts` — 分析计划类型与校验。
- `reqflow/src/lib/ai/analysisEngine.ts` — 本地确定性执行器。
- `reqflow/src/lib/ai/contextBuilder.ts` — 最小化云端上下文。
- `reqflow/src/lib/ai/contextRouter.ts` — 双模式数据读取判断。
- `reqflow/src/lib/ai/evaluation.ts` — 固定问题与结果断言。

**验证：**

- 固定数据集至少包含：空表、混合字段表、含空值表、两个同名记录表和两张相互隔离的表。
- 固定问题至少覆盖每种运算、整表 / 已选范围、通用问题不读表、明确表格问题读表和无法判断追问。
- 本地精确结果和引用 ID 必须 100% 通过；不存在字段与非法运算必须 100% 被拦截。
- 执行定向测试、全量 `pnpm test`、`pnpm build`。

**验收标准：**

- 模型不能绕过本地计划校验直接写入精确统计结果。
- 发往模型的上下文只含完成当前问题所需的数据包，不含其他表记录。
- 固定评估集中虚构记录、字段和数值为 0。

---

## Phase 5：按表多会话与双模式编排

**关联需求：** REQ-AI-002、REQ-AI-003、REQ-AI-007、REQ-AI-008

**目标：** 用真实会话状态替换单条假消息流，同时保持 AI 核心可在独立表适配器上运行。

**交付内容：**

- 实现当前表的会话新建、加载、切换、自动标题、重命名、删除和最近使用排序。
- 实现表格分析与通用对话编排：表格分析默认整表；通用对话自动判断是否读取表格；显式选择范围优先。
- 实现单会话单活动请求、停止、重试、复制、切表隔离和应用重启恢复。
- 删除服务配置后保留历史，并允许为后续消息选择新模型。

**关键文件：**

- `reqflow/src/stores/aiConversationStore.ts` — 会话、消息与活动请求状态。
- `reqflow/src/lib/ai/chatOrchestrator.ts` — 路由、计划、本地执行与模型回答编排。
- `reqflow/src/lib/ai/titleGenerator.ts` — 自动标题与静默回退。
- `reqflow/src/lib/ai/messagePersistence.ts` — 流式完成、停止与失败的落盘边界。
- `reqflow/src/stores/chatStore.ts` — 在接入阶段改为面板兼容外观层或移除假消息职责。

**验证：**

- 状态测试覆盖表 A / B 切换、同表双模式、多会话、删除、重命名、重试不重复用户消息和停止后忽略迟到片段。
- 持久化测试覆盖流式中断、应用重启、损坏单会话不拖垮其他会话。
- 全量 `pnpm test`、`pnpm build`；Rust 流式回归继续通过。

**验收标准：**

- 两种模式都只出现在所属表历史中；切表不串消息、请求和引用。
- 新会话无旧消息上下文，但能读取所属表最新数据。
- 删除、重试、停止和重启都保持线性会话一致性。

---

## Phase 6：右侧面板完整产品形态

**关联需求：** REQ-AI-005、REQ-AI-006、REQ-AI-007、REQ-AI-009、§6 产品形态

**目标：** 将现有简陋聊天框升级为贴着表格工作的分析侧栏，并覆盖用户已确认的界面状态。

**交付内容：**

- 重构面板为顶部模式 / 历史、上下文、消息、输入四区；模型选择器放在输入区低强调位置。
- 实现空白页快捷问题、当前表 / 已选范围、会话历史视图和首次配置引导。
- 实现 Markdown、关键数字、结果表格和可点击记录引用；点击引用通过宿主接口打开主区域详情。
- 实现流式显示、停止、重试、复制、完成提示和内联错误恢复。
- 对每次 Provider 调用设置 60 秒编排终态上限；超时取消当前请求并落为局部可重试失败，失败或停止后不再额外请求自动标题。
- 宽屏沿用独立第三栏；窄屏切为覆盖式右侧抽屉；生成期间允许浏览主区域。
- 所有视觉继承现有主题变量和语义色门禁，不新增自由配色。

**关键文件：**

- `reqflow/src/components/chat/ChatPanel.tsx` — 面板容器与视图切换。
- `reqflow/src/components/chat/ChatHeader.tsx` — 模式、历史、新建与收起。
- `reqflow/src/components/chat/ChatContextBar.tsx` — 表名与分析范围。
- `reqflow/src/components/chat/ChatEmptyState.tsx` — 配置、空表和场景入口。
- `reqflow/src/components/chat/ChatHistoryView.tsx` — 当前表会话管理。
- `reqflow/src/components/chat/ChatComposer.tsx` — 输入、选择范围、模型、发送 / 停止。
- `reqflow/src/components/chat/ChatMessage.tsx` — 用户与普通 AI 消息。
- `reqflow/src/components/chat/AnalysisAnswer.tsx` — 数字、表格和记录引用。
- `reqflow/src/components/layout/MainLayout.tsx` — 宽屏第三栏与窄屏抽屉切换。
- `reqflow/src/components/topbar/ChatToggle.tsx` — 完成提示与可访问状态。
- `reqflow/package.json` — 增加 Markdown 渲染依赖。

**验证：**

- 组件测试覆盖首次配置、空表、无会话、两种模式、历史、选择范围、生成、停止、失败、重试和引用点击。
- 编排测试覆盖无终态 Provider 超时、取消传播、输入恢复、无迟到片段和失败后不生成标题。
- 布局测试覆盖宽屏第三栏、拖拽边界、详情关闭 / 全屏和窄屏覆盖抽屉。
- 可访问性定向检查消息日志、键盘操作、焦点回归与按钮名称。
- 页面回归：当前表、详情面板、AI 面板、应用设置、切表和主题切换。
- 全量 `pnpm test`、`pnpm build`、`cargo check`。

**验收标准：**

- 从空白态到带引用回答的完整路径可见、可操作、可恢复。
- 点击记录引用不会卸载 AI 面板；切表只换会话内容，不改变面板开关和宽度。
- 正常界面不出现 Token、耗时、费用、Base URL 或 Key。

---

## Phase 7：接入准备、质量评估与生产验证

> 实际验收状态见 [`Phase-7-Validation-Status.md`](./Phase-7-Validation-Status.md)。该记录不授权主产品接入，也不替代本计划的生产验证门槛。

**关联需求：** 全部 P0、完成定义、`INTEGRATION-CONTRACT.md`

**目标：** 证明独立模块达到接入标准，但不在本 Phase 擅自改写主产品需求或启动合并。

**交付内容：**

- 建立当前 v3 `TableSummary/TableDataSnapshot/FieldSummary/RecordData` 到 `TableDataAdapter` 的宿主适配验证，适配代码保持在主产品边界，不进入 AI 核心。
- 验证旧 `_chat.md` 只迁移面板偏好，假消息不进入真实历史，旧文件不被删除。
- 完成固定评估集、错误矩阵、密钥泄漏检查和跨表隔离回归。
- 输出主流程接入清单：根 Spec、根 DEV-PLAN、隐私边界、数据模型、删除级联和布局回归必须同步的条目。
- 执行前端全量测试、Rust 测试与检查、生产构建和 macOS 应用冒烟。

**关键文件：**

- `reqflow/src/adapters/ai/currentProjectTableAdapter.ts` — 当前代码的临时宿主适配。
- `reqflow/src/lib/ai/integrationChecks.ts` — 宿主契约运行时断言。
- `reqflow/src/fixtures/aiEvaluationCases.ts` — 最终评估集。
- `initiatives/ai-assistant/INTEGRATION-CONTRACT.md` — 根据实现事实收紧契约，不扩大需求。

**验证：**

- Code Review：对照独立 Spec 逐条核验 P0 和明确不做清单。
- 测试完整性：`pnpm test`、`cargo test`，固定评估集精确结果与引用 100% 通过。
- 编译验证：`pnpm build`、`cargo check`。
- 生产验证：Tauri 生产构建；macOS 手工验证 Keychain、真实兼容服务、流式停止、重启恢复、切表隔离和引用跳转。
- 安全检查：仓库、构建日志、应用配置与会话文件中无真实 Key、Authorization 头和完整请求正文。

**验收标准：**

- 独立 Spec 完成定义全部通过，无 OUT-AI 项被偷带实现。
- AI 核心没有直接依赖 `projectStore`、`requirementStore`、磁盘项目路径或详情组件。
- 主流程接入所需文档变更被清楚列出，未经批准没有修改根 Spec 和根 DEV-PLAN。

## 5. 数据与文件布局

建议的持久化布局如下，最终必须由 Phase 1 测试锁定版本字段与原子写入策略：

```text
$APPLOCALDATA/
└── ai/
    ├── providers.json              # 非敏感服务配置
    ├── preferences.json            # 面板偏好、首次外传确认
    └── tables/
        └── <tableId>/
            ├── conversations.json  # 会话索引
            └── conversations/
                └── <conversationId>.md

macOS Keychain
└── service: reqflow.ai.provider
    └── account: <providerConfigId>  # API Key
```

规则：

- 所有 JSON / Markdown 都带 `version`，损坏时隔离单文件并提示，不覆盖为默认空文件。
- 写入先写临时文件，再原子替换目标。
- 会话 Markdown 可读，但不得包含 Key、Authorization 头或未用于回答的完整表快照。
- `tableId` 只能来自宿主契约；用户可见名称不得作为目录主键。
- 表删除由宿主调用 `deleteTableAIData(tableId)`，AI 模块不得自行扫描猜测已删除表。

## 6. 验证门禁

每个 Phase 必须完成：

1. 对照本 Phase 验收标准做 Code Review。
2. 补齐新增行为与故障路径测试。
3. 通过 TypeScript 构建；涉及 Rust 时同时通过 `cargo test` 与 `cargo check`。
4. 完成功能或页面回归；涉及公共状态、存储、布局、路由、Tauri 命令或构建配置时执行全量测试与生产构建。

AI 专项门禁：

- 固定评估集中的本地精确计算与引用必须全部通过，不能用“多数正确”放行。
- 任何 Key、Authorization 头或完整请求正文进入前端持久化、普通日志、快照或 Git 差异，立即阻断。
- 任意跨表消息、上下文、活动请求或引用泄漏，立即阻断。
- 模型能力不足时必须失败可见，不能用猜测回答掩盖协议不兼容。

## 7. 已知风险

| 风险 | 影响 | 前置处理 |
| --- | --- | --- |
| 主产品表格数据模型仍在演进 | 直接写死当前 `projectId` 会导致重构 | Phase 1 先定义宿主契约，Phase 7 才写临时适配 |
| 各家“OpenAI 兼容”程度不一致 | 模型列表、流式和结构化输出可能缺失 | Phase 3 做能力探测与降级，不承诺自动识别全部能力 |
| 模型可能产生非法分析计划 | 错误统计或虚构字段 | Phase 4 本地 Schema 校验、有限重试和硬失败 |
| 用户自定义 Base URL 扩大网络边界 | Key 或数据发往错误服务 | 只允许 HTTPS、首次外传确认、Rust 持有 Key、设置页测试后保存 |
| 现有 `_chat.md` 含假历史 | 错误导入会污染真实会话 | 只迁移显隐 / 宽度，假消息不导入，旧文件不自动删除 |
| 窄屏第三栏会挤压详情 | 当前布局没有覆盖抽屉 | Phase 6 增加明确布局断点并做详情三态回归 |

## 8. 主流程接入准入条件

独立开发完成后，只有以下条件同时满足才可进入合并：

1. 用户明确批准接入主产品。
2. 根 `Product-Spec.md` 已将真实 AI 从非目标转为批准范围，并同步 REQ-024、联网、隐私与数据模型。
3. 根 `DEV-PLAN.md` 已新增接入 Phase，包含迁移、回滚、验证和关键文件。
4. 主产品提供稳定 `tableId`、主标题字段、只读快照、选中记录和打开详情端口。
5. 删除表时能调用 AI 级联清理；切表事件有确定顺序。
6. 现有主题、三栏布局、详情状态和应用设置回归方案已批准。

未满足时，AI 模块可以独立测试，但不得通过临时耦合绕过契约进入主流程。
