# Morfra v3 产品外壳 SHELL 全量只读自检

> 文档类别：**审查证据，不是产品事实或开发计划**。
>
> 审查日期：2026-08-20（Asia/Shanghai）
>
> 审查范围：启动与项目生命周期、顶栏与窗口、左侧边栏、视图栏
>
> 屏幕读取：关闭；未使用 Browser、Computer Use、截图、`view_image`、GUI 或其他视觉工具
>
> 处置边界：只审查，不修复、不写开发计划、不提交、不推送

## 1. 结论

**Stage 1：FAIL；Stage 2：SKIPPED。**

四个覆盖区都完成了 Stage 1，没有在发现 HIGH 后提前停止。共登记 **25 个新的 SHELL 问题：HIGH 12 / MEDIUM 12 / LOW 1**；另引用 6 个已存在的 FT 问题，不重复登记。

| 覆盖区 | 结论 | 主因 | 本轮主归属问题 |
|---|---|---|---:|
| 启动与项目生命周期 | **Stage 1 失败** | 项目会话无请求/实例作用域、复制项目身份冲突、坏项目静默消失、模板入口缺失、Undo 与命令确认边界失真 | 10 |
| 顶栏与窗口 | **Stage 1 失败** | 1199→1200 状态残留、1200px 主区跌到 520px、窄窗抽屉形态错误、主题双真相 | 5 |
| 左侧边栏 | **Stage 1 失败** | 菜单/确认/拖拽/Tooltip 键盘合同缺失，20 个最近项目在最小高度溢出 | 5 |
| 视图栏 | **Stage 1 失败** | 配置失败静默丢失、草稿跨上下文、菜单裁切、失败误判成功、复制只能可靠执行一次 | 5 |

为避免跨区域影响被重复计数，25 项采用一个“统计主归属”：启动/生命周期 = H-01、H-02、H-03、H-04、H-07、H-08、M-02、M-03、M-04、L-01；顶栏/窗口 = H-05、H-06、H-12、M-01、M-12；左侧边栏 = M-05、M-06、M-07、M-10、M-11；视图栏 = H-09、H-10、H-11、M-08、M-09。影响范围仍以各问题详证为准。

存在 HIGH，按 code-review 规则跳过 Stage 2；本报告没有伪造质量审查通过结论。

## 2. 基线与边界

### 2.1 Git 基线

- 分支：`main`
- HEAD：`afd755d2cdd3c1e071c14afde65e5cdda9c01055`
- 审查开始时工作区已经是 dirty；这些改动属于用户，本轮未回滚、清理或覆盖。
- 开始时已有 modified/untracked：

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
?? docs/audits/AUDIT-REGISTER.md
?? reqflow/src-tauri/migrations/010_repair_field_foreign_keys.sql
```

开始时逐文件 SHA-256 已保存，并在 §13 与结束状态机械对比。唯一获准的持久化变化是本报告和 `AUDIT-REGISTER.md`。

### 2.2 权威来源

1. 产品行为：`Product-Spec.md`，重点 IA-001～013、EXP-001～017、VIEW-001～006、DATA-001～003/007～008；新建项目路径同时核对 TEMPLATE-001～004。
2. 视觉与交互：`Design-Brief.md` 的 V3-DB-001～011。
3. 实现范围：`DEV-PLAN.md` 的 Phase 32～34、44～45；只用于核对范围和声明，不覆盖 Spec。
4. 当前问题状态：`docs/audits/AUDIT-REGISTER.md`。
5. 未读取 `docs/archive/` 或 `docs/future/` 猜需求。

### 2.3 取证方式

- 主 Agent 读取权威原文、关键前端/Rust 调用链、CSS 和测试。
- 并行只读审查：前端外壳、Rust 项目/表/视图生命周期。
- 强制 `code-reviewer` 完成全部四区 Stage 1，并对独立审查差异做补充复核。
- 可由代码、纯函数、DOM/CSS 几何、JSDOM、SQLite 测试和构建证明的项目直接判定；真实屏幕才可证明的项目一律 `BLOCKED`。

## 3. 需求追踪

### 3.1 IA-001～013

| ID | 判定 | 证据摘要 |
|---|---|---|
| IA-001 | PASS | `ProjectSnapshot`、`StorageWorkspace` 按项目→表→视图组织。 |
| IA-002 | PASS | SQLite 的表、字段、记录、视图均按稳定 ID/`table_id` 隔离。 |
| IA-003 | BLOCKED | Shell 结构存在；真实 macOS 质感与连续性需要屏幕证据。 |
| IA-004 | FAIL | 48/96～360/240/56/72 常量存在，但窄窗浮层状态跨 1200px 残留，见 SHELL-H-05。 |
| IA-005 | PASS | 项目入口在标题栏，侧栏只呈现当前项目表。 |
| IA-006 | FAIL | 表列表单层、滚动、选中存在；拖拽无代理/插入线/禁止态、紧凑态无应用 Tooltip，见 SHELL-M-07/M-11。 |
| IA-007 | FAIL | 新建表主路径较完整；表生命周期 Undo 只覆盖部分动作且只能连续一次，见 SHELL-H-08。 |
| IA-008 | FAIL | 最后一表保护存在；删除表 Undo 不完整已由既有 `FT-H-09` 跟踪。 |
| IA-009 | FAIL | 最近项目/打开/移除入口存在；会话竞态、复制项目冲突和坏项目静默消失，见 SHELL-H-01～H-03。 |
| IA-010 | PASS | 主区顺序为表头→视图栏→工具栏→画布。 |
| IA-011 | PASS | 标题栏顺序、拖拽区、AI 开关宿主、文件/设置菜单与无字标均有静态证据。 |
| IA-012 | PASS | 空间足够时详情与 AI 使用两个独立右栏；窄窗抽屉形态另由 EXP-006/007 跟踪。 |
| IA-013 | FAIL | 宽度常量存在；1200px 特定组合把主区压到 520px，见 SHELL-H-06。 |

### 3.2 EXP-001～017

| ID | 判定 | 证据摘要 |
|---|---|---|
| EXP-001 | FAIL | 1199→1200 的导航浮层残留改变右栏，临界状态不连续。 |
| EXP-002 | BLOCKED | 字体和层级代码存在；真实专业工具质感无屏幕证据。 |
| EXP-003 | PASS | 中性色、冷蓝及状态 Token 均已定义。 |
| EXP-004 | PASS | Tauri `minWidth=960`、`minHeight=640`。 |
| EXP-005 | BLOCKED | flex/grid 可扩展；真实全屏结构性空白未验证。 |
| EXP-006 | FAIL | 48px 与抽屉分支存在，但窄窗双开时出现合并 Tab 形态，且导航残留可隐藏右栏。 |
| EXP-007 | FAIL | dual/merged 计算存在；活动 AI 时 clamp 使用错误下限，破坏 560px 主区。 |
| EXP-008 | BLOCKED | 宽高均进入计算；真实全屏/恢复连续性未验证。 |
| EXP-009 | FAIL | 三档偏好存在，但嵌套模块 Token 可把深色工作区改回静态浅色，见 SHELL-H-12。 |
| EXP-010 | FAIL | 冷蓝 Token 存在，但用户主题与固定产品强调色没有唯一优先级，见 SHELL-H-12。 |
| EXP-011 | BLOCKED | 紧凑尺寸有代码；真实密度、截断与可读性无屏幕证据。 |
| EXP-012 | BLOCKED | 圆角/边界/阴影有 Token；卡片层级需真实渲染。 |
| EXP-013 | PASS | Shell 使用系统 SF 回退栈。 |
| EXP-014 | FAIL | reduced-motion 降级存在；表/视图拖拽缺持续代理、插入与禁止反馈。 |
| EXP-015 | FAIL | 多个菜单、确认框和排序缺焦点/键盘合同。 |
| EXP-016 | FAIL | 坏项目无安全恢复入口，视图保存失败可静默，生命周期失败会丢草稿。 |
| EXP-017 | FAIL | 外壳 Token 存在；主题存在双真相，且既有 `FT-M-09` 仍使主题门禁红。 |

### 3.3 VIEW-001～006 与 DATA-001～003/007～008

| ID | 判定 | 证据摘要 |
|---|---|---|
| VIEW-001 | PASS | 表格/看板共享同表记录。 |
| VIEW-002 | FAIL | 独立配置存在；切走后保存失败会无提示丢失，后端脏配置问题另由 `FT-M-11` 跟踪。 |
| VIEW-003 | PASS | 同表切视图不复制底层记录。 |
| VIEW-004 | FAIL | 生命周期与最后视图保护存在；复制固定命名只可靠一次，失败又会被当成功。 |
| VIEW-005 | FAIL | 图标/选中/排序入口存在；无可访问排序反馈。 |
| VIEW-006 | FAIL | 横向滚动、全部视图和当前项滚入存在；行内操作菜单被滚动容器裁切。 |
| DATA-001 | FAIL | 目录合同存在；复制项目因相同 manifest ID 和无项目作用域缓存不能可靠独立共存。 |
| DATA-002 | PASS | 项目/表/Emoji/视图使用 SQLite 持久化和事务。 |
| DATA-003 | PASS | 当前启动主链直接使用 SQLite 项目包。 |
| DATA-007 | FAIL | 跨项目请求、视图保存和非删除生命周期 post-commit 返回窗口不满足“成功或完全不生效”。 |
| DATA-008 | PASS | 每日/手动/迁移前备份与恢复测试存在；不代表错误打开前置校验正确。 |

### 3.4 V3-DB-001～011

| ID | 判定 | 证据摘要 |
|---|---|---|
| V3-DB-001 | BLOCKED | 结构和 Token 存在；整体气质需屏幕证据。 |
| V3-DB-002 | FAIL | 1199/1200 状态残留和 520px 主区是确定性布局错误。 |
| V3-DB-003 | FAIL | 浅深存在两套未联动 Token 真相。 |
| V3-DB-004 | BLOCKED | 冷蓝代码存在；参考气质无法静态证明。 |
| V3-DB-005 | FAIL | 视图层级存在，但核心操作菜单确定被裁切。 |
| V3-DB-006 | BLOCKED | 材质职责有 CSS；真实叠层需屏幕证据。 |
| V3-DB-007 | BLOCKED | 字体栈存在；真实字号可读性未验证。 |
| V3-DB-008 | FAIL | 响应式和拖拽均存在中断/缺失反馈。 |
| V3-DB-009 | FAIL | 项目/视图菜单、确认框及排序缺完整键盘/焦点状态。 |
| V3-DB-010 | FAIL | 坏项目无恢复入口，视图失败可静默，首帧先用默认布局再水合。 |
| V3-DB-011 | FAIL | 模块主题覆盖破坏浅深一致性；真实材质另为 BLOCKED。 |

需求追踪统计：**PASS 14 / FAIL 28 / BLOCKED 10，共 52 项，遗漏 0。**

## 4. 原子验收矩阵

单元格中的 `SHELL-*` 为本报告局部/全局同名 ID；`FT-*` 为既有总账问题。`N/A` 不计入分母。

| 场景 | 启动/生命周期 | 顶栏/窗口 | 左侧边栏 | 视图栏 |
|---|---|---|---|---|
| 正常主路径 | PASS | PASS | PASS | PASS |
| 取消 / Esc | PASS | PASS | PASS | FAIL · SHELL-M-08 |
| 重复提交 | FAIL · SHELL-M-03 | PASS | FAIL · SHELL-M-03 | FAIL · SHELL-M-03 |
| 保存失败 / 重试 | FAIL · SHELL-H-03/H-07/M-04 | FAIL · SHELL-M-04 | PASS | FAIL · SHELL-H-09/M-08 |
| 多步 Undo | FAIL · SHELL-H-08/FT-H-09 | N/A | FAIL · SHELL-H-08/FT-H-09 | N/A |
| 切表中有临时状态 | PASS | PASS | FAIL · SHELL-H-10 | FAIL · SHELL-H-10 |
| 切视图中保存 | PASS | PASS | PASS | FAIL · SHELL-H-09 |
| 切项目中有请求/草稿 | FAIL · SHELL-H-01/H-02 | PASS | FAIL · SHELL-H-10 | FAIL · SHELL-H-10 |
| 复制 / 移动项目包 | FAIL · SHELL-H-02 | N/A | PASS | PASS |
| 关闭重开 | FAIL · SHELL-H-03 | PASS | PASS | BLOCKED |
| 缺失 / 损坏 / 打开失败 | FAIL · SHELL-H-03/M-02 | PASS | PASS | PASS |
| 空值 / 空名称 | PASS | N/A | PASS | PASS |
| 长名称 / 长列表 | PASS | PASS | FAIL · SHELL-M-10/M-11 | FAIL · SHELL-H-11 |
| 同名 | BLOCKED | N/A | BLOCKED | BLOCKED |
| 多表 / 多视图 | FAIL · SHELL-H-02 | PASS | PASS | FAIL · SHELL-H-11/M-09 |
| 键盘 / 焦点 / ARIA | FAIL · SHELL-M-05/M-06 | PASS | FAIL · SHELL-M-05/M-06/M-07/M-11 | FAIL · SHELL-H-11/M-06/M-07/M-08 |
| 浅色 / 深色 / 减少动态 | PASS | FAIL · SHELL-H-12/SHELL-M-12 | BLOCKED | FAIL · SHELL-H-12 |
| 窄窗详情 + AI 双开 | PASS | FAIL · SHELL-M-01 | PASS | PASS |
| 960×640 | FAIL · SHELL-M-10 | PASS | FAIL · SHELL-M-10 | FAIL · SHELL-H-11 |
| 1199px → 1200px | PASS | FAIL · SHELL-H-05/H-06 | FAIL · SHELL-H-05 | FAIL · SHELL-H-06 |
| 常规宽屏 / 全屏 | PASS | BLOCKED | BLOCKED | BLOCKED |

矩阵统计由 §13 脚本从表格机械读取；真实窗口、对比度、视觉连续性和系统辅助技术播报保持 BLOCKED，不以静态推测冒充通过。

## 5. 新问题总览

| ID | 优先级 | 主区域 | 摘要 | 判定 |
|---|---|---|---|---|
| SHELL-H-01 | HIGH | 启动与项目生命周期 | 项目会话与异步响应无请求/实例作用域，可跨项目串快照或命令目标 | 已确认，98% |
| SHELL-H-02 | HIGH | 启动与项目生命周期 | 复制项目同 manifest ID 被合并，缓存又仅按 tableId/viewId 键控 | 已确认，100% |
| SHELL-H-03 | HIGH | 启动与项目生命周期 | 最近项目损坏/缺失被静默丢弃，并可能自动创建默认项目 | 已确认，100% |
| SHELL-H-04 | HIGH | 启动与项目生命周期 | 当前两个常规新建项目入口均不提供空白/需求模板选择 | 已确认，100% |
| SHELL-H-05 | HIGH | 顶栏/窗口 | 1199px 打开的导航浮层跨到 1200px 后不可见但继续隐藏右栏 | 已确认，100% |
| SHELL-H-06 | HIGH | 顶栏/窗口 | 1200px 活动 AI 合并态可把主区压至 520px | 已确认，100% |
| SHELL-H-07 | HIGH | 启动与项目生命周期 | 非删除生命周期命令可在提交后因快照/会话失败而向前端报错 | 控制流确认，95% |
| SHELL-H-08 | HIGH | 启动与项目生命周期 | 50 步 Rust Undo 在 UI 只可连续一次，且多类表生命周期未入栈 | 已确认，100% |
| SHELL-H-09 | HIGH | 视图栏 | 切走视图后配置保存失败会删除 pending 且不提示、不重试 | 已确认，100% |
| SHELL-H-10 | HIGH | 视图栏 | 表/视图/项目切换不清临时状态，旧草稿可提交到新上下文 | 已确认，98% |
| SHELL-H-11 | HIGH | 视图栏 | 视图操作菜单处在横向滚动裁切链内 | DOM/CSS 确认，98% |
| SHELL-H-12 | HIGH | 顶栏/窗口 | `data-appearance` 与 themeStore/module-scope 形成双主题真相 | CSS 继承与运行时写入链确认，99%；真实颜色与对比度 BLOCKED |
| SHELL-M-01 | MEDIUM | 顶栏/窗口 | 窄窗详情与 AI 同开时渲染合并 Tab，而不是仅活动面板抽屉 | 已确认，100% |
| SHELL-M-02 | MEDIUM | 启动与项目生命周期 | 打开项目在身份/结构校验前已建目录并执行迁移 | 已确认，100% |
| SHELL-M-03 | MEDIUM | 启动与项目生命周期 | 项目、视图、重命名和 Emoji 的重复提交/乱序保护不完整 | 已确认，95% |
| SHELL-M-04 | MEDIUM | 启动与项目生命周期 | 文件菜单新建/打开绕过模板及就近错误状态，Promise 失败无人接管 | 已确认，95% |
| SHELL-M-05 | MEDIUM | 左侧边栏 | 项目菜单无 Esc/外点/方向键/首项焦点，行操作只在 hover 显示 | 已确认，100% |
| SHELL-M-06 | MEDIUM | 左侧边栏 | 共用删除确认框无 dialog/焦点/并发确认合同 | 已确认，100% |
| SHELL-M-07 | MEDIUM | 左侧边栏 | 表与视图排序只有原生拖拽，无代理/插入/禁止态及键盘等价 | 已确认，100% |
| SHELL-M-08 | MEDIUM | 视图栏 | 父层吞掉生命周期错误，子层误判成功并清除草稿/确认态 | 已确认，100% |
| SHELL-M-09 | MEDIUM | 视图栏 | 复制视图固定生成“副本”，同一视图只能可靠复制一次 | 已确认，100% |
| SHELL-M-10 | MEDIUM | 左侧边栏 | 20 个最近项目菜单无高度限制，960×640 下底部入口可被裁切 | CSS/DOM 确认，95% |
| SHELL-M-11 | MEDIUM | 左侧边栏 | 48px 紧凑表名仅依赖原生 `title`，无 hover/focus 应用 Tooltip | 已确认，100% |
| SHELL-M-12 | MEDIUM | 顶栏/窗口 | 布局与外观偏好在首帧后才 hydrate，启动会先渲染默认态 | React 时序确认，95% |
| SHELL-L-01 | LOW | 启动与项目生命周期 | 52 个 SHELL 定向测试未覆盖所有确定性 HIGH 路径，形成假绿 | 已确认，100% |

## 6. HIGH 问题详证

### SHELL-H-01 · 项目会话与异步响应没有请求/实例作用域

- **范围**：启动与项目生命周期；表/视图全部异步生命周期。
- **复现**：在项目 A 发起新建表、重命名、Emoji、排序或视图操作；响应返回前切换到项目 B；让 A 响应晚到。
- **期望**：响应只更新发起时的 A，或因 generation/session 不匹配被丢弃；后端命令只作用于显式项目实例。
- **实际**：`replaceCurrentSnapshot` 在响应时重新读取 `currentProjectId`，把 A 的 snapshot 更新进 B 项目对象。Rust 仅保存全局 `active_project`，命令开头读取一次路径；项目打开、最近记录更新、前端 set 又不是一个原子切换。
- **影响**：B 可显示 A 的表/视图；UI 快照、后端活动项目和 Undo 归属分叉，继续操作可能写向错误项目。
- **判定**：控制流已确认，置信度 98%；实际延迟 IPC 复现尚缺。
- **证据**：`reqflow/src/stores/projectStore.ts:41-45,76-84,161-217`；`projectStoreHelpers.ts:73-85`；`src-tauri/src/storage/commands.rs:15-29`；`src-tauri/src/storage/mod.rs:27-30`。
- **初步修复预测**：引入规范化路径/实例键与 request generation；所有命令显式携带项目实例或 session token，响应校验目标项目及 `snapshot.manifest.id`，过期响应不得落状态。
- **修复风险**：高；会触及项目切换、全部 store cache、IPC 合同和 Undo 会话。
- **必跑回归**：A/B/A 快切；成功/失败乱序；所有表/视图生命周期；切换中保存；Undo；重启。

### SHELL-H-02 · 复制项目不能作为独立实例可靠共存

- **范围**：项目复制/移动、最近项目、工作区缓存。
- **复现**：复制整个项目文件夹；原件和副本继承相同 manifest/table/view ID；先打开原件形成缓存，再打开副本并交替编辑。
- **期望**：DATA-001 要求两个目录可独立重新打开、显示、保存和出现在最近列表。
- **实际**：`openProject` 按 manifest ID 替换已有项目；最近项目按 ID 或路径去重；`tableDataStore`、`activeViewByTable` 和本地视图缓存主要只按 tableId/viewId 键控，副本会命中原件运行态数据。
- **影响**：原件从入口消失，副本显示或复用原件缓存，用户难以确认实际写入的是哪个目录。
- **判定**：静态数据键确认，置信度 100%。
- **证据**：`Product-Spec.md:65`；`projectStore.ts:89-94`；`recentProjects.ts:34-41`；`workspaceStore.ts:3-19`；`tableDataStore.ts:24-65`；`StorageWorkspace.tsx:63-70,89-115`。
- **初步修复预测**：以规范化路径产生 `projectInstanceKey`，所有项目/表/视图/选择/缓存使用复合键；明确副本首次打开是否换发 manifest ID。
- **修复风险**：高；旧 localStorage key 和已有最近记录需要迁移。
- **必跑回归**：原件/副本同时存在、分别修改、路径移动、同 ID 双路径、冷启动/热切换、缓存与最近列表隔离。

### SHELL-H-03 · 坏的最近项目被静默丢弃并伪装成默认项目

- **范围**：首次/再次启动、缺失/移动/损坏项目、最近项目恢复。
- **复现**：截断 `recent-projects.json`，或让最近路径缺失、manifest/SQLite 损坏，再启动。
- **期望**：稳定外壳保留失败项目、路径和原因，允许重试、重新定位、移除或从备份恢复。
- **实际**：最近 JSON 解析失败直接返回空数组；逐项目打开错误被空 `catch` 吞掉；没有成功项时自动创建“默认项目”。注释声称下一次写入清理，但失败记录并未可靠治理。
- **影响**：已有项目入口凭空消失，用户可能误判数据丢失并在新默认项目继续工作。
- **判定**：已确认，置信度 100%。
- **证据**：`recentProjects.ts:16-30`；`projectStoreHelpers.ts:53-70`；`App.tsx:25-34`；`Product-Spec.md:60`。
- **初步修复预测**：最近记录独立保存 `healthy/broken` 状态；文件使用原子替换和 previous 副本；启动只选择可打开项目，但不得静默删除坏项或用新项目掩盖。
- **修复风险**：中高；涉及启动路由、最近记录格式与恢复 UI。
- **必跑回归**：单项/全部损坏、路径移动、JSON 截断、manifest/DB 损坏、重新定位、移除、重试、备份恢复。

### SHELL-H-04 · 当前新建项目入口没有模板选择

- **范围**：标题栏项目菜单与“文件→新建项目”。
- **复现**：通过当前 Shell 的项目切换器或文件菜单新建项目。
- **期望**：TEMPLATE-001 要求先提供“空白项目”和“需求管理模板”。
- **实际**：侧栏 `ProjectSwitcher` 只提交项目名，始终调用 `createProject(nextName)`；文件菜单事件使用 `window.prompt` 后同样不传 template。旧 `components/topbar/CreateProjectForm.tsx` 支持模板，但当前 `App→MorfraShell` 未接入它。
- **影响**：用户无法从当前常规路径创建需求管理模板项目，Phase 34 核心入口失效。
- **判定**：已确认，置信度 100%。
- **证据**：`Product-Spec.md:189-194`；`ProjectSwitcher.tsx:43-55,91-95`；`MorfraShell.tsx:101-128`；`projectStore.ts:97-106`；`App.tsx:38`。
- **初步修复预测**：建立唯一可复用的新建项目流程供标题栏与文件菜单调用，明确模板、名称、pending、错误与取消状态。
- **修复风险**：中；需淘汰或迁移旧入口，避免两套表单再次漂移。
- **必跑回归**：空白/需求模板、取消、失败、重复提交、文件菜单和标题栏一致、磁盘重开。

### SHELL-H-05 · 1199→1200 后残留导航状态隐藏右栏

- **范围**：顶栏、窗口断点、左侧导航浮层、详情/AI 宿主。
- **复现**：1199px 打开导航浮层并保持详情或 AI 已打开；窗口扩大到 1200px。
- **期望**：导航浮层退出，常规侧栏与右栏恢复，用户偏好不变。
- **实际**：`narrowSidebarOpen` 没有随模式变化清理；1200px 后浮层不再渲染，但原值仍传给 `RightPanelHost`，后者直接 `return null`。网格仍为右栏预留空间。
- **影响**：详情/AI 内容消失并留下空白轨道，常规模式按钮也不清这个残留状态。
- **判定**：已确认，置信度 100%。
- **证据**：`MorfraShell.tsx:69-70,93-99,194-200,220-229`；`RightPanelHost.tsx:54-57`；`Product-Spec.md:50-51`。
- **初步修复预测**：离开 narrow 时清瞬时 overlay；只传 `layout.mode === "narrow" && narrowSidebarOpen`；建立断点状态转换 reducer。
- **修复风险**：中；必须保持用户 sidebarOpen 偏好不被自动状态覆盖。
- **必跑回归**：1199↔1200 往返，导航/详情/AI/双开组合，拖拽中 resize，偏好恢复。

### SHELL-H-06 · 1200px 活动 AI 合并态把主区压至 520px

- **范围**：顶栏与窗口几何、右栏合并态。
- **复现**：`viewport=1200`、`sidebarOpen=true/sidebarWidth=360`、详情 440 与 AI 360 都打开、`activeRightPanel=ai`。
- **期望**：主显示区始终不少于 560px。
- **实际**：侧栏先按 AI 下限 320 算成 304px；随后单栏 clamp 却因 `detailOpen` 为真使用详情下限 360，甚至在最大可用 320 时仍返回 360。最终 `1200-304-8-8-360=520`。
- **影响**：表格/视图栏在临界宽度被压缩到 Spec 禁止的尺寸，字段对齐和操作可达性继续恶化。
- **判定**：函数与算术确认，置信度 100%。
- **证据**：`windowLayout.ts:47-48,81-87,104-113`；`Product-Spec.md:41,51`；现有 `windowLayout.test.ts` 未覆盖活动 AI 组合。
- **初步修复预测**：统一 `activePanelMin`；clamp 的 min/max 不得逆序；不足时继续缩侧栏或进入正确布局模式。
- **修复风险**：中高；影响所有右栏组合和侧栏压缩。
- **必跑回归**：1200、侧栏 96/240/360、活动 detail/AI、单开/双开，断言最终 DOM 主轨道 ≥560。

### SHELL-H-07 · 非删除生命周期可在提交后向前端报失败

- **范围**：Rust 表/视图生命周期、DATA-007 原子确认语义。
- **复现**：对 create/rename/reorder/view lifecycle 在数据库 commit 后、返回 snapshot 或获取 session lock 时注入失败。
- **期望**：命令返回失败时磁盘完全不变；返回成功时 snapshot 与 Undo 同时可用。
- **实际**：`storage_create_table` 先提交，再加载 snapshot，再获取 mutex 并压 Undo；snapshot/锁失败会留下已创建表且无对应 UI 成功/Undo。rename/reorder/create/duplicate/delete view 也在提交后再加载 snapshot，无补偿。删除表分支已有专门补偿，故不纳入此问题。
- **影响**：用户看到失败但磁盘已改，重试可能撞重复名；UI、磁盘和 Undo 产生三种事实。
- **判定**：提交边界控制流确认，置信度 95%；各故障点尚未全部注入。
- **证据**：`commands.rs:80-94`；`lifecycle_commands.rs:65-86,202-269`；删除补偿对照 `lifecycle_commands.rs:14-38,90-117,168-198`；`Product-Spec.md:71`。
- **初步修复预测**：mutation、响应快照与 Undo 记录进入同一可补偿命令边界；或预先持有会话锁并在 post-commit 失败时精确逆转。
- **修复风险**：高；错误补偿本身可能二次失败。
- **必跑回归**：每个命令的 commit 前/后 snapshot/锁故障，逐项对账返回值、磁盘、snapshot、Undo；保留删除表现有补偿测试。

### SHELL-H-08 · 50 步 Undo 在 Shell 中退化为部分动作的一步撤销

- **范围**：表生命周期、全局 Command+Z。
- **复现**：连续新建/删除两张表后在非输入控件按两次 Command+Z；再检查重命名、Emoji、排序能否撤销。
- **期望**：所有 Spec 定义的表生命周期动作进入当前会话 50 步栈，连续撤销直到栈空。
- **实际**：前端只有布尔 `canUndo`，第一次撤销后无条件置 false，第二次在 Shell 被拦截；只有新建/删除显式设置 true，重命名、Emoji、排序命令也没有压逆操作。
- **影响**：用户无法连续撤销，且多类表生命周期根本不可撤销；删除表内容恢复不完整另由 `FT-H-09` 跟踪。
- **判定**：已确认，置信度 100%。
- **证据**：`projectStore.ts:13-19,161-217`；`MorfraShell.tsx:81-91`；`src-tauri/src/storage/undo.rs:44-61`；`lifecycle_commands.rs:65-86,202-209`。
- **初步修复预测**：后端返回 authoritative undo depth/canUndo；每次命令/Undo 后同步；补齐所有已要求生命周期逆操作并统一快捷键归属。
- **修复风险**：高；需与表格/字段/记录 Undo 和输入框原生 Undo 隔离。
- **必跑回归**：2/50/51 步、所有表动作、失败不弹栈、项目切换/关闭清栈、输入控件不劫持。

### SHELL-H-09 · 切走视图后保存失败会静默丢失

- **范围**：视图配置自动保存、切换视图/表/项目。
- **复现**：修改视图 A 配置，保存未完成时切到 B，令 `updateStorageViewConfig(A)` 失败，再返回 A。
- **期望**：A 持续显示未落盘错误、保留草稿并可重试。
- **实际**：catch 先删除 A 的 pending；`shouldRollback...` 判断 A 已非当前后直接 return，不设置任何错误。返回 A 时只能读数据库旧配置；当前视图错误按钮又调用数据 reload，而非重试原配置写入。
- **影响**：用户已确认的显隐、顺序、宽度、冻结、行高和管线无提示丢失。
- **判定**：已确认，置信度 100%。
- **证据**：`StorageWorkspace.tsx:157-187,252-256`；`storageGridLayout.ts:25-28`；`Product-Spec.md:60,71`。
- **初步修复预测**：按 viewId 建模 draft/confirmed/pending/error/retry；切换只改变显示，不删除失败任务；重试原 payload。
- **修复风险**：高；需处理连续版本、旧响应晚到和跨项目清理。
- **必跑回归**：A/B 快切、连续失败、旧失败晚于新成功、关开项目、重启、配置精确 round-trip。

### SHELL-H-10 · 临时 UI 状态跨表/项目并可提交到错误上下文

- **范围**：TableList、ViewTabBar、项目/表/视图切换。
- **复现**：在表 A 打开新建视图并输入名称，切到表 B 后提交；或在项目 A 打开表重命名/菜单/确认，再切项目 B。
- **期望**：上下文身份改变时，旧草稿、菜单、确认、拖拽和错误被取消，或仍绑定原目标并明确提示。
- **实际**：`ViewTabBar` 的 creating/newName/menu/edit/delete/drag 不响应 `tableId`；`TableList` 的同类 state 不响应 projectId，组件也未按上下文 key remount。新 props 的 callback 会把旧草稿提交到新 activeTable/project。
- **影响**：用户可在错误表或项目创建/修改对象，属于目标归属错误。
- **判定**：React identity/closure 路径确认，置信度 98%。
- **证据**：`ViewTabBar.tsx:17-31,33-83`；`TableList.tsx:21-45`；`MorfraShell.tsx:22-36,224-229`；`StorageWorkspace.tsx:241-244`。
- **初步修复预测**：所有瞬时状态显式归属 `{projectInstanceKey,tableId,viewId}`；identity 变更统一 cancel/reset；pending action 捕获目标 ID 并验证。
- **修复风险**：中高；需避免误清同一上下文的合法失败草稿。
- **必跑回归**：表/视图/项目切换中覆盖 create/rename/menu/delete/drag/error，确认无错误目标写入且焦点可恢复。

### SHELL-H-11 · 视图操作菜单位于确定的滚动裁切链

- **范围**：视图栏重命名、复制、删除入口。
- **复现**：点击任一视图标签右侧操作按钮，尤其在多视图横向滚动时。
- **期望**：菜单浮在视图栏上方，边界避让，不被标签滚动容器裁切。
- **实际**：菜单是 `.morfra-view-tabs-scroll` 后代；该祖先 `overflow-x:auto`，跨轴计算产生裁切；菜单 `top:34px` 向 42px 标签轨道外延伸。表菜单已用 Portal，视图菜单没有。
- **影响**：重命名、复制和删除的唯一入口可能只剩一小截或完全不可操作。
- **判定**：DOM/CSS 几何确认，置信度 98%；真实像素截图因权限关闭而 BLOCKED。
- **证据**：`ViewTabBar.tsx:63-73`；`04-workspace.css:35-54,134-147`；现有测试只断言节点存在。
- **初步修复预测**：复用表菜单的 Portal/fixed 定位、翻转、外点/Esc 与焦点恢复。
- **修复风险**：中；需跟随横向滚动和窗口 resize。
- **必跑回归**：首/中/末标签、50 视图、横向滚动、960/1199/1200、键盘、边界翻转。

### SHELL-H-12 · 外观模式与主题运行时形成两套 Token 真相

- **范围**：顶栏、主工作区、详情/AI 宿主边界、浅深模式。
- **复现**：加载默认 themeStore 后选择 dark；检查嵌入的 `.theme-module-board` 继承链。
- **期望**：一个外观解析器为 Shell 和全部模块生成一致的浅/深 Token。
- **实际**：`appearanceMode` 只切 `data-appearance` 下的 `--morfra-*`；themeStore 同时把默认浅色展开为固定 `--semantic-*`/`--module-*`。`.morfra-shell` 先把 module-scope 指向 Morfra，但嵌套 `.theme-module-board/detail/settings/...` 又把它覆盖回静态 module/semantic 值。
- **影响**：深色时外壳可变深，数据面、设置或详情仍偏浅；用户自定义主题与固定冷蓝规则也无唯一优先级。
- **判定**：CSS 继承与运行时写入链确认，置信度 99%；实际对比度仍因无屏幕证据 BLOCKED。
- **证据**：`App.tsx:8-19`；`themeStore.ts:63-95`；`themeDefaults.ts:4-47`；`MorfraShell.tsx:158-168`；`01-foundation.css:100-117`；`tokens/foundation.css:1-60,98-115`；`tokens/morfra.css:2-77`；`StorageWorkspace.tsx:262`。
- **初步修复预测**：保留单一主题解析器，浅/深输出全部 semantic/module/morfra alias；若保留用户定制，必须定义每种 appearance 的成对映射。
- **修复风险**：高；可能影响所有历史组件和用户 theme.json。
- **必跑回归**：system/light/dark × 默认/自定义 × shell/board/detail/AI/settings/menu，系统热切换、重启、降低透明度。

## 7. MEDIUM / LOW 问题详证

### SHELL-M-01 · 窄窗双开时渲染合并 Tabs，而非仅活动抽屉

- **范围**：960～1199px 右栏宿主边界。
- **复现**：窄窗先打开详情，再打开 AI，使两个持久开关均为 true。
- **期望**：只显示活动详情或 AI 抽屉；另一模块保留状态但不渲染合并栏。
- **实际**：布局返回 `drawer`，`RightPanelHost` 发现并非“仅 AI/仅详情”后渲染 `MergedPanel`，出现详情/AI Tabs。
- **影响**：仍只有一个覆盖层，未形成并排双抽屉；但呈现形态违反 EXP-006/007，关闭语义也依赖活动 Tab。
- **判定**：已确认，置信度 100%。
- **证据**：`windowLayout.ts:63-74`；`RightPanelHost.tsx:68-71`；`Product-Spec.md:50-51`。
- **初步修复预测**：drawer 始终依据 `activePanel` 只渲染一个 Panel，遮罩只关闭活动抽屉。
- **修复风险**：中；需保留变宽后双开状态。
- **必跑回归**：详情→AI、AI→详情、遮罩/Esc、导航浮层互斥、重新变宽恢复。

### SHELL-M-02 · 打开失败前已经创建目录并执行迁移

- **范围**：项目打开、身份/结构校验、迁移副作用。
- **复现**：组合 A 的 manifest 与 B 的旧数据库，或提供结构损坏的旧数据库后打开。
- **期望**：只读预检不通过时原项目目录字节级不变；通过后才备份和迁移。
- **实际**：`open_project` 先 `initialize_directories`，再 `open_connection→apply_pending_migrations`，随后才校验 manifest/DB identity 和结构。
- **影响**：最终虽然报打开失败，数据库可能已升级，目录与迁移备份已产生。
- **判定**：已确认，置信度 100%。
- **证据**：`connection.rs:146-165`。
- **初步修复预测**：先只读 manifest/DB identity 和基础完整性预检，再备份、迁移和升级后校验。
- **修复风险**：高；旧版本 schema 可能需要最小兼容读取。
- **必跑回归**：身份不一致、缺表、损坏 DB、迁移/备份失败、原目录哈希对比。

### SHELL-M-03 · 重复提交和异步乱序保护不完整

- **范围**：项目创建、视图创建、表/视图重命名、Emoji 选择。
- **复现**：快速双击或 Enter+blur；保存中再次点击 Emoji；连续提交视图创建。
- **期望**：每次用户意图只发一个请求，pending 时控件禁用；旧响应不能覆盖新结果。
- **实际**：项目创建和 ViewTabBar 无提交锁；重命名可由 Enter 与 blur 同时调用；Emoji pending 时可继续选择。只有新建表实现 ref 级防重。
- **影响**：产生多个项目/视图、重复错误、最近记录 read-modify-write 丢项或旧响应覆盖新状态。
- **判定**：静态确认，置信度 95%。
- **证据**：`ProjectSwitcher.tsx:43-55,91-94`；`ViewTabBar.tsx:33-48,78-83`；`TableList.tsx:99-120`；对照新建表 `TableList.tsx:62-79`。
- **初步修复预测**：统一 single-flight 状态机、禁用控件、幂等 operationId 和 generation 检查。
- **修复风险**：中；必须允许失败后明确重试。
- **必跑回归**：双击、Enter+blur、快速多选、失败重试、响应乱序。

### SHELL-M-04 · 文件菜单项目操作绕过统一状态与错误处理

- **范围**：macOS“文件→新建/打开项目”。
- **复现**：由文件菜单创建或打开，令项目创建、目录选择或打开失败。
- **期望**：复用同一个项目流程，提供模板、pending、关联错误、重试和取消。
- **实际**：新建使用 `window.prompt` 并 `void createProject`；打开的 Promise 链无 catch；监听注册失败也被吞掉。错误不会进入标题栏项目菜单的状态。
- **影响**：菜单入口与可见入口行为不一致，失败可变成未处理 Promise，用户没有恢复路径。
- **判定**：已确认，置信度 95%。
- **证据**：`MorfraShell.tsx:101-128`；`ProjectSwitcher.tsx:24-66`。
- **初步修复预测**：文件菜单只派发统一 action，打开同一项目流程 UI；错误写入持久、可重试的生命周期状态。
- **修复风险**：中；需处理 Tauri 事件 listener 生命周期。
- **必跑回归**：创建/打开成功、取消、对话框失败、项目损坏、组件卸载、重复菜单事件。

### SHELL-M-05 · 项目菜单缺少完整键盘与焦点合同

- **范围**：标题栏项目切换器、最近项目操作。
- **复现**：仅用键盘打开菜单、浏览最近项目、重命名/移除、Esc 或点击外部关闭。
- **期望**：首项焦点、方向键/Home/End、Esc/外点、关闭后焦点恢复；所有行操作在 focus 时可发现。
- **实际**：菜单无上述状态机；`role=menu` 内混入普通 form/input；重命名/移除按钮仅 `group-hover:inline`，没有 focus-within 等价。
- **影响**：键盘用户难以发现和完成项目生命周期操作。
- **判定**：已确认，置信度 100%。
- **证据**：`ProjectSwitcher.tsx:78-97`；`Product-Spec.md:59-60`。
- **初步修复预测**：使用统一菜单 primitive、roving focus 与可见 focus 操作，表单区域与 menu 语义分离。
- **修复风险**：中；要兼容内联重命名和错误提示。
- **必跑回归**：Tab、方向键、Home/End、Esc、外点、重命名后返回、屏幕阅读器语义（后者需视觉权限另验）。

### SHELL-M-06 · 共用删除确认框没有 dialog 与并发确认合同

- **范围**：表删除、视图删除及复用 `ConfirmDialog` 的危险操作。
- **复现**：键盘打开删除确认，检查初始焦点、Esc、Tab 圈定、重复确认和关闭后返回。
- **期望**：具名模态 dialog、初始安全焦点、焦点圈定、Esc、pending 锁和触发器恢复。
- **实际**：只是全屏 div；无 `role=dialog`、`aria-modal`、标题关系、focus trap、Esc 或 pending；确认按钮可连续点击。
- **影响**：键盘/辅助技术流程不可靠，重复删除请求也可能并发。
- **判定**：已确认，置信度 100%。
- **证据**：`ConfirmDialog.tsx:12-37`；调用点 `TableList.tsx:165`、`ViewTabBar.tsx:83`。
- **初步修复预测**：统一危险确认 primitive，内建 focus/pending/restore，不让调用方各自补丁。
- **修复风险**：中；需避免破坏内层选项影响确认。
- **必跑回归**：取消、Esc、确认、保存中、双击、失败保留、焦点返回。

### SHELL-M-07 · 表/视图排序没有拖拽反馈和键盘等价

- **范围**：侧栏表排序、视图栏排序。
- **复现**：拖动表或视图，或仅用键盘尝试调整顺序。
- **期望**：来源、代理、有效插入位置、禁止落点持续可见；键盘可完成同等排序并获知位置。
- **实际**：只有 HTML `draggable` 与一个 `draggedId`；无 overlay、插入线、禁止态、live region 或键盘命令。
- **影响**：V3-DB-008/009 与 EXP-014/015 不成立，键盘用户无法排序。
- **判定**：已确认，置信度 100%。
- **证据**：`TableList.tsx:27,134-145,156`；`ViewTabBar.tsx:26,50-61,66`。
- **初步修复预测**：建立共享 accessible sortable primitive，保存失败回滚并恢复焦点。
- **修复风险**：中；原生 DnD 与触摸/键盘差异较大。
- **必跑回归**：鼠标、键盘、首末边界、非法落点、减少动态、失败回滚、磁盘重开。

### SHELL-M-08 · 视图生命周期失败被父层吞掉并当成成功

- **范围**：视图创建、重命名、复制、删除、排序。
- **复现**：令任一 callback 抛错。
- **期望**：当前控件保留名称/确认态，就近显示错误并允许重试。
- **实际**：`StorageWorkspace.run()` catch 后只写全局 error，不重新抛出或返回失败；`ViewTabBar` 的 await 因此 resolve，继续清空创建/重命名；删除用 `.finally` 总会关闭确认。
- **影响**：失败草稿丢失，用户无法从原操作位置重试，并可能误认成功。
- **判定**：已确认，置信度 100%。
- **证据**：`StorageWorkspace.tsx:202-209,243`；`ViewTabBar.tsx:33-48,68-83`。
- **初步修复预测**：action 返回结构化 success/error 或重抛；每个生命周期控件拥有 pending/error/draft。
- **修复风险**：中；需与 H-09 的视图配置保存模型分开但共享错误语义。
- **必跑回归**：五种操作逐一失败、取消、重试、跨视图/表、重复点击。

### SHELL-M-09 · 同一视图只能可靠复制一次

- **范围**：VIEW-004 复制视图。
- **复现**：对同一视图连续执行两次“复制视图”。
- **期望**：每次创建独立配置且名称唯一，例如“副本 2”。
- **实际**：UI 永远提交 `${view.name} 副本`；Rust 强制同表视图名唯一，第二次确定失败；M-08 又会立即关闭菜单而不保留失败上下文。
- **影响**：复制能力退化为一次性路径。
- **判定**：已确认，置信度 100%。
- **证据**：`ViewTabBar.tsx:68-71`；`src-tauri/src/storage/lifecycle_views.rs:177-207`。
- **初步修复预测**：由后端事务内生成唯一后缀，返回最终名称，避免并发竞争。
- **修复风险**：低至中；需定义已有手工同名后缀处理。
- **必跑回归**：连续/并发复制、已有“副本 2”、配置隔离、磁盘重开。

### SHELL-M-10 · 20 个最近项目会把最小窗口底部入口挤出

- **范围**：项目菜单、960×640。
- **复现**：最近项目达到上限 20 个，在最小窗口打开项目菜单。
- **期望**：最近列表内部滚动，新建/打开入口固定可达，菜单边界避让。
- **实际**：数据保留 20 项；菜单没有 `max-height`/内部滚动，Shell 根 `overflow:hidden`，底部新建和打开入口可超出 640px 高度并被裁切。
- **影响**：部分最近项目和两个主要入口不可达；文件菜单仍是替代路径，因此定为 MEDIUM。
- **判定**：CSS/DOM 几何确认，置信度 95%。
- **证据**：`recentProjects.ts:5,28-31`；`ProjectSwitcher.tsx:83-96`；`01-foundation.css:118-126`。
- **初步修复预测**：菜单限制到可视区域，最近列表单独滚动，底部 actions 固定；支持翻转。
- **修复风险**：低。
- **必跑回归**：0/1/20 项、长名、640px 高、键盘到末项、翻转、错误提示。

### SHELL-M-11 · 紧凑侧栏完整表名只依赖原生 `title`

- **范围**：48px 收起态和窄窗图标栏。
- **复现**：用键盘聚焦表 Emoji，或 hover 观察完整名称提示合同。
- **期望**：hover/focus 都显示应用内 Tooltip，支持长名/同名且不裁切。
- **实际**：按钮只有 native `title` 和 `aria-label`；没有可控制、可定位、可测试的可见 Tooltip。
- **影响**：屏幕阅读器名称存在，但键盘视力用户不一定获得可见完整名称。
- **判定**：已确认，置信度 100%；真实 native tooltip 行为不作为通过证据。
- **证据**：`TableList.tsx:153-157`；`Product-Spec.md:33-34`。
- **初步修复预测**：使用共享 hover/focus Tooltip Portal，保留 accessible name。
- **修复风险**：低至中；需避免与窄窗导航浮层冲突。
- **必跑回归**：长名、同名、hover、Tab、Esc、边界避让、减少动态。

### SHELL-M-12 · 布局和外观偏好在首帧后才 hydrate

- **范围**：再次启动、侧栏/AI/宽度/外观偏好恢复。
- **复现**：保存非默认 sidebarWidth、sidebarOpen、aiOpen、appearanceMode 后重载。
- **期望**：首个可见 frame 就使用持久偏好，或先显示稳定骨架而非默认完整 Shell。
- **实际**：Zustand 初值是默认偏好；`MorfraShell` 先据此渲染，`useEffect` 后才 `hydrate()` 并应用外观。
- **影响**：启动时可能出现侧栏/AI/轨道跳变和浅色闪烁，违反稳定外壳要求。
- **判定**：React effect 时序确认，置信度 95%；真实闪烁幅度因屏幕权限关闭为 BLOCKED。
- **证据**：`layoutStore.ts:45-54,114-132`；`MorfraShell.tsx:45-79,158-170,219-230`。
- **初步修复预测**：渲染前同步读取安全本地偏好，或在 `hydrated` 前只渲染几何稳定 Shell；外观 attribute 尽可能在启动脚本预置。
- **修复风险**：中；SSR/JSDOM 与损坏偏好降级要一致。
- **必跑回归**：每个偏好、损坏 JSON、system theme、冷/热启动、960/1200/fullscreen。

### SHELL-L-01 · 定向测试对关键 SHELL 路径形成假绿

- **范围**：测试完整性与回归门禁。
- **复现**：运行 §10 的 9 个定向套件，全部 52 个测试通过；逐项对照 H-01～H-12，关键组合均无用例。
- **期望**：确定性跨项目、断点、错误、Undo、裁切和主题链至少有失败测试。
- **实际**：没有延迟 IPC、同 manifest ID 双路径、1199→1200、1200+活动 AI、双开窄窗、连续 Undo、跨表草稿、真实裁切或 appearance/theme 联动；绿灯不能发现上述缺陷。
- **影响**：修复和后续回归缺少可信门禁。
- **判定**：已确认，置信度 100%。
- **证据**：定向 `52/52` 与 §11 测试缺口逐项对照。
- **初步修复预测**：修复前先补最小失败测试；纯函数/组件/IPC/Rust 故障注入分层，视觉专属项保持手工阻塞。
- **修复风险**：低；主要风险是写实现镜像测试而非行为测试。
- **必跑回归**：新增测试自身红→绿证据，全量门禁，避免只提高覆盖率数字。

## 8. 通过项与正向证据

本节只记录本轮确实建立了证据的能力，不用局部通过抵消 §6～§7 的失败。

| 区域 | 已证明的正向能力 | 证据 |
|---|---|---|
| 启动与项目生命周期 | 项目、表、视图使用稳定 ID；表/视图数据按 SQLite 事务持久化；项目可创建、切换、重命名、删除；项目包移动后附件可重开；备份保留、恢复和损坏备份保护已有 Rust 测试。 | `projectStore.test.ts:98-205`；`src-tauri/src/storage/backup.rs:322-395`；`src-tauri/src/storage/attachments.rs:584-642` |
| 顶栏与窗口 | Tauri 最小窗口为 960×640；标题栏存在 macOS 拖拽区、项目入口、文件/设置菜单和 AI 开关；宽屏 detail/AI 双栏与 narrow/merged 三种布局分支均有实现。 | `src-tauri/tauri.conf.json`；`MorfraShell.tsx:158-230`；`windowLayout.ts:1-115` |
| 左侧边栏 | 展开/紧凑两档、单层表列表、当前表选中、滚动、新建表末尾输入、Emoji 选择、最后一表删除保护均有实现或直接测试。 | `TableList.tsx:21-171`；`TableList.test.tsx`；`TableEmojiPicker.test.tsx`；Rust lifecycle tests |
| 视图栏 | 同表视图共享记录；视图 CRUD、选择、排序入口、最后视图保护、50 项标签数据与活动项滚入视区有实现或直接测试；视图配置可写 SQLite。 | `ViewTabBar.tsx:17-89`；`ViewTabBar.test.tsx`；`lifecycle_views.rs:1-207`；`lifecycle_configs.rs:13-75` |
| 构建与存储 | TypeScript、生产构建、Rust `cargo check` 均通过；Rust storage 52 项测试全绿。 | §10 的原始命令和结果 |

## 9. 与既有总账问题的关系及文档冲突

### 9.1 已有 FT 问题引用，不重复登记

| 既有 ID | 本轮关系 | 处理 |
|---|---|---|
| `FT-H-09` | SHELL-H-08 的“表删除 Undo”进一步受其不完整表域备份影响。 | 保留 FT 原问题；SHELL 只登记 UI 栈深度和动作覆盖。 |
| `FT-H-07` | 全量前端测试仍能复现筛选输入时序失败。 | 不重复登记；作为当前全量门禁红。 |
| `FT-M-11` | SHELL-H-09 讨论保存失败与草稿；非法 view config 入库仍由 FT-M-11 跟踪。 | 分开保留：一个是失败状态机，一个是后端校验。 |
| `FT-M-09` | theme audit 仍因固定 `bg-white` 失败；SHELL-H-12 是更上层的主题双真相。 | 两项根因层级不同，不合并。 |
| `FT-L-01` | 全量测试仍有 `fieldOrder` 预期漂移。 | 不重复登记；作为当前门禁红。 |
| `FT-L-03` | 本轮生产构建继续出现主包大于 500kB 告警。 | 不重复登记；保留原包体问题。 |

### 9.2 待决策的文档冲突

以下是规划前必须显式处理的事实冲突，不计入 25 个实现问题，也不替用户做产品决策。

| 决策 ID | 状态 | 冲突 | 影响 |
|---|---|---|---|
| `DC-05` | `待决策` | `IA-007` 与 Phase 45 明确要求表生命周期不显示常驻或临时撤销按钮、只用 `Command + Z`；`EXP-016` 和 `Design-Brief.md:99` 又要求删除、批量修改等操作显示带“撤销”的轻量 Toast。 | SHELL-H-08 的可发现性和未来 Undo 反馈形态。 |
| `DC-06` | `待决策` | `PROJECT-CONTEXT.md:13,16,108` 声明全部 Phase 已完成、可发布/维护；`Product-Spec.md:3` 与 `DEV-PLAN.md:5,16,27,626` 表明 Phase 45 仍进行中，Phase 46 状态也已变化。 | 新会话路由、审查基线及 dev-planner 起点。 |
| `DC-07` | `待决策` | `DEV-PLAN.md:596-621` 把 Phase 44 的全量测试、可访问性和窗口矩阵记为已通过；当前同一工作区全量前端测试为红，并确认多项 HIGH 无覆盖。 | 需要明确这是历史时间点结论，还是应同步为当前门禁状态；不得直接抹除历史证据。 |

## 10. 测试、编译与构建结果

所有命令均在 `reqflow/` 执行；未安装依赖、未写源码。Rust target 指向 `/private/tmp`，不污染仓库。

| 门禁 | 命令 | 结果 | 结论 |
|---|---|---|---|
| SHELL 定向前端 | `pnpm exec vitest run src/App.test.tsx src/components/layout/MorfraShell.test.tsx src/components/sidebar/TableList.test.tsx src/components/sidebar/TableEmojiPicker.test.tsx src/components/workspace/ViewTabBar.test.tsx src/stores/layoutStore.test.ts src/lib/layout/windowLayout.test.ts src/stores/projectStore.test.ts src/lib/ipc/storageClient.test.ts` | **9 files / 52 tests 全部通过** | 基础主路径有门禁，但 SHELL-L-01 证明关键组合未覆盖。 |
| 全量前端 | `pnpm test` | **136 files：133 pass / 3 fail；1009 tests：1006 pass / 3 fail** | 门禁失败；失败均已有 FT ID，不另登记。 |
| 全量失败 1 | 同上 | `themeAudit.test.ts`：`FieldEditPage.tsx:16` 固定 `bg-white` | `FT-M-09` |
| 全量失败 2 | 同上 | `StorageWorkspace.test.tsx`：期望对象未同步新增 `fieldOrder` | `FT-L-01` |
| 全量失败 3 | 同上 | `ViewTools.test.tsx`：期望“筛选，1项”，中文输入时序未稳定保存 | `FT-H-07` |
| TypeScript | `pnpm exec tsc --noEmit` | **通过** | 编译合同通过。 |
| 生产构建 | `pnpm build` | **通过**；253 modules；主 JS 约 2,319.00kB，gzip 约 534.29kB；大包告警 | 构建可产出；包体问题沿用 `FT-L-03`。 |
| Rust storage | `CARGO_TARGET_DIR=/private/tmp/morfra-shell-audit-cargo-target cargo test storage:: --lib --locked -- --nocapture` | **52 passed / 0 failed / 20 filtered**；10k×200 候选查询约 1ms | 存储已有测试通过；不覆盖 SHELL-H-01/H-07 等命令边界。 |
| Rust 编译 | `CARGO_TARGET_DIR=/private/tmp/morfra-shell-audit-cargo-target cargo check --lib` | **通过** | Rust library 编译通过。 |

全量前端失败不是本轮引入；开始基线已有对应源码/测试改动。本轮没有通过改测试或跳过失败制造绿灯。

## 11. 覆盖缺口与 BLOCKED 项

### 11.1 必须补的自动测试

1. 项目 A/B 快切时延迟 IPC 成功与失败乱序；同 manifest ID 双路径实例隔离。
2. 最近项目 JSON 截断、路径缺失、manifest/SQLite 损坏、重新定位与恢复入口。
3. 所有非删除 lifecycle 的 commit 前/后 snapshot、mutex 与 Undo 故障注入。
4. 连续 2/50/51 次表生命周期 Undo；重命名、Emoji、排序入栈；项目切换清栈。
5. 1199↔1200 导航浮层状态迁移；1200px 活动 detail/AI 每种组合主区不小于 560px；窄窗双开仅显示活动抽屉。
6. 视图 A/B 快切保存失败、旧响应晚到、重试原 payload；表/项目切换时草稿归属。
7. 视图菜单 Portal/边界定位、连续复制唯一名、生命周期失败保留草稿与确认态。
8. 项目菜单、确认框和表/视图排序的键盘、焦点、ARIA、重复提交与错误恢复。
9. `system/light/dark × 默认/自定义主题 × shell/board/detail/settings` 的 Token 联动。

### 11.2 因关闭屏幕读取而保持 BLOCKED

- 真实 macOS 窗口在 960×640、1199、1200、常规宽屏、全屏与恢复过程中的像素连续性。
- 浅色/深色/跟随系统的真实颜色、对比度、材质、闪烁与降低透明度表现。
- 长项目名/表名/50 视图的实际截断、菜单翻转、滚动裁切和原生 `title` 行为。
- 鼠标拖拽代理、插入线、禁止态、减少动态，以及系统辅助技术的真实播报。
- 首屏字体、层级、留白和“专业工具感”等主观视觉验收。

这些 BLOCKED 不妨碍确定性代码/CSS/控制流问题判为 FAIL；也不会被自动测试通过替代。

## 12. 根因归并与后续规划输入

以下仅是修复赛程的输入，不是获批开发计划，不修改 `DEV-PLAN.md`。

| 根因组 | 涵盖问题 | 根因摘要 | 建议批次 |
|---|---|---|---|
| `RG-08` 项目身份/会话 | SHELL-H-01、H-02 | 项目身份只看 manifest ID，异步请求、缓存和后端 active project 没有实例/generation 边界。 | `S0` |
| `RG-09` 启动/恢复 | SHELL-H-03、H-04、M-04、M-10 | 启动、创建、打开、最近项目和错误恢复分成多套入口与状态。 | `S1` |
| `RG-10` 右栏响应式几何 | SHELL-H-05、H-06、M-01、M-12 | 持久偏好、瞬时 overlay、活动面板和断点状态未在一个转换模型中。 | `S2` |
| `RG-11` 生命周期/草稿/Undo | SHELL-H-08、H-09、H-10、M-03、M-08、M-09 | action 没有统一的目标身份、pending/error/result、草稿所有权和 authoritative Undo depth。 | `S3` |
| `RG-12` 导航可访问性/浮层 | SHELL-H-11、M-05、M-06、M-07、M-11 | 菜单、dialog、sortable、Tooltip 未复用有完整键盘和 Portal 合同的 primitive。 | `S4` |
| `RG-13` 主题权威 | SHELL-H-12 | appearance 与 themeStore 同时写不同 Token 层，没有单一解析器。 | `S2` |
| `RG-14` 事务/打开边界 | SHELL-H-07、M-02 | 文件系统准备、数据库提交、快照和 Undo 不在一个可确认/可补偿边界。 | `S0` |
| `RG-15` 质量覆盖 | SHELL-L-01 | 定向绿灯覆盖成功主路径，却未覆盖已知高风险状态组合。 | `S5` |

建议依赖顺序：

1. `S0` 先处理错误项目写入和“报错但已提交”的数据安全边界。
2. `S1` 统一项目创建/打开/恢复入口；`S2` 可在状态合同冻结后并行处理窗口和主题。
3. `S3` 统一生命周期 action、草稿与 Undo；它依赖 `S0` 的项目实例和命令确认语义。
4. `S4` 抽取共享可访问交互 primitive，并让所有失败状态消费 `S3` 的 action 结果。
5. `S5` 不是最后才写测试：每个修复先补对应失败测试，最后再恢复全量门禁和屏幕验收。
6. DC-05～DC-07 先由产品事实源裁决；其中 DC-05 只阻塞 Undo 的可见反馈形态，不应阻塞数据安全修复。

## 13. 机械校验与工作区完整性

机械计数和 Git 对账已经执行：

- 本报告问题标题 **25 个且唯一**：HIGH 12 / MEDIUM 12 / LOW 1；序列 `SHELL-H-01～12`、`SHELL-M-01～12`、`SHELL-L-01` 无缺号、无额外 ID。
- 需求追踪 **52 项**：PASS 14 / FAIL 28 / BLOCKED 10；原子矩阵 **84 个区域单元**：PASS 37 / FAIL 34 / BLOCKED 8 / N/A 5。
- 总账问题标题 **50 个且唯一**：HIGH 21 / MEDIUM 25 / LOW 4；状态为待处理 49 / 待决策 1。
- 总账 25 个 SHELL 条目均包含固定 16 个字段；RG-08～15 分布为 2/4/4/6/5/1/2/1，S0～S5 分布为 4/5/5/5/5/1。
- 两份文档内相对 Markdown 报告链接缺失目标 **0**；tracked diff 与两份 untracked 审查文档的独立 whitespace check 均通过。
- 结束分支仍为 `main`，HEAD 仍为 `afd755d2cdd3c1e071c14afde65e5cdda9c01055`。
- 开始时已有的 19 个非总账 dirty/untracked 文件 SHA-256 全部不变；原字段/表格报告 SHA-256 仍为 `7f7c902b…8abed088`，010 迁移仍为 `6f21824f…44c920`。
- 本轮唯一持久化变化是新增本报告，以及将既有 `AUDIT-REGISTER.md` 从 SHA-256 `cde2c2b8…b9babb` 更新为 `eb0f0f61…ff8103c`。
- 未修改代码、测试、Spec、Design Brief、DEV-PLAN、PROJECT-CONTEXT 或迁移；未提交、未推送、未启用屏幕读取。
