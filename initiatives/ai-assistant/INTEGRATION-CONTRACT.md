# AI 表格助手接入契约

> 文档类别：当前事实（AI 独立工作流接入边界）
>
> 状态：契约基线，主产品接入前必须复核
>
> 更新日期：2026-08-08

## 1. 目的

AI 表格助手与主产品可以并行开发，但不能各自猜测对方的数据结构。本契约定义双方最小交界面：主产品提供稳定、只读的表上下文与导航能力；AI 模块负责模型、分析、会话与回答。

本契约不授权修改根目录 `Product-Spec.md`、`DEV-PLAN.md` 或现有代码。接入动作必须由主流程另行批准。

## 2. 所有权边界

| 范围 | 主产品负责 | AI 模块负责 |
| --- | --- | --- |
| 表身份 | 稳定 `tableId`、表名、删除事件 | 以 `tableId` 隔离会话，不猜项目路径 |
| 表结构 | 字段 ID、名称、类型、选项、唯一主标题字段 | 读取并规范化，不修改 Schema |
| 表记录 | 最新记录值、稳定 `recordId`、当前选择 | 只读分析，不写回记录 |
| 导航 | 打开记录详情、切表、面板宿主位置 | 发出引用跳转意图，不操作路由细节 |
| 布局与主题 | 顶栏入口、第三栏 / 抽屉容器、主题变量 | 面板内部结构、回答组件和 AI 状态 |
| 模型服务 | 不负责 | 多配置、Keychain、协议探测、请求与取消 |
| 精确计算 | 提供类型语义或可复用纯函数 | 建立分析计划、本地校验与执行 |
| 会话 | 不负责消息业务 | 按表多会话、模式、消息、标题、删除和持久化 |
| 删除级联 | 表删除前 / 后发出稳定事件 | 删除该 `tableId` 下全部会话 |
| 错误与诊断 | 宿主级数据 / 路由错误 | 模型、网络、计划和消息错误；不记录敏感正文 |

## 3. 依赖方向

```text
主产品 Stores / 文件系统
          │
          ▼
  TableDataAdapter（只读）
          │
          ▼
       AI Core
          │
          ▼
 AI Panel Components
          │
          ▼
 HostActions（打开详情 / 完成提示）
```

禁止反向依赖：

- AI Core MUST NOT import `projectStore`、`requirementStore`、`schemaStore`、详情组件或主产品路径函数。
- 主产品 MUST NOT 读取 AI 内部会话文件来判断业务状态。
- AI Provider / Keychain / Analysis 模块 MUST NOT import React 组件。
- 面板组件 MUST NOT 直接访问 Keychain 或拼接供应商 URL。

## 4. 主产品提供的只读端口

以下为语义契约，具体文件名可调整，但字段含义不得在接入时静默改变。

```ts
export interface TableDataAdapter {
  getActiveTable(): ActiveTableDescriptor | null;
  getTableSnapshot(tableId: string): Promise<TableSnapshot>;
  getSelectedRecordIds(tableId: string): string[];
  subscribe(listener: (event: TableEvent) => void): () => void;
}

export interface ActiveTableDescriptor {
  tableId: string;
  name: string;
}

export interface TableSnapshot {
  tableId: string;
  name: string;
  schemaVersion: string;
  primaryTitleFieldId: string;
  fields: TableField[];
  records: TableRecord[];
  capturedAt: string;
}

export type TableFieldType =
  | "text"
  | "number"
  | "percent"
  | "singleSelect"
  | "multiSelect"
  | "date"
  | "checkbox"
  | "attachment"
  | "computed";

export interface TableField {
  id: string;
  name: string;
  type: TableFieldType;
  options?: Array<{ id: string; label: string }>;
}

export interface TableRecord {
  id: string;
  values: Record<string, unknown>;
}

export type TableEvent =
  | { type: "active-table-changed"; tableId: string | null }
  | { type: "table-data-changed"; tableId: string }
  | { type: "selection-changed"; tableId: string; recordIds: string[] }
  | { type: "table-deleted"; tableId: string };
```

### 4.1 快照规则

- `tableId` 和 `recordId` 必须稳定，不能使用名称、数组下标或页面位置代替。
- `primaryTitleFieldId` 必须指向唯一存在的主标题字段；每条记录的引用标题由该字段生成。
- `fields` 与 `records` 必须来自同一捕获时点，不能把旧 Schema 与新记录混合。
- `getTableSnapshot` 返回整张逻辑表，不受当前筛选、搜索、排序、分组、网格 / 看板视图影响。
- `getSelectedRecordIds` 只返回当前表的有效选择；AI 仍需在发送前与最新快照交叉校验。
- 第一版只读取表格字段值；附件只传元数据，不读取文件内容；详情 Tab 正文和 Tab 记录不在本契约 P0 数据面内。
- 主产品不得为了 AI 修改或补写记录；适配过程必须纯只读。

## 5. AI 模块提供给主产品的端口

```ts
export interface AIHostActions {
  openRecord(input: { tableId: string; recordId: string }): void;
  notifyGenerationCompleted(input: {
    tableId: string;
    conversationId: string;
  }): void;
}

export interface AIDataLifecycle {
  deleteTableAIData(tableId: string): Promise<void>;
  clearAllAIConversationData(): Promise<void>;
}

export interface AIPanelHostState {
  open: boolean;
  width: number;
  presentation: "column" | "overlay";
}
```

### 5.1 导航规则

- 点击记录引用只调用 `openRecord`；AI 不判断详情页路由、Tab 或面板模式。
- `openRecord` 失败时主产品返回可呈现错误，AI 会话不得丢失或被卸载。
- AI 完成提示是非打断式状态；不得自动打开面板、切表或切记录。

### 5.2 删除规则

- 表删除流程必须调用 `deleteTableAIData(tableId)`；调用失败时不得静默留下无法归属的历史。
- 第一版 AI 会话删除不可恢复；主产品若以后引入废纸篓，不能自动推断 AI 历史也进入废纸篓，需重新定需求。
- `clearAllAIConversationData` 只删会话与消息，不删服务配置、Keychain、面板偏好或表数据。

## 6. 模式与上下文契约

### 6.1 表格分析

- 默认请求 `getTableSnapshot(activeTableId)`。
- 页面筛选、搜索、分组和视图不改变分析范围。
- 用户主动添加已选记录后，当前消息的 `AIContextRef` 写入有效 `recordIds`；下一条恢复整表。
- 所有精确统计必须由本地分析引擎执行。

### 6.2 通用对话

- 会话仍属于当前 `tableId`。
- 上下文路由结果只能是 `none`、`fullTable` 或用户明确的 `selectedRecords`。
- 纯通用问题使用 `none`，不得读取快照值。
- 明确涉及当前表的问题使用 `fullTable`，并自动进入本地计算与引用规则。
- 路由无法确定时先追问，不预加载整表作为兜底。

### 6.3 发送数据最小化

AI 模块读取快照不等于把快照全部发给模型。发送前必须：

1. 校验消息所属 `tableId` 与活动表或明确历史表一致。
2. 执行上下文路由。
3. 生成并校验分析计划。
4. 本地执行可确定的筛选和计算。
5. 只组装回答所需字段、相关记录与计算结果。

禁止后台预上传、全表常驻云端索引和切表时自动发送。

## 7. 模型服务边界

### 7.1 前端可见

- 服务配置 ID、用户命名、Base URL、模型 ID、默认状态、能力状态、Key 是否已配置。
- 设置页错误类型与可恢复操作。

### 7.2 仅 Rust 可见

- API Key 明文。
- Authorization 头。
- 完整网络请求与流式连接。

### 7.3 命令语义

```ts
listAIModels(providerConfigId): Promise<ModelListResult>
testAIProvider(providerConfigId, modelId): Promise<CapabilityProbe>
startAIChat(request, channel): Promise<RequestHandle>
cancelAIChat(requestId): Promise<void>
setAIProviderSecret(providerConfigId, secret): Promise<void>
hasAIProviderSecret(providerConfigId): Promise<boolean>
deleteAIProviderSecret(providerConfigId): Promise<void>
```

规则：

- Base URL 只允许 HTTPS；路径规范化后追加 `models` 或 `chat/completions`，不得重复追加 `/v1`。
- 认证只支持 `Authorization: Bearer <key>`。
- Rust 返回结构化错误，不把供应商原始错误体、Key 或请求正文直接透传 UI。
- 流式片段通过单请求 Channel 有序发送；取消后迟到片段必须丢弃。
- 模型列表失败不等于聊天不可用；允许手动模型 ID 后单独测试。

## 8. 持久化契约

```text
$APPLOCALDATA/ai/providers.json
$APPLOCALDATA/ai/preferences.json
$APPLOCALDATA/ai/tables/<tableId>/conversations.json
$APPLOCALDATA/ai/tables/<tableId>/conversations/<conversationId>.md
macOS Keychain: reqflow.ai.provider / <providerConfigId>
```

- 所有普通文件都必须有版本字段并使用原子替换。
- 单个会话损坏只隔离该会话，不清空当前表其他会话。
- API Key、Authorization 头、完整请求正文和未使用的整表快照不得落盘。
- 会话必须保存：`tableId`、模式、标题、服务配置引用、模型 ID、消息、上下文引用和消息状态。
- 面板显隐与宽度是应用级偏好；切表不改变。

## 9. 当前代码的临时映射

主产品当前没有独立 `Table` 实体；在正式表格模型接入前，可使用以下临时适配验证，但不得进入 AI 核心：

| 契约概念 | 当前代码映射 | 限制 |
| --- | --- | --- |
| `tableId` | `Project.id` | 未来表模型出现后替换适配器 |
| 表名 | `Project.name` | 仅展示，不作为 ID |
| 字段 | `Schema.attributes` + 主标题 Name + Stage | 需统一 Stage 和主标题的字段表示 |
| 记录 | `Requirement` | 只映射表格字段值，不传详情 Tab 正文 |
| 当前选择 | `uiStore.selectedRequirementId` | 当前只支持单条；多选由主产品未来能力提供 |
| 打开详情 | `uiStore.selectRequirement(recordId)` | 由宿主适配器调用 |

临时适配的目的只是验证契约可行，不得据此把“项目等于表”写入 AI Product Spec。

## 10. 旧假对话迁移

当前 `_chat.md` 包含 `open`、`width` 和固定假消息。接入规则：

1. 第一次接入时读取当前活动数据空间的 `open/width`，作为应用级偏好候选。
2. 不导入任何旧 `messages`，因为其回答是固定假数据，不具有用户知识价值。
3. 不在自动迁移中删除或覆盖 `_chat.md`。
4. 新 AI 会话写入独立 `ai/tables/<tableId>/` 路径。
5. 旧文件何时归档或删除必须由主流程另行批准。

## 11. 接入顺序

1. 主产品先批准根 Spec 与根 DEV-PLAN 变更。
2. 主产品实现或确认稳定表端口与删除事件。
3. AI 模块在假适配器上通过完整评估。
4. 新增当前主产品临时适配器，不修改 AI Core。
5. 用功能开关替换假回复，保留回退到旧面板的能力。
6. 完成切表、详情、布局、主题、设置、存储、Keychain 和生产构建回归。
7. 验证通过后再移除假回复代码；旧数据文件仍按批准的迁移策略处理。

## 12. 合并阻断条件

出现以下任一情况，不得接入主流程：

- 没有稳定 `tableId` 或主标题字段。
- AI Core 直接 import 当前项目 / 需求 Store。
- API Key 能从前端状态、普通文件、日志或测试快照读取。
- 精确统计未经本地引擎校验。
- 通用对话能跨表读取上下文或历史。
- 表删除不会级联清理 AI 会话。
- 根 Spec 仍声明除检查更新外完全不联网，或仍禁止真实 AI。
- 根 DEV-PLAN 没有接入、迁移、回滚和全量验证阶段。

## 13. 主流程同步清单

接入前，主流程至少需要审查并同步：

- `Product-Spec.md`：REQ-024 从假对话升级为真实 AI；移除冲突的非目标；更新联网、隐私、ChatState 和完成定义。
- `Product-Spec-CHANGELOG.md`：记录真实 AI 的范围、数据外传和迁移决策。
- `DEV-PLAN.md`：新增主流程接入 Phase，不把本独立计划直接当作根计划。
- `Design-Brief.md`：只在现有对话主题无法承载新状态时更新；否则继承，不自由改视觉。
- 当前表模型：稳定 ID、主标题、选择记录、读取快照、打开详情和删除级联。
- Tauri / 构建配置：Keychain 依赖、Rust 命令、生产构建与隐私说明。
