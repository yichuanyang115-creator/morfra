# Morfra v3 看板全量只读自检

> 文档类别：**审查证据，不是产品事实或开发计划**。
>
> 审查日期：2026-08-20（Asia/Shanghai）
>
> 审查范围：看板视图、看板工具调用、卡片/列投影、拖拽与编辑、视图配置、Rust/SQLite 写入与 Undo 链
>
> 屏幕读取：关闭；未使用 Browser、Computer Use、截图、`view_image`、GUI 或其他视觉工具
>
> 处置边界：只审查，不修复、不写开发计划、不提交、不推送

## 1. 结论

**Stage 1：FAIL；Stage 2：SKIPPED。**

本轮逐条覆盖 `BOARD-001～017`，没有在发现 HIGH 后提前结束 Stage 1。共登记 **18 个新的 BOARD 问题：HIGH 8 / MEDIUM 8 / LOW 2**；另引用 14 个已存在的 FT/SHELL 问题，不重复登记。

| 结论 | 数量 | 说明 |
|---|---:|---|
| PASS | 4 | 选项空列/动态列主投影、排序期间禁用手排、固定列宽/折叠、计数 |
| FAIL | 12 | 分组边界、附件跨列、只读交互、卡片字段、编辑、手排、列顺序、筛选、搜索、Undo、快速新增、更换分组 |
| BLOCKED | 1 | `BOARD-003` 的“多值字段”是否包含 image/file 尚无产品定义；真实视觉和生产性能另在 §10 保持 BLOCKED |

存在 HIGH，按 `code-review` 门禁不执行 Stage 2；本报告没有把代码质量、安全扫描或视觉气质写成已通过。

最严重的不是“好不好看”，而是四类功能性失效：

1. 同列手排会改写多选值或更新时间；筛选/搜索后拖拽会静默删除隐藏卡片和动态列的既有手排配置。
2. 卡片直接编辑把格式化文本反向写回真实字段，复选框、进度、多选与附件路径会错误提交或失败。
3. 变高卡片仍按固定 116px 虚拟步长排列，字段一多即重叠，滚动、点击和 drop 位置同时失真。
4. 看板移动与普通视图配置保存存在两个并发写入者；Rust 命令又没有把传入字段绑定到当前 `groupFieldId`，可能覆盖配置或写错字段。

## 2. 基线、权限与方法

### 2.1 Git 基线

- 分支：`main`
- HEAD：`afd755d2cdd3c1e071c14afde65e5cdda9c01055`
- 审查开始时工作区已 dirty；均视为用户已有工作，本轮未回滚、清理或覆盖。
- 开始时状态：

```text
 M DEV-PLAN.md
 M Design-Brief.md
 M PROJECT-CONTEXT.md
 M Product-Spec-CHANGELOG.md
 M Product-Spec.md
 M reqflow/src-tauri/src/storage/migrations.rs
 M reqflow/src/components/fields/FieldEditPage.test.tsx
 M reqflow/src/components/fields/FieldEditPage.tsx
 M reqflow/src/components/fields/FieldEditor.tsx
 M reqflow/src/components/fields/FieldManager.test.tsx
 M reqflow/src/components/fields/FieldManager.tsx
 M reqflow/src/components/fields/FieldTypePicker.test.tsx
 M reqflow/src/components/fields/FieldTypePicker.tsx
 M reqflow/src/components/storage/StorageWorkspace.tsx
 M reqflow/src/components/table/DataGrid.interaction.test.tsx
 M reqflow/src/components/table/editors/CellEditorHost.tsx
 M reqflow/src/styles/global/05-table.css
?? docs/audits/2026-08-20-field-table-self-check.md
?? docs/audits/2026-08-20-shell-self-check.md
?? docs/audits/AUDIT-REGISTER.md
?? reqflow/src-tauri/migrations/010_repair_field_foreign_keys.sql
```

开始时已逐文件保存 SHA-256。本轮唯一获准的持久化变化是本报告与 `AUDIT-REGISTER.md`；结束机械校验见 §13。

### 2.2 权威来源

1. 产品行为：`Product-Spec.md`，重点 `BOARD-001～017`、`VIEW-001～006`、`DATA-004/005/007`、`EXP-001～017`。
2. 视觉与交互：`Design-Brief.md` 的 `V3-DB-001～011`；当前没有可用设计稿，未自由推导像素外观。
3. 范围声明：`DEV-PLAN.md` Phase 40 及相关性能/验收 Phase；只核对声明，不覆盖 Spec。
4. 当前问题状态：`docs/audits/AUDIT-REGISTER.md`。
5. 未读取 `docs/archive/` 或 `docs/future/` 猜测当前需求。

### 2.3 取证方式

- 主 Agent 读取权威原文、生产前端、Rust/SQLite、CSS、测试与现有总账。
- 两个独立只读审查分别覆盖前端交互与存储/事务。
- 强制 `code-reviewer` 完成 `BOARD-001～017` Stage 1；对其中“附件值始终为 null”的错误判断又回到生产 `attachments.rs` 纠正，没有照抄错误结论。
- 运行看板定向测试、相关组合测试、全量前端测试、TypeScript、生产构建、Rust 定向/存储测试、Cargo check 与正式性能脚本。
- 屏幕读取始终关闭；真实视觉、拖拽观感、屏幕阅读器和系统动效不得用静态证据冒充通过。

## 3. `BOARD-001～017` 逐条追踪

| ID | 判定 | 证据摘要 |
|---|---|---|
| BOARD-001 | FAIL | 非标题字段都可选、空值进入未分组；但合法文本 `__empty__` 与空值冲突，图片/文件数组又被合成组合键，见 BOARD-M-08。 |
| BOARD-002 | PASS | select/multi 在 `boardProjection.ts:51-53` 预建全部选项列；其他字段仅从当前记录动态生成。 |
| BOARD-003 | BLOCKED | multi_select 在 `boardProjection.ts:54-57` 按每个 option ID 投影且同一记录可进入多列；但 image/file 也是数组值，Spec 未说明其是否属于“多值字段”，精确合同待 DC-08。 |
| BOARD-004 | FAIL | 多选 A→C 的值变换正确，只读系统字段后端也拒写；但只读卡片仍可拖、可移出、列仍显示新增，且没有禁止反馈，见 BOARD-M-04。 |
| BOARD-005 | FAIL | 普通标量/多选 happy path 会在单一 transaction 写值与 Board config；但 image/file 跨列把附件组合 key 当普通字符串写 `cell_values`，不更新 metadata/文件，交叉引用 FT-H-04；并发与命令身份另见 BOARD-H-07/H-08。 |
| BOARD-006 | FAIL | 主标题始终显示且字段集合按视图保存；但字段排序按钮不改变渲染顺序，单选/多选显示还受既有 FT-M-01 影响，见 BOARD-M-01。 |
| BOARD-007 | FAIL | 标题和空白区打开详情；普通字段 prompt 使用格式化文本回写，确定破坏多类值，见 BOARD-H-01。 |
| BOARD-008 | FAIL | `cardPositions` 按列保存；同列手排却写记录，筛选/搜索时又丢隐藏位置，见 BOARD-H-02/H-03。 |
| BOARD-009 | PASS | 有字段排序时不读取/改写手排；同列 drop 被挡住、跨列仍可改组，清除排序后旧 `cardPositions` 重新参与投影。 |
| BOARD-010 | FAIL | 固定配置和未分组末尾存在；动态列默认顺序受记录 sort 影响，筛选拖列会覆盖隐藏列，见 BOARD-M-02/BOARD-H-03。 |
| BOARD-011 | FAIL | 筛选先于投影且能使用卡片未显示字段；`filterMode` 类型、解析和执行均只支持 `all`，`any` 完全缺失，见 BOARD-H-05。 |
| BOARD-012 | FAIL | 搜索是临时状态并先于投影，普通字段覆盖正确；附件真实文件名仍无法可靠搜索，交叉引用 FT-M-06。 |
| BOARD-013 | FAIL | 移出只改字段、删除有确认且会删底层记录；Board Undo 恢复会丢附件，交叉引用 FT-H-05；本地撤销标签还不代表权威 action 深度。 |
| BOARD-014 | FAIL | 普通列与未分组快速新增值正确；只读系统字段列仍显示并调用必失败的新增操作，且无错误恢复，见 BOARD-M-03/M-04。 |
| BOARD-015 | FAIL | 更换字段不改记录并清除列/卡片/折叠配置；旧配置只保存在组件 state，切走即丢、未进入权威 Undo，见 BOARD-H-06。 |
| BOARD-016 | PASS | 列宽固定 272px、折叠宽 44px；单列/全部折叠按 Board view config 保存，无自由 resize 路径。 |
| BOARD-017 | PASS | 列计数按投影卡片数；顶部用 record ID 去重；没有列内聚合。 |

统计：**PASS 4 / FAIL 12 / BLOCKED 1，遗漏 0。**

## 4. 设计与体验追踪

| 规则 | 判定 | 看板证据 |
|---|---|---|
| EXP-001/005/008、V3-DB-002 | BLOCKED | `flex:1`、横纵 overflow 和列虚拟化存在；真实 960/1199/1200/全屏连续性因屏幕读取关闭未验证。 |
| EXP-009/010/017、V3-DB-003/004/011 | 静态 PASS / 视觉 BLOCKED | 看板 CSS 使用语义 Token；真实浅/深色、材质与对比度未看屏，且全局主题问题仍由 SHELL-H-12 跟踪。 |
| EXP-011/012/013、V3-DB-001/005～007 | FAIL / BLOCKED | 固定槽与可增长卡片确定冲突；整体密度、字级和气质需真实渲染。 |
| EXP-014/015、V3-DB-008/009 | FAIL | 只有原生 draggable 与 `:active` 透明度，没有键盘拖拽、代理、插入线、禁止态或 live announcement。 |
| EXP-016、V3-DB-010 | FAIL | 看板复用表格骨架/刷新文案，数据动作失败无就近错误或重试。 |

## 5. 原子验收矩阵

| 场景 | 投影/显示 | 写入/事务 | 持久化/Undo | 结论 |
|---|---|---|---|---|
| text/link/date/number/progress/checkbox 分组 | 动态列与未分组存在 | 普通跨列改值 | Board JSON 写 view config | PASS 主路径；哨兵与格式见 M-08 |
| select 分组 | 已定义空列保留、label 正确 | 跨列写 option ID | 单事务写值+配置 | PASS |
| multi_select 分组 | 一记录多列 | A→C 保留其他值 | 跨列 happy path原子 | PASS；同列 FAIL · H-02 |
| image/file 分组 | 数组被拼成组合 key，列名为相对路径 | drag/edit 会绕过附件领域语义 | 与 metadata 生命周期不一致风险 | FAIL · H-01/M-08；精确目标见 DC-08 |
| auto_number/created_time/updated_time 分组 | 可投影 | Rust 拒绝写 | UI 仍暴露拖拽/新增/移出 | FAIL · M-04 |
| 卡片字段选择/排序 | 选择有效 | 排序按钮改配置 | 渲染仍按 schema 顺序 | FAIL · M-01 |
| 卡片直接编辑 | 显示格式化文本 | prompt 反解析错误 | 失败无就近恢复 | FAIL · H-01/M-03 |
| 同列手排 | 可 drop | 错误写字段/updated_at | 产生无意义 Undo | FAIL · H-02 |
| 跨列拖动 | 普通标量/multi 可改组；附件组合 key 也被当值 | 普通值+Board config 同 transaction；附件不走 metadata/file 事务 | post-commit/附件 Undo 另有既有问题 | FAIL · FT-H-04/H-05、H-08、SHELL-H-07 |
| 筛选/搜索后拖卡 | 只传可见记录 | 以可见 target IDs 覆盖完整数组 | 隐藏手排永久丢失 | FAIL · H-03 |
| 筛选/搜索后拖列 | 动态隐藏列不在 columns | 以可见 keys 覆盖完整顺序 | 隐藏列序永久丢失 | FAIL · H-03 |
| 字段排序开启 | 同列手排禁用 | 跨列仍写值 | 旧手排保留 | PASS |
| 列折叠/展开 | 单列/全部有效 | 走 view config 保存 | 按视图保存 | PASS 主路径；并发见 H-07 |
| 更换分组 | 重建列且不改记录 | 普通配置保存 | 只存在组件内撤销 | FAIL · H-06 |
| 字段/选项删除、替换、Undo | 旧 key 可静默残留或换组 | 清理器不识别 Board schema | 精确恢复无直测 | FAIL · M-07、FT-L-02 |
| 数据动作保存失败 | UI 保持大体可用 | rejection 被 `void` 丢弃 | 无 pending/error/retry | FAIL · M-03 |
| 配置保存失败/切视图 | 乐观布局存在 | coordinator 有部分回滚 | 迟到失败可静默丢 pending | FAIL · SHELL-H-09 |
| 同时拖卡与改折叠/字段 | 两个 UI 写入者 | Board move 与 config update 竞态 | 后完成者覆盖另一份 Board JSON | FAIL · H-07 |
| 删除/移出/移动后 Undo | 普通值可恢复 | RestoreRecord 先删父记录 | 附件 metadata 可级联丢失 | FAIL · FT-H-05 |
| 复制视图 | 配置 JSON 被复制 | 不复制记录 | 当前 view config 独立 | PASS 主路径；重复复制见 SHELL-M-09 |
| 关闭/重开 | SQLite 路径存在 | 通用项目重开通过 | 无 Board 精确磁盘 round-trip 直测 | BLOCKED（直接证据缺失） |
| 切项目/复制项目包 | 共享缓存/请求缺实例作用域 | 迟到响应可能落错项目 | 配置与数据归属不可靠 | FAIL · SHELL-H-01/H-02/H-10 |
| 10k×200、≤300ms | 可见 DOM 数受控 | 正式 release benchmark 崩溃 | 无生产 P95 | BLOCKED · FT-M-10/L-01 |
| 键盘/焦点/ARIA | 基础按钮可聚焦 | 拖拽无键盘状态机 | 无播报/焦点回归测试 | FAIL · M-05 |

## 6. 新问题总览

| ID | 优先级 | 摘要 | 确认度 |
|---|---|---|---|
| BOARD-H-01 | HIGH | 卡片直接编辑把格式化显示文本错误写回类型值 | 已确认，100% |
| BOARD-H-02 | HIGH | 同列手排修改多选顺序或推进记录更新时间 | 已确认，100% |
| BOARD-H-03 | HIGH | 筛选/搜索下拖卡或拖列删除隐藏手排配置 | 已确认，100%，JSDOM 复现 |
| BOARD-H-04 | HIGH | 116px 虚拟槽与可增长卡片高度冲突 | DOM/CSS 几何确认，100% |
| BOARD-H-05 | HIGH | “满足任一”完全未实现 | 已确认，100% |
| BOARD-H-06 | HIGH | 更换分组字段只提供易失的组件内撤销 | 已确认，100% |
| BOARD-H-07 | HIGH | Board move 与普通配置保存是两个并发写入者 | 控制流确认，98% |
| BOARD-H-08 | HIGH | Rust Board move 未绑定真实分组字段及配置身份 | 已确认，98% |
| BOARD-M-01 | MEDIUM | 卡片字段排序按钮不改变实际渲染顺序 | 已确认，100%，JSDOM 复现 |
| BOARD-M-02 | MEDIUM | 动态列默认顺序受卡片 sort 与陈旧 key 干扰 | 已确认，95% |
| BOARD-M-03 | MEDIUM | 看板数据动作失败无就近错误、pending 或重试 | 已确认，100% |
| BOARD-M-04 | MEDIUM | 只读分组仍暴露可拖拽、移出和快速新增 | 已确认，100% |
| BOARD-M-05 | MEDIUM | 拖拽缺键盘等价、ARIA 与持续视觉反馈 | 已确认，100%；真实观感 BLOCKED |
| BOARD-M-06 | MEDIUM | 看板加载复用表格骨架和“表格数据”文案 | 已确认，100% |
| BOARD-M-07 | MEDIUM | 字段/选项生命周期清理不理解 Board schema | 已确认，98% |
| BOARD-M-08 | MEDIUM | 空值哨兵与附件数组投影键不安全 | 哨兵 100%；附件目标语义待 DC-08 |
| BOARD-L-01 | LOW | 9 个看板绿测未覆盖本轮高风险组合，正式 P95 门禁失效 | 已确认，100% |
| BOARD-L-02 | LOW | 不可达的旧 `Board.tsx` 生产实现仍留在仓库 | 已确认，95% |

## 7. HIGH 问题详证

### BOARD-H-01 · 卡片直接编辑把格式化显示文本错误写回类型值

- **复现**：显示多选 `[a,b]`、checkbox `true`、progress `50`；打开卡片 prompt，不改文本直接确认。
- **预期**：字段专属控件提交原始类型；未修改时值不变。
- **实际**：分别尝试提交 `['2 项']`、`false`、`NaN`；图片/文件也会把“2 个附件”当普通 cell value 回写。
- **影响**：`BOARD-007`、`DATA-007`；可能错误修改、校验失败或制造附件双源不一致。
- **证据**：`KanbanView.tsx:135,159-165`；`fieldFormatting.ts:7-21`。
- **初步修复预测**：复用表格的字段专属 editor/normalizer；附件只走 attachment API。
- **风险与回归**：13 类字段、空值、取消、输入法、校验失败、option ID/label、附件事务、Undo、切视图 pending。

### BOARD-H-02 · 同列手排修改多选顺序或推进记录更新时间

- **复现**：记录值 `[a,b,c]` 在 A 列内调整位置；或普通单值卡片在原列内排序。
- **预期**：只更新该列 `cardPositions`，不写记录字段、活动或 `updated_at`。
- **实际**：多选经 `moveCardValue(A→A)` 变为 `[b,c,a]`；单值虽相等，Rust 仍 `write_value` 并更新 `updated_at`、项目时间和 Undo。
- **影响**：纯布局操作污染数据与最后编辑时间，并同步到表格、详情和其他视图。
- **证据**：`KanbanView.tsx:81-101`；`boardProjection.ts:72-82`；`record_public.rs:334-350`。
- **初步修复预测**：同列建立 position-only 原子命令；跨列才改字段。后端显式区分 reorder 与 value change。
- **风险与回归**：多投影独立位置、拖回原位、排序开启、活动日志、Undo、`updated_time` 系统字段。

### BOARD-H-03 · 筛选/搜索下拖卡或拖列删除隐藏手排配置

- **复现 A**：完整 `todo=[r2,r1]`，筛选后只见 `r1`，在同列 drop。
- **复现 B**：动态列顺序 `[C,A,B]`，过滤隐藏 A 后拖 B/C。
- **预期**：只调整可见项相对顺序，保留隐藏记录/列的位置。
- **实际**：分别保存为 `todo=[r1]` 和 `[B,C]`；清除条件后隐藏项只能按默认规则追加，原序无法恢复。
- **证据**：`StorageWorkspace.tsx:220-224,250` 只传可见记录；`KanbanView.tsx:34,62-70,96-101` 以可见 columns 覆盖完整配置。JSDOM 原始输出：`{"todo":["r1"]}`、`["B","C"]`。
- **初步修复预测**：对旧完整数组做稳定 splice/merge，只替换可见项相对序；或同时向 Board 提供 unfiltered universe。
- **风险与回归**：filter/search、跨列、多个关键词、动态列消失/重现、清除条件、重开、并发保存。

### BOARD-H-04 · 116px 虚拟槽与可增长卡片高度冲突

- **复现**：勾选多个卡片字段或使用长内容，使实际卡片高度超过 116px。
- **预期**：卡片视觉高度、虚拟位置、点击区、drop index 和总滚动高度一致。
- **实际**：虚拟列表固定以 116px 计算 `start/top/total height`；CSS 只设 `min-height:106px`，字段数量可无限增高，下一张卡仍放在前一张顶部后 116px。
- **影响**：卡片重叠、遮挡、点击/drop 命中错误和滚动空洞，属于显示功能失效。
- **证据**：`KanbanView.tsx:142-147`；`05-table.css:166-175`。
- **初步修复预测**：要么固定可证明的槽高并限制卡片展示，要么采用测量型虚拟化并在字段/宽度变化后 remeasure。
- **风险与回归**：长标题、字段增删、缩放、不同字体、滚动锚点、10k 记录、拖拽插入。

### BOARD-H-05 · “满足任一”完全未实现

- **复现**：配置两个条件和 `filterMode:any`，两条记录各满足一个条件。
- **预期**：两条记录都进入投影。
- **实际**：类型只允许 `"all"`，解析强制 `all`，执行固定 `every`；任一条件无 UI/持久化/执行路径。
- **影响**：`BOARD-011` 核心能力缺失。
- **证据**：`viewPipeline.ts:12,20-33,69-76`；`FilterPanel.tsx:43-45`。
- **初步修复预测**：按 view type 隔离：看板配置、UI、解析、执行支持 `all|any`，表格继续固定 AND；不可粗暴修改共享执行器后连带改变表格。
- **风险与回归**：旧配置、复制/重启、空条件、隐藏字段、多选投影、条件计数、表格行为隔离。

### BOARD-H-06 · 更换分组字段只提供易失的组件内撤销

- **复现**：更换分组字段后切视图/表，或卸载看板，再尝试撤销；也可更换后继续改卡片字段再点局部撤销。
- **预期**：当前会话权威 Undo 可恢复旧分组与失效前 Board 配置，不覆盖之后的无关修改。
- **实际**：旧配置只放在 `undoGroupChange` React state；卸载即丢，未进入 Rust Undo；局部按钮保存整份旧对象，可能覆盖之后的 Board config 变化。提示条件还忽略“只有折叠状态”的手动调整。
- **影响**：`BOARD-015` 的撤销合同不成立。
- **证据**：`KanbanView.tsx:28,55-60,132`；`undo.rs` 无 view-config/group-change action。
- **初步修复预测**：把分组字段与旧/新 Board config 建模为后端原子命令和 UndoAction，返回权威深度；仅还原该动作拥有的字段。
- **风险与回归**：连续更换、折叠-only、切表/视图、保存失败、并发配置、复制视图、多步 Undo。

### BOARD-H-07 · Board move 与普通配置保存是两个并发写入者

- **复现**：拖卡的 `moveBoardCard` 尚未返回时折叠列、调整卡片字段或列顺序；令两个成功请求以相反顺序完成。
- **预期**：移动值、位置与期间的新配置被串行合并，不能互相覆盖。
- **实际**：普通配置走 coordinator 的 `updateStorageViewConfig`；move 直接由 Rust 写整份 `board_config`，返回后前端又用事件开始时捕获的旧 `gridLayout` 调 `setGridLayout`。后完成的整份 Board JSON 可覆盖另一份成功修改；切视图时迟到 move 还可把本地 layout identity 写回旧 view。
- **影响**：用户收到两个成功动作，但折叠、字段、列序或卡片位置至少一份丢失。
- **证据**：`StorageWorkspace.tsx:157-188,250`；`record_public.rs:324-349`。
- **确认度**：控制流确定，98%；尚无生产延迟 IPC 回归测试。
- **初步修复预测**：所有 Board config mutation 使用同一按 `project/view/version` 串行的权威命令；服务端做版本检查或 patch merge，前端禁止闭包旧对象覆盖。
- **风险与回归**：成功乱序、失败乱序、切视图/项目、连续拖动、Undo、离线重试。

### BOARD-H-08 · Rust Board move 未绑定真实分组字段及配置身份

- **复现**：向 `storage_move_board_card` 传同表内另一个可写 field ID（包括标题字段）和任意对象 board config。
- **预期**：命令读取当前 view config，验证字段就是当前 `board.groupFieldId`、非标题、可写，并验证列 key/record positions 属于当前视图。
- **实际**：命令层只校验 `board_config` 是 object 及 view/record/field 同表；下游 `write_value` 会拒绝自动编号和系统时间，但标题及任意其他同表可写字段仍可被错误修改，随后整份 `board` JSON 被替换。
- **影响**：陈旧/错误调用可借“看板移动”写错字段、标题或脏配置，破坏领域不变量。
- **证据**：`record_public.rs:296-355`；`record_write.rs:34-42,79-120`。
- **初步修复预测**：建立版本化 Rust `BoardConfig`，从 DB 权威配置解析并校验字段身份、只读规则、列 key、记录归属与配置版本。
- **风险与回归**：字段刚删除/转换、视图切换、直接 IPC、旧配置迁移、并发版本冲突、原子回滚。

## 8. MEDIUM / LOW 问题详证

### BOARD-M-01 · 卡片字段排序按钮不改变实际渲染顺序

- `board.fieldIds=[b,a]` 时 UI 按 `data.fields.filter(...)` 渲染为 `[A,B]`；上移/下移只改数组却无视觉结果。
- 证据：`KanbanView.tsx:37,128,154`；JSDOM 输出 `requested=[b,a], rendered=[A,B]`。
- 修复预测：按 `fieldIds.map(id => fieldById.get(id))` 生成卡片字段，并清洗未知/重复 ID。

### BOARD-M-02 · 动态列默认顺序受卡片 sort 与陈旧 key 干扰

- `buildBoardColumns` 先 `stableSort(records, pipeline.sorts)`，再按首次出现值创建动态列；改变卡片排序可改变默认列序。暂时消失的 key 仍保留在 `columnOrder`，重现时也不一定是“新动态分组追加末尾”。
- 证据：`boardProjection.ts:54-61`。
- 修复预测：定义与 card sort 解耦的动态值顺序；消失 key 清理或版本化保留策略必须与 `BOARD-010` 一致。

### BOARD-M-03 · 看板数据动作失败无就近错误、pending 或重试

- create/drop/remove/delete/edit 直接 `await`，事件端用 `void`；store 只 rethrow，不保留 mutation error。失败既无邻近文案，也无 retry payload/重复提交保护。
- 证据：`KanbanView.tsx:73-117,135`；`tableDataStore.ts:53-58`。
- 修复预测：每个 action 使用结构化 pending/error/result，绑定目标 record/view 和可重试 payload。

### BOARD-M-04 · 只读分组仍暴露可拖拽、移出和快速新增

- 系统字段只在 value 计算/后端写入时拒绝；DOM 仍 `draggable`、接受 drop、显示“移出分组”和“新建记录”。快速新增必然尝试写只读分组字段。
- 证据：`boardProjection.ts:72-73`；`KanbanView.tsx:73-79,105-109,145-155`；`record_write.rs:40-42`。
- 修复预测：只读列移除写操作或明确禁用，提供非阻断原因与禁止落点反馈。

### BOARD-M-05 · 拖拽缺键盘等价、ARIA 与持续反馈

- 卡片/列仅使用原生 HTML5 `draggable`；无 keyboard sensor、live region、代理、插入线、有效/禁止落点。CSS 只有 `:active { opacity:.72 }`。
- 证据：`KanbanView.tsx:125-155`；`05-table.css:167-175`。
- 修复预测：统一列/卡拖拽状态机，补键盘排序、焦点回归、来源/代理/插入/禁止态和可读播报。

### BOARD-M-06 · 看板加载复用表格骨架和“表格数据”文案

- 首载所有视图都渲染 `DataGridLoadingSkeleton`，刷新文案固定为“正在刷新表格数据…”，不能保持最终看板列/卡几何。
- 证据：`StorageWorkspace.tsx:245-247`。
- 修复预测：按 view type 路由看板列骨架、局部刷新状态和对应错误恢复文案。

### BOARD-M-07 · 字段/选项生命周期清理不理解 Board schema

- 清理器只识别 `fieldId|field_id|field`，不识别 `groupFieldId`，也不处理 `columnOrder`、`collapsedKeys`、`cardPositions` 的对象 key；删组字段后解析器静默回退到第一普通字段。
- 影响：字段删除/转换、选项替换/清空后可静默换组或复用陈旧布局；option usage 也不统计纯 Board layout 引用。
- 证据：`field_repository_cleanup.rs:43-134`；`field_repository_options.rs:73-105`；`boardProjection.ts:28-38`。
- 修复预测：类型化 Board schema 定向清理/迁移，并纳入精确 Undo、复制视图和磁盘重开测试。

### BOARD-M-08 · 空值哨兵与附件数组投影键不安全

- 合法文本 `"__empty__"` 与内部未分组 key 冲突，会被标成“未分组”。image/file 的真实 cell value 是 relative-path 数组；当前仅 multi_select 展开数组，其余数组经 `String(value)` 合成逗号 key，列名暴露内部相对路径而非 `originalName`。
- 证据：`boardProjection.ts:51-57,91-95`；`attachments.rs:75-76,277-286`；`record_read.rs:28-37`。
- 修复预测：列 key 使用不可与用户值冲突的类型化编码；按 DC-08 明确附件是逐附件投影、记录级集合投影还是不支持跨列后，再接入 metadata label。

### BOARD-L-01 · 看板回归和性能门禁覆盖不足

- 当前看板专属仅 3 个投影测试和 6 个组件 happy path；没有类型编辑、同列多选、filtered merge、字段排序、any、只读、失败、分组 Undo、变高卡片、磁盘重开、键盘 DnD。
- 正式 `benchmark:phase39` 因 fixture 缺 `fieldOrder` 崩溃，无法证明 `DATA-005`。
- 证据：`boardProjection.test.ts`、`KanbanView.test.tsx`、`scripts/phase39-release-benchmark.ts:45`；交叉引用 FT-M-10。

### BOARD-L-02 · 不可达的旧 `Board.tsx` 生产实现仍留在仓库

- 当前 `App.tsx` 只挂 `StorageWorkspace`，生产使用 `KanbanView`；旧 `AppWorkspace.tsx` 仍引用另一套 `components/board/Board.tsx` 和测试，但未发现进入当前路由。
- 影响：审查/维护时可把旧测试和旧能力误当当前生产证据。
- 修复预测：确认无入口后删除或明确迁移/归档，测试只绑定生产路由；Stage 2 未执行，因此本轮只登记事实，不做重构。

## 9. 已有总账问题的看板影响（不重复计数）

| 既有 ID | 看板影响 |
|---|---|
| FT-H-04 | 卡片附件编辑/跨列/快速新增必须与网格一起收口到 attachment API。 |
| FT-H-05 | Board move/remove/delete Undo 先删记录且 backup 无附件，导致 metadata 级联丢失。 |
| FT-H-07 | Board 复用同一筛选工具，输入/焦点竞态会影响当前投影。 |
| FT-M-01 | 卡片 select 显示 raw ID，multi 只显示数量。 |
| FT-M-06 | Board 搜索无法可靠命中附件 `originalName`。 |
| FT-M-10 | 正式 10k×200 benchmark 当前不可执行。 |
| FT-M-11 | 后端 view config 除 fieldIds 外缺 schema/范围验证。 |
| FT-L-01 | 全量和相关定向测试中的 `fieldOrder` 旧期望仍红。 |
| SHELL-H-01/H-02 | 项目实例/request/cache 无可靠隔离；切项目与复制项目不能宣称通过。 |
| SHELL-H-07 | Board 记录命令也存在 DB commit 后 push Undo/加载 snapshot 的失败窗口。 |
| SHELL-H-08 | 全局 Undo 暴露为布尔一步状态，连续 Board Undo 不可靠。 |
| SHELL-H-09/H-10 | 切走视图后的配置失败和跨上下文瞬时状态直接影响 Board。 |

## 10. 测试、构建与 BLOCKED

### 10.1 已执行结果

| 验证 | 结果 | 能证明什么 |
|---|---|---|
| Board 定向 Vitest | **9/9 PASS** | 3 个投影场景、6 个组件 happy path；不能推翻本轮组合缺陷。 |
| 相关前端组合 | **33 PASS / 1 FAIL** | 唯一失败为既有 FT-L-01。 |
| 全量前端 | **1007 PASS / 2 FAIL** | 2 个失败：FT-L-01 与 `themeAudit` 检出当前 dirty `FieldEditPage.tsx` 的 `bg-white`。 |
| `pnpm exec tsc --noEmit` | **PASS** | TypeScript 编译通过。 |
| `pnpm build` | **PASS with warning** | 生产构建成功；主 JS 约 2,319kB、gzip 约 534kB，仍有既有 FT-L-03 告警。 |
| Rust Board exact | **1/1 PASS** | 简单文本跨列+配置+Undo happy path。 |
| Rust `storage::` | **52/52 PASS** | 存储基线；不含本轮关键组合。 |
| `cargo check --lib --locked` | **PASS** | Rust 编译检查通过。 |
| `pnpm benchmark:phase39` | **FAIL** | `fieldOrder` 缺失导致 `TypeError`，没有生产 P95；既有 FT-M-10。 |

原始编译/构建关键输出（ANSI 控制字符已去除，未改写结论）：

```text
$ pnpm exec tsc --noEmit --pretty false
（stdout/stderr 均为空）
exit=0
```

```text
$ pnpm build
$ tsc && vite build
vite v8.1.5 building client environment for production...
✓ 253 modules transformed.
dist/assets/index-B10bQPHJ.css   150.77 kB │ gzip: 36.21 kB
dist/assets/index-Ftkj6fNg.js  2,319.00 kB │ gzip: 534.29 kB
✓ built in 725ms
(!) Some chunks are larger than 500 kB after minification.
exit=0
```

```text
$ CARGO_TARGET_DIR=/private/tmp/morfra-board-audit-cargo-target cargo check --lib --locked
    Checking reqflow v0.2.0 (/Users/yichuangyang/项目/需求管理系统/reqflow/src-tauri)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.51s
exit=0
```

```text
$ pnpm benchmark:phase39
dist/phase39-release-benchmark.cjs  78.6kb
⚡ Done in 3ms
TypeError: Cannot read properties of undefined (reading 'map')
Error: DataGrid production viewport did not mount
Node.js v24.16.0
[ELIFECYCLE] Command failed with exit code 1.
exit=1
```

关键命令：

```text
pnpm exec vitest run src/components/board/KanbanView.test.tsx src/lib/board/boardProjection.test.ts
pnpm exec vitest run src/components/board/KanbanView.test.tsx src/lib/board/boardProjection.test.ts src/components/storage/StorageWorkspace.test.tsx src/components/table/tools/ViewTools.test.tsx src/components/workspace/ViewTabBar.test.tsx
pnpm test
pnpm exec tsc --noEmit
pnpm build
CARGO_TARGET_DIR=/private/tmp/morfra-board-audit-cargo-target cargo test --lib --locked storage::field_repository::tests::board_move_updates_record_and_view_config_in_one_undoable_backup -- --exact --nocapture
CARGO_TARGET_DIR=/private/tmp/morfra-board-audit-cargo-target cargo test storage:: --lib --locked -- --nocapture
CARGO_TARGET_DIR=/private/tmp/morfra-board-audit-cargo-target cargo check --lib --locked
pnpm benchmark:phase39
```

### 10.2 保持 BLOCKED 的项目

- 真实 macOS 窗口在 960×640、1199、1200、常规宽屏、超宽屏和全屏下的像素几何、底部填充与横向利用率。
- 真实拖拽代理、插入线、自动滚动、有效/禁止落点、命中区、焦点环、浅/深色对比度和“减少动态效果”。
- VoiceOver/真实屏幕阅读器对计数、拖拽、错误和 Undo 的播报。
- 10k×200 下搜索、筛选、排序、切换看板与滚动的 production 30 次 P95；正式脚本当前先崩溃。
- Board config 的真实磁盘 close/reopen 精确 round-trip、进程中断和失败注入；存储路径存在不等于直接测试已通过。
- `BOARD-003` 中 image/file 是否属于“多值字段”的精确产品语义；在 DC-08 决策前保持 BLOCKED，不以 multi_select 的通过替代。

## 11. 文档冲突与决策点

1. `BOARD-011` 要求看板支持“满足全部/任一”，`TABLE-018` 要求表格固定 AND；这是已明确的视图类型差异，不是待用户决策。实现必须按 view type 隔离，当前全局 AND 仍是确定缺陷。
2. `PROJECT-CONTEXT.md` 与 `DEV-PLAN.md` 头部声称 Phase 32～44 已完成，但 Phase 40 正文仍写“未批准”；沿用既有 DC-02/DC-06/DC-07，不新增重复决策号。
3. Phase 40 规划独立 ordering 表/模块，当前实现将 Board config 全部内联进 `view_configs.board` 与 `KanbanView.tsx`。JSON 实现不自动构成功能缺陷，但开发计划交付清单与事实需重新对齐。
4. `BOARD-001/003/005` 允许除标题外任何字段并提到“多值字段”，但没有定义 image/file 是逐附件投影、按附件集合投影还是仅展示不可跨列。DC-08 只决定附件分组身份与跨列语义；不阻塞已经确定的事项：禁止通用 prompt 写附件、使用 metadata/originalName 展示、禁止制造假附件 cell value。

## 12. 初步修复分组（不是开发计划）

| 批次建议 | 目标 | 问题 | 前置 |
|---|---|---|---|
| B0 | 先阻断数据/配置误写 | BOARD-H-01/H-02/H-03/H-07/H-08、FT-H-05 | 先补失败测试；复用 RG-01/RG-04/RG-11 |
| B1 | 统一 Board 类型化模型与生命周期 | BOARD-H-05/H-06、BOARD-M-07/M-08 | DC-08 只阻塞附件精确投影；all/any 按现有 Spec 直接按 view type 隔离 |
| B2 | 重建看板几何与字段工具 | BOARD-H-04、BOARD-M-01/M-02/M-06 | 先冻结卡片高度/测量合同 |
| B3 | 完成操作状态与可访问拖拽 | BOARD-M-03/M-04/M-05 | 消费 B0 的结构化 action 结果 |
| B4 | 恢复可信门禁并清理旧实现 | BOARD-L-01/L-02、FT-M-10 | 前序功能批次完成后全量复验 |

## 13. 机械完整性与最终边界

### 13.1 开始时关键 SHA-256

```text
DEV-PLAN.md 4c9f7741e6dbb85c82feb0e52c7cb3d8b071cc222d58018381a9c790ae298865
Design-Brief.md 9756bb060d4ee8e97f3e145840b31321f1f7325ea397638393f9b6fe766e4833
PROJECT-CONTEXT.md 01d538465ec1ec7588aee671c34ccf6914fe1afe3446ae8d8fdd77dd660e3857
Product-Spec-CHANGELOG.md 938180fbf051635cf70eed47fc996a8302a03a0641549cf3d1b6409a43d4a153
Product-Spec.md de290f43547c41a3b2f9ec7894152771dea2ab8e74c0743adb6c1923aef72509
reqflow/src-tauri/src/storage/migrations.rs 8a34d4f32ba9f2f850e98bab41c8d8a225e05d92c894554dbfb1ee2261d76f9a
reqflow/src/components/storage/StorageWorkspace.tsx e25925e5b521f2139a52a6eef4732ea6bc91b21bb62a2eb7916f321aad1902f4
reqflow/src/components/table/DataGrid.interaction.test.tsx c6a24fbd020085e3e7233ad2f0a913367cef1fe63d4ad546f305fd61d3f2d07e
reqflow/src/components/table/editors/CellEditorHost.tsx 1d5b452d2ce682c5274bfc28ed3e0931c4c3d8f7239a4d6dc9130e9db9badd60
reqflow/src/styles/global/05-table.css d46b63c74ac7289f30610a5980c69acc5a2caf1415a141bfd58a226a10a09ffc
docs/audits/2026-08-20-field-table-self-check.md 7f7c902b96767d58bbb5d6c489ded9f903f1c4b79b4e28deddfd5c6f8abed088
docs/audits/2026-08-20-shell-self-check.md 195608a3663bb3582771222b807ac0cf67688a2689dd8adfcb84d0f315bb46e5
docs/audits/AUDIT-REGISTER.md eb0f0f615faf5a8c1a33b1ad644e876dd856866631d35fd3b4b214eeeff8103c
reqflow/src-tauri/migrations/010_repair_field_foreign_keys.sql 6f21824fda3d14a9f066687e59332dbb16a7dbcb28d3b7acac88984aac44c920
```

其余开始时 dirty 文件也纳入机械对比，不因未逐项展示而排除。最终校验要求：除本报告和 `AUDIT-REGISTER.md` 外，所有开始时文件哈希不变，且没有新增第三个持久化文件。

### 13.2 Stage 门禁

- 总账机械计数：`68 = HIGH 29 + MEDIUM 33 + LOW 6`；问题状态 `待处理 67 / 待决策 1`；全局 ID 重复 `0`。
- BOARD 双文档映射：`H 8 / M 8 / L 2`，编号连续，遗漏 `0`；`RG-16～19` 实际分布 `5/3/7/3`，`B0～B4` 实际分布 `5/4/4/3/2`。
- 相对报告链接均存在；`git diff --check` 通过。
- 开始时除 `AUDIT-REGISTER.md` 外的 20 个 dirty/untracked 文件逐个 SHA-256 与结束值一致；未改产品文档、代码、测试、迁移或既有审查报告。
- 结束状态相对开始只多出 `docs/audits/2026-08-20-board-self-check.md`，并更新 `docs/audits/AUDIT-REGISTER.md`；没有第三个持久化文件，没有 commit/push。
- **Stage 1：FAIL**。
- **Stage 2：SKIPPED**。
- 下一赛程应先让 dev-planner 消费总账中的“待处理/待决策”集合；本报告本身不是获批开发计划。
