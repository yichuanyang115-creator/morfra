# Morfra v3 字段与表格全量只读自检

> 文档性质：**审查证据，不是产品事实或开发计划**。
>
> 本文件只记录检查结论、复现证据与初步修复预测；本轮未修复产品代码、测试、需求、设计、开发计划或数据库迁移。

## 0. 结论先行

- 审查日期：2026-08-20（Asia/Shanghai）
- 审查对象：当前工作区实际代码，包含开始时已经存在的未提交改动
- 基线分支 / HEAD：`main` / `afd755d2cdd3c1e071c14afde65e5cdda9c01055`
- Stage 1：**FAIL**。主标题、13 种 P0 字段、8 项工具、三档行高及稳健性矩阵均已走完，没有因发现 HIGH 提前停止。
- Stage 2：**跳过**。Stage 1 已发现 HIGH，按 `code-review` 门禁不得把 Stage 2 伪装为完成。
- 屏幕读取：三档行高的 1280×720 客观 DOM/坐标/命中证据在用户要求关闭屏幕读取前已采集；收到要求后已关闭验收页、恢复视口、停止 Vite 服务，此后没有再调用屏幕、截图或视觉工具。960–1199px、真实全屏和深色实机项因此标为“阻塞”，不写成通过。
- 总体矩阵（按 38 个总体行、失败优先于阻塞判定）：**通过 1 / 失败 28 / 阻塞 9 / 不适用 0**。
- 原子矩阵（字段 182 + 工具 48 + 行高几何 24 + 字段×行高 84 + 稳健性 13，共 351 个检查点）：**通过 135 / 失败 120 / 阻塞 69 / 不适用 27**。
- 问题汇总：**HIGH 9 / MEDIUM 13 / LOW 3**。
- 最危险结论不是视觉：当前 Undo 的记录/字段恢复模型会丢附件元数据，正常关闭项目后还可能清理物理文件，属于实际数据丢失路径。

符号：`P` 通过，`F` 失败，`B` 阻塞或证据不足，`N/A` 按当前需求不适用。单元格中的通过可以是代码、自动测试或客观运行证据；仅凭“代码看起来存在”而无足够闭环时标为阻塞。

## 1. 范围、依据与方法

### 1.1 当前依据

按项目上下文契约读取了：

- `AGENTS.md`
- `PROJECT-CONTEXT.md`
- `Product-Spec.md`：重点为 EXP-004～017、DATA-001～008、FIELD-001～020、TABLE-001～031、DETAIL-001
- `Design-Brief.md`：重点为字段管理、表头、三档密度、工具浮层、主题与空/错/加载状态
- `DEV-PLAN.md`：重点为 Phase 36～39、统一验证门禁及“字段表头重命名与空名称兼容修正”
- 当前 `reqflow/` 前端、Rust 存储、迁移、测试及性能脚本

没有读取 `docs/archive/` 或 `docs/future/` 来猜测当前需求。

### 1.2 检查方法

1. 建立主标题 + 13 类型字段生命周期矩阵。
2. 逐项检查搜索、筛选、排序、分组、条件填色、行高、字段管理、新建记录。
3. 用隔离临时数据渲染真实 `DataGrid`、真实 CSS 和真实 TanStack virtualizer；测试 64 条记录、主标题 + 13 类型字段、空值和长值。
4. 在屏幕读取关闭前采集 DOM、computed style、元素边界、虚拟偏移和 `elementFromPoint` 命中结果；关闭后仅继续代码、测试和日志检查。
5. 执行前端全量/定向测试、TypeScript、Vite 生产构建、Rust 存储测试、Rust 编译及性能门禁。
6. 独立派发 `code-reviewer` 完成 Stage 1；存储与前端证据由两个只读审查 Agent 交叉核对。

### 1.3 当前需求追踪

此表用于证明相关 Spec/Design 条目没有被静默跳过；状态是对该组**最差项**的汇总，详细证据和问题 ID 在后续章节。未列出的品牌、看板、详情和 AI 条目不属于本 Goal 的字段/表格/工具栏范围。

| 当前依据 | 状态 | 追踪结论 |
|---|---|---|
| FIELD-001 | `F` | 唯一主标题/固定第一列主体存在；空名失败 H-03 |
| FIELD-002～008 | `F` | 13 类型矩阵见 §2；显示/配置/附件问题 H-04、M-01～06；FIELD-005 的选项键盘排序见 M-13 |
| FIELD-009～013 | `F` | 转换/删除/50 深度实现与部分测试存在；RestoreField/Record 附件丢失 H-05，关闭会话边界无端到端测试 |
| FIELD-014～016 | `B` | 无字段分组 UI、扁平字段顺序与迁移代码存在；本 Goal 未做旧字段组磁盘迁移的完整独立验收，故不判通过 |
| FIELD-017～019 | `F` | 选项删除确认、影响决策及原子 Undo 合同被 H-08 破坏 |
| FIELD-020 | `F` | 类型先行流程存在；3 系统类型缺入口 H-06，空名 H-03 |
| VIEW-001～004 | `B` | 共享数据与配置复制代码存在；完整创建/复制/删除/切换/关闭重开未做本轮实机闭环 |
| TABLE-001～005 | `F` | 先选后编辑和主要键盘合同有组件测试；图片/文件专属编辑失败 H-04 |
| TABLE-006～009 | `F` | 区域选择/复制粘贴/右键代码与测试存在；attachment 清空及 Undo 原子性被 H-04/H-05 破坏 |
| TABLE-010～015 | `B` | 单级分组、投影、组序与组内排序测试存在；折叠/配置磁盘重启未闭环 |
| TABLE-016～023 | `F` | 8 工具矩阵见 §3；H-01/H-07、M-06/07/12 等 |
| TABLE-024 | `F` | 280px 补充、非模态草稿主体存在；空名、选项确认/键盘排序失败 H-03/H-08/M-13 |
| TABLE-025～031 | `F` | 表头/末尾列/列宽/冻结代码存在；坐标冲突与三档行高 H-01/H-02，空名 H-03 |
| DATA-001～003 | `B` | SQLite 本地项目、附件目录与当前迁移链存在；但本 Goal 没有对整组项目复制/移动/升级合同做独立完整验收 |
| DATA-004～005 | `B` | 10k/200 单测存在；正式 release benchmark 已崩溃，无法证明 P95，见 M-10 |
| DATA-006～008 | `F` | 附件/备份基础测试存在；双源清空与 Undo 数据丢失 H-04/H-05/H-09 |
| EXP-004～008 | `B` | 1280 常规窗口有客观数值；960、全屏被屏幕权限关闭阻塞，标准档仍有 H-02 |
| EXP-009～017 | `F` | 深色门禁、状态空态、三档密度与焦点/命中存在 M-08/M-09、H-01/H-02；减少动态效果实机为 `B` |
| Design Brief：字段管理、工具浮层、主题、密度、状态 | `F` | 结构主体存在；结论分别落在 §2～§5 和 H/M 问题表；无法客观证明的审美项未判通过 |

## 2. 主标题 + 13 种字段原子矩阵

下表把 Goal 要求的合并项拆开。`视图` 指同一会话切换视图后的值与编辑合同；`重启` 只认磁盘项目关闭/重开，不把 React 重挂载或同连接 reload 当成重启。当前没有“14 类一次性写入/修改/清空 → 切视图 → 关项目 → 重开逐项比对”的直接测试，因此两列不冒充通过。三档行高的交叉结果另见 4.3。

| 字段 | 创建 | 图标/名 | 改名 | 空值 | 正常显示 | 录入 | 修改 | 取消 | 清空 | 专属配置 | 键盘/只读 | 视图 | 重启 | 总体 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 主标题 | `N/A` 自动 | `P` E-F1 | `F` 空名 | `P` | `P` | `P` | `P` | `P` | `P` | `F` 多行显示 | `P` 固定但可编辑 | `B` | `B` | **失败** |
| 文本 | `P` | `P` E-F1 | `F` 空名 | `P` | `F` 多行 | `P` | `P` | `P` | `P` | `F` 显示未生效 | `P` | `B` | `B` | **失败** |
| 单选 | `P` | `P` E-F1 | `F` 空名 | `P` | `F` raw ID | `P` | `P` | `P` | `P` | `F` allowCreate | `P` | `B` | `B` | **失败** |
| 多选 | `P` | `P` E-F1 | `F` 空名 | `P` | `F` 仅数量 | `P` | `P` | `P` | `P` | `F` allowCreate | `P` | `B` | `B` | **失败** |
| 数字 | `P` | `P` E-F1 | `F` 空名 | `P` | `F` 货币占位 | `P` | `P` | `P` | `P` | `P` | `P` | `B` | `B` | **失败** |
| 进度 | `P` | `P` E-F1 | `F` 空名 | `P` | `F` 无进度条 | `P` | `P` | `P` | `P` | `N/A` | `P` 0–100 | `B` | `B` | **失败** |
| 日期 | `P` | `P` E-F1 | `F` 空名 | `P` | `P` | `P` | `P` | `P` | `P` | `P` includeTime | `P` | `B` | `B` | **失败** |
| 图片 | `P` | `P` E-F1 | `F` 空名 | `F` 双源 | `P` 合法附件 | `F` 文本编辑器 | `F` | `F` 无专属流 | `F` 双源 | `N/A` | `F` | `B` | `B` | **失败** |
| 文件 | `P` | `P` E-F1 | `F` 空名 | `F` 双源 | `P` 合法附件 | `F` 文本编辑器 | `F` | `F` 无专属流 | `F` 双源 | `N/A` | `F` | `B` | `B` | **失败** |
| 链接 | `P` | `P` E-F1 | `F` 空名 | `P` | `F` 纯文本/任意协议 | `P` | `P` | `P` | `P` | `N/A` | `P` | `B` | `B` | **失败** |
| 复选框 | `P` | `P` E-F1 | `F` 空名 | `P` | `P` | `P` | `P` | `N/A` 直接操作 | `P` | `N/A` | `P` 失败重试 | `B` | `B` | **失败** |
| 自动编号 | `F` 缺入口 | `P` E-F1 | `F` 空名 | `N/A` 系统生成 | `P` | `N/A` | `N/A` | `N/A` | `N/A` | `N/A` | `P` 只读 | `B` | `B` | **失败** |
| 创建时间 | `F` 缺入口 | `P` E-F1 | `F` 空名 | `N/A` 系统生成 | `P` | `N/A` | `N/A` | `N/A` | `N/A` | `N/A` | `P` 只读 | `B` | `B` | **失败** |
| 最后编辑时间 | `F` 缺入口 | `P` E-F1 | `F` 空名 | `N/A` 系统生成 | `P` | `N/A` | `N/A` | `N/A` | `N/A` | `N/A` | `P` 只读 | `B` | `B` | **失败** |

字段矩阵原子统计：`P 90 / F 39 / B 28 / N/A 25`。

逐字段证据索引（下列路径均相对仓库根目录）：

- **E-F1 图标与名称**：`reqflow/src/components/fields/FieldTypeIcon.tsx:3-17` 以 `Record<FieldType, string>` 穷举 13 类型；`reqflow/src/components/table/GridHeader.tsx:39`、`reqflow/src/components/fields/FieldEditor.tsx:25`、`reqflow/src/components/fields/FieldTypePicker.tsx:31` 复用同一图标组件。图标是装饰节点 `aria-hidden`，名称由相邻文本/控件提供。该证据证明代码映射一致，不等于三档视觉验收，后者见 4.3。
- **E-F2 创建**：`reqflow/src/components/fields/fieldCreation.ts:4-7` 与 `FieldTypePicker.tsx:23-31`；普通 10 类可直接创建，3 个系统类型缺失；Rust 全 13 类见 `reqflow/src-tauri/src/storage/domain.rs:6-24`、`field_repository_data.rs:68-97`。
- **E-F3 改名**：既有字段按 `TABLE-002/TABLE-024` 在字段管理列表改名，链路为 `FieldEditor.tsx:20-26` → `FieldManager.tsx:92` → `StorageWorkspace.tsx:249` → Rust transaction；非空 Enter 有 `FieldEditor.test.tsx`。失败点不是“必须从既有表头进入”，而是空名被前端、Rust、SQLite 三层拒绝（H-03），且缺磁盘失败回滚矩阵。新建字段才按 `FIELD-020/TABLE-031` 进入表头内联改名。
- **E-F4 显示**：`reqflow/src/components/table/GridCell.tsx:39-49`、`reqflow/src/lib/table/fieldFormatting.ts:7-21`、`GridCell.test.tsx`；已确认单选 raw ID、多选数量、货币 `¤`、文本 CSS 未命中和链接纯文本。
- **E-F5 录入/修改/取消/清空**：`reqflow/src/components/table/editors/CellEditorHost.tsx:16-38`、`DataGrid.interaction.test.tsx`、`CellEditorHost.test.tsx`、`reqflow/src-tauri/src/storage/record_write.rs:34-155`。系统字段拒写；图片/文件绕过 attachment API，故相关项为失败。
- **E-F6 配置**：`reqflow/src/components/fields/FieldEditPage.tsx:8-15`、`FieldEditPage.test.tsx`、`reqflow/src-tauri/src/storage/field_repository_validation.rs:63-114`。数字和日期链路存在；文本多行显示及 select/multi 的 allowCreate 常规录入失效。
- **E-F7 视图/重启**：`reqflow/src/components/storage/StorageWorkspace.tsx:117-188` 和 SQLite view config 证明保存链存在；但现有字段仓储测试均为内存连接，没有 14 类磁盘 close/reopen 与跨视图逐项验收，统一标 `B`。

### 2.1 字段存储事实

- Rust `FIELD_TYPES` 和 `create_field` 支持 13 种类型；常规 `FieldTypePicker` 只列 10 种。
- 字段定义/配置、普通值、多选值分别持久化到 `fields.config_json`、`cell_values`、`multi_select_values`。
- `auto_number`、`created_time`、`updated_time` 由 record 列合成并拒绝写入。
- `text/number/date/select/multi_select` 有配置规范化；其他类型只要求配置是 JSON object。
- 图片/文件存在两套同时可写的数据路径：原始 cell value 与 `attachments` 元数据/项目文件。表格目前使用前者，详情使用后者，这是 H-04 的基础。

## 3. 工具栏与字段管理矩阵

这里把“当前会话保存链”和“磁盘重启/失败回滚”拆开：能调用 `updateStorageViewConfig` 不等于已经证明关闭项目后恢复。路径均相对仓库根目录。

| 工具 | 类型语义 | 实际操作 | 清除/取消 | 状态/焦点 | 当前会话 | 磁盘重启/失败 | 总体 |
|---|---|---|---|---|---|---|---|
| 搜索 | `F` 附件原名不可搜 | `P` AND/不区分大小写 | `P` 清除 | `P` 受控输入 | `P` 临时态且切视图清空 | `N/A` 按 Spec 不保存 | **失败** |
| 筛选 | `P` 运算符主体 | `F` 多字符竞态 | `P` 删除/不完整不生效 | `F` remount 竞争 | `P` 完整规则入 config | `B` 无渲染回滚/重开 | **失败** |
| 排序 | `P` 类型白名单/空末尾 | `P` 稳定多字段 | `P` 删除恢复 | `P` 键盘等价 | `P` config 链 | `B` 无磁盘重开 | **阻塞** |
| 分组 | `P` 单级/白名单 | `P` 组序/折叠/新增 | `P` 清除 | `P` 键盘/焦点 | `P` config 链 | `B` 无磁盘重开 | **阻塞** |
| 条件填色 | `P` 自身字段/27 色 | `F` 输入竞态 | `P` 删除/关色板 | `F` 无启停且抢焦点 | `P` config 链 | `B` 无就近重试/重开 | **失败** |
| 行高 | `P` 32/40/56 | `F` 切换错位 | `P` 开关菜单不改值 | `P` 对号/Esc/返焦 | `P` config 链 | `B` 无磁盘重开几何验收 | **失败** |
| 字段管理 | `P` 显隐/顺序/配置主体 | `F` 空名/选项删除 | `P` 草稿取消 | `P` 280px 非模态主体 | `P` Store/IPC 链 | `B` 无渲染失败/重开 | **失败** |
| 新建记录 | `P` 最右主操作 | `P` 真实创建 | `N/A` 单步 | `P` 可访问入口 | `P` IPC 成功后换快照 | `B` 无 UI→磁盘重开 | **阻塞** |

工具矩阵原子统计：`P 32 / F 7 / B 7 / N/A 2`。

证据索引：搜索/筛选/排序/分组/填色分别见 `reqflow/src/lib/table/viewPipeline.ts`、`reqflow/src/components/table/tools/*Panel.tsx` 与 `ViewTools.test.tsx`/`viewPipeline.test.ts`；行高见 `ViewTools.tsx:53-69`、`gridConfig.ts:7-24`；字段管理见 `FieldManager.tsx:88-117`、`FieldManager.test.tsx`；新建记录见 `ViewTools.tsx:47`、`StorageWorkspace.tsx:244`、`tableDataStore.ts`。布局保存协调器测试只验证 helper，不渲染 `StorageWorkspace`，因此没有拿它替代磁盘重启证据。

筛选另有一个已确认缺陷：字段选择器列出图片/文件，但 `filterOperatorsFor` 对两类返回空数组，选择后形成不可完成卡片。`TABLE-018` 自身同时写“列出全部真实字段”和“图片和文件不在本轮新增筛选规则”，预期目标存在文档冲突；M-12 只确认当前死路径，不擅自决定最终应排除还是补能力。

## 4. 三档行高与坐标系统

### 4.1 客观运行结果

隔离页面使用真实 `DataGrid`、真实全局 CSS、真实 TanStack Virtual、64 条记录和全部字段类型。在 1280×720 下得到：

运行方式与边界：临时 harness 位于 `/private/tmp/morfra-field-audit-harness-20260820`，从 `reqflow` 引用生产 `DataGrid`/CSS，以 Vite localhost 启动；没有 mock virtualizer，也没有接触真实项目。用户关闭屏幕读取后服务已停止、临时目录已删除，因此本轮没有把 harness 留成第二个持久化文件。以下 DOM/geometry 原始摘要已写入报告，可直接转成下一轮自动化回归：

```text
viewport=1280x720  records=64  fields=14
header.top=83  header.bottom=124  headerTrack=40  body.top=124
40: rowStarts=[0,40,80]  actualHeight=40  total=2560
40->32: rowStarts=[0,40,80]  actualHeight=32  total=2560  expectedTotal=2048
40->56: rowStarts=[0,40,80]  actualHeight=56  total=2560  expectedTotal=3584
fresh32: rowStarts=[0,32,64] total=2048
fresh56: rowStarts=[0,56,112] total=3584 headerCell.bottom=139 body.top=124
elementFromPoint(firstBodyRow.x, body.top+8)=header
rowNumberWidth=48  nonFrozenScrollStart=68  nonFrozenEditorStart=68  delta=20
```

可访问性/审美边界：名称、role、aria 状态从 DOM 与组件测试取证；没有保留截图，也没有在权限关闭后继续读取 960、全屏、深色或主观美感。相关项在 §5 明确标 `B/F`，没有用上述 1280 数值外推为通过。

| 模式 | 虚拟起点 | 记录实际高 | body 总高 | 表头/命中 | 结论 |
|---|---:|---:|---:|---|---|
| 标准 40 初始 | `0,40,80…` | 40 | 2560 | 表头 track 40，body 从 124 开始 | 纵向基线正常 |
| 标准→紧凑 32 | 仍为 `0,40,80…` | 32 | 仍为 2560，预期 2048 | 相邻记录出现 8px 空隙；选择层/编辑器立即用 32 | **失败** |
| 标准→宽松 56 | 仍为 `0,40,80…` | 56 | 仍为 2560，预期 3584 | 相邻记录重叠 16px；56px 表头子项结束于 139，body 从 124 开始，物理覆盖 15px；body 顶部 +8px 命中表头而非首行 | **失败** |
| 重新挂载，初始 32 | `0,32,64…` | 32 | 2048 | 虚拟行恢复；表头仍 40 | 行偏移恢复，密度契约仍不统一 |
| 重新挂载，初始 56 | `0,56,112…` | 56 | 3584 | 虚拟行恢复；表头仍覆盖首行 15px，命中仍被表头截获 | **失败** |

虚拟核心最小复现：

```text
40                 0/40/80
32_without_measure 0/40/80
32_after_measure   0/32/64
56_without_measure 0/32/64
56_after_measure   0/56/112
```

### 4.2 组件坐标矩阵

| 模式 | 行偏移 | 表头/表体 | 行号区 | 冻结主标题 | 普通/末尾列 | 网格线 | 选区 | 编辑器/命中 | 总体 |
|---|---|---|---|---|---|---|---|---|---|
| 紧凑 32 | `F` 切换后仍 40 步长 | `F` track 40 | `F` 与记录空隙同源 | `F` 记录/选区不同步 | `F` 同步错位 | `F` 8px 断裂 | `F` 立即按 32 计算 | `F` y 坐标与记录分离 | **失败** |
| 标准 40 | `P` | `P` | `P` | `P` | `P` | `P` | `P` | `F` 非冻结编辑器固定右移 20px | **失败** |
| 宽松 56 | `F` 切换后仍旧步长 | `F` 表头覆盖首行 | `F` 重叠 | `F` 重叠/遮挡 | `F` 重叠 | `F` 16px 重叠 | `F` 与实体行不同步 | `F` header/editor 抢命中 | **失败** |

行高矩阵原子统计：`P 7 / F 17 / B 0 / N/A 0`。

### 4.3 主标题 + 13 字段 × 三档行高交叉矩阵

`40 初始` 同时计入字段内部显示/编辑与命中，因此已有类型缺陷仍记 `F`；`32/56` 均指从标准档在同一实例切换，而不是重新挂载。隔离数据含 64 条记录、主标题与 13 类型、空值及长值。所有行共享的客观坐标证据为 4.1；字段内部证据为 E-F4～E-F6。

| 字段 | 40 初始 | 切到 32 | 切到 56 | 切档后滚动 | 切换视图 | 关闭重开 |
|---|---|---|---|---|---|---|
| 主标题 | `F` 多行规则 | `F` | `F` | `F` | `B` | `B` |
| 文本 | `F` 多行规则 | `F` | `F` | `F` | `B` | `B` |
| 单选 | `F` raw ID | `F` | `F` | `F` | `B` | `B` |
| 多选 | `F` 仅数量 | `F` | `F` | `F` | `B` | `B` |
| 数字 | `F` 货币占位 | `F` | `F` | `F` | `B` | `B` |
| 进度 | `F` 无内部条 | `F` | `F` | `F` | `B` | `B` |
| 日期 | `P` | `F` | `F` | `F` | `B` | `B` |
| 图片 | `F` 附件编辑链 | `F` | `F` | `F` | `B` | `B` |
| 文件 | `F` 附件编辑链 | `F` | `F` | `F` | `B` | `B` |
| 链接 | `F` 纯文本 | `F` | `F` | `F` | `B` | `B` |
| 复选框 | `P` | `F` | `F` | `F` | `B` | `B` |
| 自动编号 | `P` 只读 | `F` | `F` | `F` | `B` | `B` |
| 创建时间 | `P` 只读 | `F` | `F` | `F` | `B` | `B` |
| 最后编辑时间 | `P` 只读 | `F` | `F` | `F` | `B` | `B` |

交叉矩阵原子统计：`P 5 / F 51 / B 28 / N/A 0`。图片缩略图、文件名、选项标签、进度条和多行截断已逐项纳入 `40 初始`；切档后的全字段失败由同一虚拟行坐标根因决定。重新挂载只证明 virtualizer 初始估算恢复，**不等于**视图切换或磁盘重启，后二者统一标 `B`。

### 4.4 已确认根因

1. `GridBody.tsx:48-50` 把 `rowHeight` 只作为 `estimateSize`，行高变化后没有 `rowVirtualizer.measure()`，组件 key 也不含行高。TanStack Virtual 的既有测量缓存不会因 `estimateSize` 函数变化自动清空。
2. `GridSelectionLayer.tsx:19-22`、`GridPersistentEditor.tsx:28` 和 `rowTops` 立即使用新行高，实体行仍使用旧 `virtualRow.start`，因此记录、选区、编辑器必然分离。
3. `05-table.css:219` 把表头 grid track 固定为 40px，`GridHeader.tsx:38` 又把表头子项 `minHeight` 设为当前记录行高；56px 必然溢出并遮挡首行。
4. `ROW_NUMBER_WIDTH` 是 48px（`columnLayout.ts:3`），但 `DataGrid.tsx:66` 和 `GridPersistentEditor.tsx:26` 以 68px 作为非冻结内容起点，产生稳定 20px 水平偏移，标准模式也受影响。
5. 横向 virtualizer 也没有在列宽变化后 `measure()`，存在同类缓存风险；本轮没有在屏幕关闭后继续做实机列宽拖动，因此该点是高置信静态风险，不冒充已复现。

推测项声明：第 5 点置信度约 80%，可能涉及 `GridBody.tsx`、`DataGrid.tsx`、`columnLayout.ts`；最小方向是在列宽/字段顺序签名变化后重测横向 virtualizer。主要风险是冻结边界、clipPath 和选区仍引用另一套列坐标；修复后必须跑列宽拖动、双击自适配、显隐/排序、横滚和冻结恢复。

### 4.5 初步修复预测

- 为行高、分组高度签名变化调用 `rowVirtualizer.measure()`，或用包含行高/分组签名的 key 重建。
- 为列宽、字段顺序变化调用 `columnVirtualizer.measure()`。
- 建立唯一几何常量/坐标转换，删除 68、40 等散落魔数；所有 scroll、selection、editor、hit-test 共用同一函数。
- 表头若保持固定 40px，就不要把记录行高传给表头子项；若表头随密度变化，则 header track、body offset、editor top 必须一起变化。
- 新增真实 virtualizer 的 `40→32→56→40` 回归，逐项断言 row start、body total、header/body 边界、选区、编辑器、末尾列和点击命中。

## 5. 稳健性矩阵

| 场景 | 状态 | 证据/限制 |
|---|---|---|
| ≥1200px 常规窗口完整网格 | `F` | 1280×720 隔离运行；标准档非冻结编辑器仍固定右移 20px |
| 960–1199px | `B` | 外壳有测试、浮层有边界算法；屏幕读取关闭前未完成字段/网格实机矩阵 |
| 真实全屏 | `B` | 仅有宽屏外壳测试，无真实全屏网格密度证据 |
| 浅色 | `B` | 有隔离运行和 token 静态证据，但未保留全字段 computed-style/对比度明细，不能整体判通过 |
| 深色 | `F` | `themeAudit` 失败；`FieldEditPage.tsx:16` 固定 `bg-white`，且无字段/工具实机矩阵 |
| 横向滚动/冻结 | `F` | 非冻结编辑器固定错 20px；列宽变化后的横向 virtualizer 另有 80% 静态风险，均归 H-02 |
| 纵向滚动/反复行高 | `F` | 切档后虚拟偏移缓存已客观复现 |
| 空值/长值 | `F` | 空值路径存在；长文本 CSS 选择器不命中，三档截断未实现 |
| 反复工具/视图切换 | `F` | ViewTools 在组合/全量运行中出现输入竞态；没有 A↔B 多轮乱序持久化测试 |
| 完整视图配置重启 | `B` | SQLite 链存在，但没有全配置磁盘 close/reopen 精确比对 |
| 保存失败回滚 | `B` | 单元格重试、布局 coordinator 有测试；缺 Rust DB 故障注入及渲染后的筛选/填色/重命名闭环 |
| 10,000×200 / ≤300ms | `B` | 纯函数与 mock virtualizer 测试存在；正式 release benchmark 因 fixture 缺 `fieldOrder` 直接崩溃，未产出 P95 |
| 隔离测试项目 | `P` | 临时目录、模拟数据和 `/tmp` 构建产物；未接触真实项目数据 |

稳健性原子统计：`P 1 / F 6 / B 6 / N/A 0`。

## 6. HIGH 问题（9）

本节问题均为 **HIGH**。除 H-02 明确拆出的横向 virtualizer 子风险外，均为已确认代码/运行缺陷；文件路径相对仓库根目录。每项的“修复预测”只是下一 Agent 的最小起点，不是本轮实施。

### H-01 · 切换行高不重测虚拟行，造成空隙、重叠和选择错位

- 范围：全部字段、紧凑/宽松、滚动、选区、编辑器。
- 复现：标准 40 → 紧凑 32 或宽松 56，不重挂载视图。
- 预期：虚拟起点同步变为 32 或 56 步长。
- 实际：起点保留旧步长；32 出现 8px 空隙，56 出现 16px 重叠；body 总高不变。
- 根因/证据：`reqflow/src/components/table/GridBody.tsx:48-50` 未 measure/remount；`GridSelectionLayer.tsx:19-22` 与 `GridPersistentEditor.tsx:28` 立即按新值计算；4.1 有数值复现。
- 影响/确认度：已确认；所有字段切档、滚动、选择、编辑和命中均受影响，属于功能失效。
- 修复预测：统一尺寸签名并 measure；禁止只修 CSS。
- 修复风险：分组行具有不同高度，粗暴清缓存会造成滚动跳跃；必须保留当前位置并统一 group/record 测量。
- 必跑回归：真实 virtualizer、多轮切换、滚动到中段后切换、分组态、选区和编辑器。

### H-02 · 表头、行号、单元格和编辑器使用冲突坐标常量

- 范围：56px 首行命中；所有模式非冻结编辑器。
- 复现/预期：宽松档点击首行，或在非冻结列打开编辑器；预期表头不覆盖记录、编辑器与单元格同 x/y。
- 实际：固定 40px header track + 56px child 覆盖首行 15px；行号宽 48px，但非冻结 editor/scroll 起点是 68px，固定右移 20px。
- 根因：`reqflow/src/styles/global/05-table.css:219`、`reqflow/src/components/table/GridHeader.tsx:38`、`columnLayout.ts:3`、`DataGrid.tsx:66`、`GridPersistentEditor.tsx:26-28`。
- 影响/确认度：表头覆盖和 20px 偏移已确认；列宽变化后横向 virtualizer 缓存为静态推测（80%），涉及 `GridBody.tsx`/`DataGrid.tsx`/`columnLayout.ts`，尚未实机复现。
- 修复预测：单一 geometry contract；header/body/editor/scroll/hit-test 只读常量或共享函数。
- 修复风险：冻结边界、clipPath、末尾虚拟列和选区可能继续引用旧坐标；不得只改一个魔数。
- 必跑回归：三档、冻结/非冻结、末尾操作列、横滚前后、点击命中。

### H-03 · 空字段名被 UI、Rust 与 SQLite 三层阻止，计划中的 011 不存在

- 要求：`FIELD-001`、`FIELD-020`、`TABLE-031`。
- 复现/预期：在字段管理列表或新字段表头清空名称并 Enter/失焦；预期保存空字符串并保持无文字。
- 前端：`GridHeader.tsx:36-39`、`FieldEditor.tsx:22` trim 后拒绝空并恢复旧名。
- Rust：`field_repository_validation.rs:54-61` 的通用 `validate_name` 拒空。
- SQLite：`009_remove_field_groups.sql:34-44` 仍有 `CHECK(length(trim(name)) > 0)`；未跟踪的 010 也没有移除。
- 计划漂移：`DEV-PLAN.md:955-968` 已写 `011_allow_empty_field_names.sql`，实际文件和注册都不存在。
- 影响/确认度：已确认、确定性失败；主标题和全部 13 类型字段均受影响。非空名称的“间歇失效”本轮没有稳定复现，不据此另造缺陷。
- 修复预测：字段专属名称校验只保留 200 字符上限；新增带备份、FK 检查和回滚测试的 011；空值成功后表头保持无文字。
- 修复风险：重建 fields 时容易破坏现有 FK、索引及用户未提交的 010；必须按迁移顺序和干净克隆验证。
- 必跑回归：空/纯空白/200/201 字符、标题/普通、迁移前后、失败回滚、磁盘重开。

### H-04 · 图片/文件表格编辑与清空绕过附件事务

- 范围：图片、文件、Delete、批量清空、粘贴、搜索、详情一致性。
- 复现/预期：通过 attachment API 添加文件，再从表格双击或 Delete；预期使用附件选择/替换/移除事务并让表格、详情、文件系统一致。
- 实际：`CellEditorHost.tsx:16-38` 把图片/文件交给逗号文本编辑器；`gridConfig.ts:9` 生成 URL/path 数组。真正附件控件只接在 `RecordDetailPanel.tsx:132-145`。
- 清空：`pastePlan.ts:51-61` 发送 null；`record_write.rs:43-68` 只删 cell/multi，不删 `attachments` 或物理文件。表格可空、详情仍显示附件。
- 影响/确认度：已确认；可产生假路径、孤儿元数据/文件及表格与详情互相矛盾。
- 修复预测：网格图片/文件新增、替换、移除、清空统一调用 attachment API；元数据、cell 投影和文件系统保持同一原子语义。
- 修复风险：数据库与文件系统无法天然处于同一事务；必须延续 staging/rollback 方案并覆盖崩溃窗口。
- 必跑回归：image/file × add/open/replace/remove/clear、批量、故障注入、缺失文件和重开。

### H-05 · 任意记录级/字段级 Undo 可能销毁附件

- 复现/预期：给记录挂附件后编辑任意普通单元格再 Undo，或改名图片/文件字段再 Undo；预期只恢复目标变更且附件 metadata/文件不变。
- 数据丢失路径：`RecordBackup` 不含 attachments；`restore_record`、批量恢复和看板移动恢复先 DELETE record，再重建普通值，FK 会级联删 attachment metadata。正常关闭项目后 cleanup 会把物理文件视为未引用并删除。
- 字段路径：`FieldBackup` 同样不含 attachments；`restore_field` 先删字段再重建，图片/文件字段的改名、配置、转换、删除撤销都可丢附件。
- 证据：`record_repository.rs:15-22`、`record_public.rs:234-293,358-423`、`field_models.rs:51-58`、`field_repository_data.rs:185-204`、`attachments.rs:240-259`。
- 影响/确认度：已确认的数据丢失路径；普通编辑、批量、看板、字段编辑/删除均可触发，关闭项目后物理文件也可能不可恢复。
- 修复预测：backup/restore 显式包含 attachment metadata 和文件处置计划；避免用“先删父实体再重建”破坏未进入备份的邻接数据。
- 修复风险：把 metadata 加入 backup 仍不足以覆盖文件已被 cleanup 的情形；事务、Undo 栈和 close cleanup 必须一起设计。
- 必跑回归：`undo_cell_edit_preserves_record_attachments`、批量/看板、字段改名/配置/转换/删除、关闭项目后物理文件仍存在。

### H-06 · 3 种 P0 系统字段缺少直接创建入口

- 缺失：`auto_number`、`created_time`、`updated_time`。
- 复现/预期：从表头加号或字段管理“新增字段”打开类型选择器；预期 13 类都可直接选择并创建。
- 证据：`fieldCreation.ts:4` 只有 10 种；后端支持 13 种。用户可以“先建普通字段 → 再转换”为系统类型，但不符合 `FIELD-020` 的类型优先直接创建合同。
- 影响/确认度：已确认；两个常规新增入口均复用同一缺失数组，系统类型只能绕行二步转换。
- 修复预测：在两个复用的 FieldTypePicker 入口补齐 13 类型；创建后系统字段立即只读并加入当前视图。
- 修复风险：系统字段默认值来自 record 列，创建后不得写入普通 cell_values；重复提交和默认可见顺序也需保持原子。
- 必跑回归：选择器枚举精确 13 种、重复点击防护、创建失败无假列、系统值和重开。

### H-07 · 筛选与条件填色存在输入/焦点竞态

- 复现/预期：在组合/全量测试负载下快速输入中文“需求”或填色值 `a`；预期完整字符稳定留在当前规则且焦点不跳。
- 筛选：第一个完整字符后，规则从 local draft 移入受控 config 并 remount，快速输入“需求”曾只保存“需”或完全不计数。
- 填色：local drafts + 80ms 同步 + uncontrolled `defaultValue` + requestAnimationFrame 聚焦竞争，组合/全量测试中输入 `a` 变空。
- 证据：`FilterPanel.tsx:17-27`、`ConditionalColorPanel.tsx:44-64,106-110`；同一套测试隔离运行可全绿，组合运行失败，符合时序竞态。
- 影响/确认度：已确认时序缺陷；重复率受负载影响，不能因单文件 12/12 通过而判定消失。
- 修复预测：单一受控草稿源；编辑完成前不换 ownership/remount；持久化与输入态解耦；取消过期 focus/timer。
- 修复风险：过度 debounce 会制造保存滞后和跨视图串写；应显式取消旧视图 timer 并区分 draft/confirmed。
- 必跑回归：中英文多字符、IME、快速键入、开关工具、多轮 A↔B、失败回滚。

### H-08 · 选项删除缺确认，批量删除时后续引用项还会绕过影响确认

- 复现 A：删除一个未被记录或视图引用的选项并保存；`FieldManager.tsx:91` 在 usage 为零时直接提交，没有 `FIELD-017` 要求的简短确认。
- 复现 B：一次草稿删除多个有引用选项；代码遇到第一个引用项就弹确认并 return，确认后 `submitDraft` 一次提交全部待删项，只有当前选项带替换选择，其他引用项默认 clear。
- 预期：未引用项也先简短确认；每个引用项明确选择替换或清空后才一次原子提交。实际：A 无确认，B 只确认一个影响。
- 影响：误删风险；用户只确认一个选项时，其他引用值和视图规则可被静默清空，违反 FIELD-017～019。
- 确认度：已确认静态控制流；现有测试没有覆盖多删除混合引用矩阵。
- 修复预测：提交前汇总全部受影响选项并为每项收集明确决策，或逐项完成决策后一次事务提交。
- 修复风险：逐项即时提交会破坏“单次保存/单次 Undo”的原子合同，决策收集和最终 mutation 必须分离。
- 必跑回归：多个被引用/未引用混合删除、单选/多选、视图规则、取消后草稿保留、Undo 精确恢复。

### H-09 · 表删除 Undo 只恢复部分表域数据

- 范围：稳健性审查发现的同一 Undo 备份模型邻接缺陷。
- 复现/预期：创建含活动历史、详情正文、附件和完整 table config 的表，删除后 Undo；预期所有表域数据按原 ID/内容恢复。
- 实际：DeletedTable 包含 attachment metadata，但不包含 activity events/comments、record detail contents；table config 仅恢复部分列，`activity_field_id`、`activity_tab_enabled`、`detail_tabs_json` 会丢。
- 证据：`table_backup.rs:7-21`、`table_backup_capture.rs:12-19,112-129`、`table_backup_mutations.rs:66,109-110`。
- 影响/确认度：已确认；Undo 显示表已恢复，但活动/详情/部分配置永久缺失。
- 修复预测：把完整表域数据与配置纳入版本化备份结构，恢复前后做数量、内容和 FK 对账。
- 修复风险：备份结构扩大后需处理旧 Undo action/序列化兼容与恢复顺序，避免 FK 次序失败。
- 必跑回归：带活动历史、详情正文/交付/任务/验收、附件和全部 table config 的删表→Undo→重开。

## 7. MEDIUM 问题（13）

| ID | 问题与证据 | 初步修复方向 |
|---|---|---|
| M-01 | 单选显示 raw option ID，多选只显示数量；`fieldFormatting.ts:7-21` | 共享 option label/color 渲染器，搜索、单元格、看板一致 |
| M-02 | `allowCreate` 默认开启但 `SelectEditor.tsx` 无新建选项入口；粘贴也总拒绝未知值 | 编辑器/粘贴按配置提供明确的新建流程并走原子选项+值事务 |
| M-03 | 多行文本 CSS 选择器 `.morfra-grid-cell > .morfra-grid-text` 与真实嵌套不匹配，且没有按 32/40/56 截断 | 修正 DOM 选择器并按密度设置可用行数；加长值几何测试 |
| M-04 | 进度只显示百分比文本；货币显示通用 `¤` | 建立进度内部组件与明确货币格式/币种合同，不写占位符 |
| M-05 | 链接是纯文本，后端/粘贴不校验 URL 或 scheme | 共享 URL parser/allowlist；表格提供安全打开动作 |
| M-06 | 搜索读取附件 cell path 而非 attachment `originalName`；现有测试用 `z.pdf` 假装生产 cell value | 在快照或搜索索引中提供真实附件显示名；用真实数据结构测试 |
| M-07 | 条件填色模型有 `enabled`，UI 无启用/停用；保存失败没有规则就近错误/重试 | 增加 switch、局部错误态、重试与 draft/confirmed 分层 |
| M-08 | 真空表内部提示与无结果状态职责不完整；DataGrid 空态没有“新建记录”主操作 | 区分真正空表和筛选无结果，并复用工具栏创建动作 |
| M-09 | 深色/主题门禁失败：`FieldEditPage.tsx:16` 写死 `bg-white` | 使用语义 token，并对字段管理/工具浮层做浅深等价测试 |
| M-10 | 表体虚拟化列，`GridHeader` 仍映射全部 200 个表头；正式 benchmark fixture 又缺 `fieldOrder` 而崩溃 | 表头与表体共享可见列窗口；先修 benchmark fixture 再出真实 P95 |
| M-11 | 后端 view config 只严格校验 `fieldIds`，非法 rowHeight/width/order/freeze/pipeline 可长期写入 DB，前端仅加载时降级 | 后端 schema 校验/规范化并增加完整磁盘 round-trip 与故障注入 |
| M-12 | 筛选字段选择器列出图片/文件，但两类没有运算符，选择后形成不可完成卡片 | 先统一 TABLE-018，再选择“排除两类”或“提供可靠运算符”；两种方案都需清理旧死规则 |
| M-13 | 选项只提供原生拖拽，没有 TABLE-024 要求的键盘等价排序；`OptionEditor.tsx:11` | 为拖拽操作提供可访问的键盘排序命令、位置反馈与焦点保持 |

## 8. LOW 问题（3）

| ID | 问题 | 处理建议 |
|---|---|---|
| L-01 | `StorageWorkspace.test.tsx:16` 仍期待旧对象，漏 `fieldOrder`；实现本身返回新字段 | 更新测试契约，但必须在修复赛程中改，不在本轮为了变绿改断言 |
| L-02 | `invalid_cell_update_is_atomic_and_type_conversion_is_undoable_by_backup` 名称声称覆盖字段 Undo，实际恢复的是 RecordBackup，真实 RestoreField 无直测 | 改测试名并新增真正字段 Undo 测试 |
| L-03 | 生产构建主 JS 约 2,319kB，超过 500kB 告警阈值 | 在功能修复后做按路由/模块拆包，避免掩盖性能回归 |

### 8.1 MEDIUM / LOW 失败项的复现、风险与回归

下表补全每项的字段/工具/模式、复现、预期、实际、影响、修复风险和回归要求。M/L 的代码路径均为已确认事实，且均相对仓库根目录；涉及用户最终观感或性能收益的部分仍需修复后实机证明。

| ID | 范围与最小复现 | 预期 / 实际 / 证据 | 影响、修复风险与必跑回归 |
|---|---|---|---|
| M-01 | 单选/多选；给记录写入 option ID 后查看网格 | 预期显示选项名/颜色；实际单选显示 ID、多选显示数量；`fieldFormatting.ts:7-21` | 用户无法直接辨认值。复用标签组件时避免改变排序/搜索 ID 语义；测空、未知 ID、同名、浅深色 |
| M-02 | `allowCreate=true` 的单选/多选，在单元格输入新名称或粘贴未知名称 | 预期按配置可新增；实际编辑器无入口，粘贴固定拒绝；`SelectEditor.tsx`、`pastePlan.ts:94-99` | 配置对常规录入无效。修复需保证“建选项+写值”原子且防重复；测 true/false、并发、失败回滚、Undo |
| M-03 | 文本开启 multiline，放入长值，在 32/40/56 查看 | 预期按可用行数截断；实际选择器未命中嵌套 span；`05-table.css:303-315` 对照 `GridCell.tsx:34-49` | 长值被硬裁切且密度表现不可控。改 DOM/CSS 时防止撑高行；测 1/2/3 行、emoji/CJK、编辑态 |
| M-04 | 进度写 75；数字设 currency 后写 1234.5 | 预期保留进度内部语义、货币为明确格式；实际只有 `75%` 与 `¤1,234.5`；`fieldFormatting.ts:12-16` | 扫描性差、货币含义不明。需先明确币种/locale，避免数据模型误加；测 0/100/null/负数拒绝、不同 locale |
| M-05 | 链接字段写 `https://…` 与非 URL/危险 scheme，再查看和点击 | 预期只保存合法 URL并安全打开；实际纯文本且任意字符串可落库；`CellEditorHost.tsx:28-38`、`record_write.rs:80-83` | 链接字段退化为文本并有协议风险。共享 parser/allowlist，避免破坏已有值；测 http/https、空、相对值、危险 scheme、打开失败 |
| M-06 | 通过真实附件 API添加 `合同.pdf`，搜索“合同” | 预期命中；实际搜索索引读取 UUID/path 而非 `originalName`；`viewPipeline.ts:140-149,178`、`attachments.rs:54,70` | TABLE-017 的附件名搜索失效。把显示名加入快照时注意 10k×200 内存/P95；用真实 metadata、移动项目、同名附件测试 |
| M-07 | 新建条件填色规则后尝试停用；模拟保存失败 | 预期可启停，失败就近保留草稿并重试；实际无启停控件，只有全局布局回滚；`ConditionalColorPanel.tsx:90-103` | 用户无法暂存规则，失败可能被 local draft 再覆盖。分离 draft/confirmed；测启停优先级、失败→重试、A↔B 视图 |
| M-08 | 打开零记录表，与筛选后零结果比较 | 预期真空表有“新建记录”主操作，无结果提供清除条件；实际 DataGrid 空态只有通用说明，CTA 只在工具栏；`DataGrid.tsx`、`StorageWorkspace.tsx:248` | 状态恢复路径不完整。复用同一 create action，防止双提交；测真空/搜索空/筛选空/创建失败 |
| M-09 | 运行 theme audit 或在深色模式打开字段设置 switch | 预期所有颜色来自语义 token；实际 thumb 使用 `bg-white`，门禁失败；`FieldEditPage.tsx:16` | 深色一致性与主题门禁受损。替换 token 时验证对比度和选中态；跑 theme audit + 浅深渲染/焦点测试 |
| M-10 | 跑 phase39 release benchmark；或 200 字段横滚 | 预期挂载生产视口并产出 P95、表头/表体均只渲染可见区；实际 fixture 缺 `fieldOrder` 崩溃，表头仍渲染全部字段 | 性能目标无法证明。先修基准再优化，避免用 mock 结果替代生产；测 10k×200、30 samples、表头 DOM 数、滚动正确性 |
| M-11 | 直接向 view config 写非法 rowHeight/width/order/freeze/pipeline 后重开 | 预期后端拒绝或规范化；实际除 fieldIds 外可原样落库，前端才降级；`lifecycle_configs.rs:35-75`、`gridConfig.ts:22-24` | 旧/恶意调用方可积累脏配置。加 schema 时需兼容旧视图并原子升级；测非法值、混合有效值、复制视图、重开 |
| M-12 | 打开筛选→添加条件→选择图片或文件字段 | 最低预期是不能进入死路；实际字段可选、运算符数组为空；`FilterPanel.tsx:54-65`、`viewPipeline.ts:90-98`。TABLE-018 对是否列出两类自相矛盾 | 用户进入不可完成卡片。先统一文档，再排除两类或实现可靠能力；测选定方案、旧规则清理、焦点回退 |
| M-13 | 在字段编辑页只用键盘尝试调整选项顺序 | 预期存在与拖拽等价的排序；实际 `OptionEditor.tsx:11` 只有 `draggable`/drag events，无键盘命令 | 键盘用户无法完成 P0 操作。增加命令时保持 draft-only 与焦点；测首/末边界、保存/取消、读屏位置通知 |
| L-01 | 运行 `StorageWorkspace.test.tsx` | 预期测试与当前 `fieldOrder` 合同一致；实际断言仍是旧对象并稳定失败 | 回归门禁噪音。只更新精确预期，不能删除行为断言；随后跑全量和缓存恢复用例 |
| L-02 | 阅读并运行 `invalid_cell_update_is_atomic_and_type_conversion_is_undoable_by_backup` | 预期名称所述 RestoreField 被覆盖；实际只 capture/restore RecordBackup | 产生假覆盖认知。改名并新增真实字段 Undo，前置附件/活动绑定/视图引用 |
| L-03 | 运行生产构建 | 预期无超阈值主 chunk；实际主 JS 约 2,319kB，Vite 发出 >500kB 告警 | 首屏与更新成本风险。功能正确后再拆包，防止循环依赖；测产物大小、启动和懒加载错误 |

## 9. 文档与计划冲突（不冒充代码 Bug）

1. `FIELD-020` 要求字段管理器新增后停留字段列表；`Product-Spec.md:131` 和 `Design-Brief.md:50` 又写进入字段编辑页，且 Design Brief 还提到名称输入。当前实现停留列表。修复 Agent 不能凭猜测改，必须先统一当前事实源。
2. `TABLE-024` 主条写默认 380px，宽度补充明确覆盖为 280px；当前代码 280px，判为正确。
3. `DEV-PLAN.md:5` 声明 Phase 32～44 已完成，但 Phase 36～39 各节仍标“未批准”。
4. Phase 36 仍规划字段分组/布局重置，和 FIELD-014～016、TABLE-030 冲突；Phase 39 仍写 AND/OR、多选分组/跨组操作，和当前 TABLE-018/011/015 冲突。
5. DEV-PLAN 已把 011 空名称迁移列为开发中交付项，但实际迁移只注册到 010。
6. `TABLE-018` 同时要求筛选字段选择器“列出全部真实字段”，又声明图片/文件“不在本轮新增筛选规则”。当前 UI 把两类列出却不给运算符，形成 M-12 死路径。修复前必须先确认：是从选择器排除两类，还是为两类定义已确认可靠能力。

建议：修复赛程先做一次最小文档对齐，只消除上述互相矛盾句子，不借机扩需求。

## 10. 测试、编译和构建证据

| 命令 | 结果 | 关键输出/解释 |
|---|---|---|
| `pnpm exec tsc --noEmit` | PASS，exit 0 | TypeScript 类型检查通过 |
| Vite build，输出定向 `/tmp/morfra-field-audit-dist` | PASS，exit 0 | 253 modules；主 JS 2,319kB 告警 |
| `pnpm test`（最新全量） | FAIL，exit 1 | 136 files：133 pass / 3 fail；1009 tests：1006 pass / 3 fail |
| 较早同一全量运行 | FAIL | 1005 pass / 4 fail；筛选失败是否出现会随时序变化 |
| 字段/表格/纯函数组合测试 | 不稳定 | 一次 117/119，筛选+填色失败；另一只读 Agent 运行 122/122；证明 ViewTools 竞态而不是可靠通过 |
| `ViewTools.test.tsx` 隔离最新运行 | PASS，12/12 | 隔离可绿，不抵消组合/全量失败 |
| 字段/表格 + Storage 定向 | FAIL，132/133 | 唯一失败为陈旧 `fieldOrder` 断言；另一次组合触发 ViewTools 失败 |
| `CARGO_TARGET_DIR=/private/tmp/morfra-field-audit-cargo cargo test storage::` | PASS，52/52 | 附件、备份、字段、迁移、事务、基准存储测试通过 |
| 全量 `cargo test` | 环境性 FAIL | 64 pass / 7 fail / 1 ignored；7 项均为 AI provider 测试在沙箱中 bind localhost 被 EPERM，和本审查范围无关 |
| `cargo check --lib` | PASS，exit 0 | Rust lib 编译通过 |
| phase39 release benchmark 临时打包运行 | FAIL | `config.fieldOrder` 缺失导致 `TypeError: ... undefined (reading 'map')`；DataGrid production viewport 未挂载，无 P95 |
| `git diff --check` | PASS，exit 0 | 无 whitespace error |

工作目录与精简原始输出（前端均在 `/Users/yichuangyang/项目/需求管理系统/reqflow`；Git 检查在仓库根目录）：

```text
$ pnpm exec tsc --noEmit
[no stdout]
exit 0

$ pnpm exec vite build --outDir /tmp/morfra-field-audit-dist --emptyOutDir
✓ 253 modules transformed.
assets/index-*.js  2,319.* kB
(!) Some chunks are larger than 500 kB after minification.
exit 0

$ pnpm test
Test Files  3 failed | 133 passed (136)
Tests       3 failed | 1006 passed (1009)
FAIL StorageWorkspace.test.tsx: expected object omitted fieldOrder
FAIL ViewTools.test.tsx: expected conditional-color input "a", received ""
FAIL themeAudit.test.ts: FieldEditPage.tsx:16 contains bg-white
exit 1

$ CARGO_TARGET_DIR=/private/tmp/morfra-field-audit-cargo cargo test storage:: --lib -- --nocapture
test result: ok. 52 passed; 0 failed; 0 ignored
exit 0

$ cargo test
test result: FAILED. 64 passed; 7 failed; 1 ignored
provider failures: bind localhost -> Operation not permitted (os error 1)

$ cargo check --lib
Finished `dev` profile
exit 0

$ node /private/tmp/phase39-release-benchmark.cjs
TypeError: Cannot read properties of undefined (reading 'map')
DataGrid production viewport did not mount
exit 1; no P95 produced
```

Vite 的 hash 文件名和小数体积在日志截取时未作为证据保存，故以通配符/一位小数表示；核心事实是构建 exit 0、253 modules、主 chunk 约 2,319kB 与 >500kB 告警，不伪造缺失的小数。benchmark 使用仓库脚本的临时输出等价物，避免在唯一允许文件之外写入 `dist/`。

最新前端全量失败项：

1. `themeAudit.test.ts`：`FieldEditPage.tsx:16` 固定色。
2. `StorageWorkspace.test.tsx`：测试期待缺 `fieldOrder` 的旧结构。
3. `ViewTools.test.tsx`：条件填色输入 `a` 实际为空。

较早全量运行还出现筛选“需求”只保存首字符/计数不出现。隔离测试偶尔全绿，恰好说明它是时序/焦点竞争，不能按“重跑绿了”结案。

现有 Rust 52 项通过不能证明以下关键路径：

- 13 类型磁盘写入/清空/重开完整矩阵；
- 空字段名和 011 迁移；
- attachment clear 与所有 Undo；
- 完整 view config 故障注入和重开；
- table delete 全域恢复。

## 11. 下一 Agent 的修复批次

### 批次 0 · 先止住数据丢失

- H-05 记录/字段 Undo 附件丢失。
- H-09 表删除 Undo 不完整。
- H-08 选项删除确认与多引用决策缺失。
- 先写失败测试，再调整 backup schema/restore 事务；不要先改 UI。

### 批次 1 · 统一网格几何

- H-01 虚拟行 remeasure。
- H-02 header/body/editor/scroll 坐标统一；同时处理列宽 virtualizer 风险。
- 验收必须是 40→32→56→40 多轮，不能只看初始挂载。

### 批次 2 · 修复改名空值与迁移

- H-03 前端、Rust、SQLite、011 迁移及失败回滚。
- 既有字段按当前 Spec 继续从字段管理列表改名；不要误加与 `TABLE-002/TABLE-024` 冲突的既有表头入口。新字段的表头内联改名按 `FIELD-020/TABLE-031` 保留。

### 批次 3 · 附件单一写路径

- H-04 网格图片/文件编辑、清空、批量与搜索统一到 attachment API。
- 同时补 M-06 真实原名搜索。

### 批次 4 · 工具栏状态机

- H-07 筛选/填色单一受控草稿。
- M-07 启停、局部错误和重试。
- M-12 先统一筛选文档，再按确认方案排除两类或补可靠能力，并清理旧死规则。
- 修复后必须在组合/全量负载下重复运行，单文件绿不算通过。

### 批次 5 · 字段类型完整性

- H-06 13 类型直接创建。
- M-01～M-05 显示、allowCreate、多行、进度/货币、链接。
- M-13 选项键盘等价排序。
- 建立主标题 + 13 类型真实 DataGrid × SQLite 的写/清/取消/重开矩阵。

### 批次 6 · 门禁恢复

- M-09 主题；M-10 表头虚拟化和 benchmark；M-11 配置后端校验；L-01～03 测试/包体。
- 完成 960、1199、1200、全屏、浅深、横纵滚动和保存故障的实机验收。

## 12. Git 与非修改证明

开始与写报告前均为：

```text
branch: main
HEAD: afd755d2cdd3c1e071c14afde65e5cdda9c01055
modified:
  DEV-PLAN.md
  Design-Brief.md
  Product-Spec-CHANGELOG.md
  Product-Spec.md
  reqflow/src-tauri/src/storage/migrations.rs
  reqflow/src/components/fields/FieldEditPage.test.tsx
  reqflow/src/components/fields/FieldEditPage.tsx
  reqflow/src/components/fields/FieldEditor.tsx
  reqflow/src/components/fields/FieldManager.test.tsx
  reqflow/src/components/fields/FieldManager.tsx
  reqflow/src/components/fields/FieldTypePicker.test.tsx
  reqflow/src/components/fields/FieldTypePicker.tsx
  reqflow/src/components/storage/StorageWorkspace.tsx
  reqflow/src/components/table/DataGrid.interaction.test.tsx
  reqflow/src/components/table/editors/CellEditorHost.tsx
  reqflow/src/styles/global/05-table.css
untracked:
  reqflow/src-tauri/migrations/010_repair_field_foreign_keys.sql
```

上述改动在本轮开始前已经存在，未被本轮清理、覆盖、回滚或提交。临时 UI harness 已删除；构建和 Cargo 产物位于 `/tmp`。

报告完成后的最终只读对账：

```text
$ git status --short --untracked-files=all
 M DEV-PLAN.md
 M Design-Brief.md
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
?? reqflow/src-tauri/migrations/010_repair_field_foreign_keys.sql

$ git branch --show-current
main
$ git rev-parse HEAD
afd755d2cdd3c1e071c14afde65e5cdda9c01055

$ find docs/audits -maxdepth 2 -type f -print
docs/audits/2026-08-20-field-table-self-check.md

$ git diff --check
[no stdout]
exit 0
```

对开始时 16 个 modified 文件和 1 个 untracked migration 逐文件做 SHA-256 前后比对：**17/17 一致，0 mismatch**。因此本轮唯一新增的持久化仓库文件是：

`/Users/yichuangyang/项目/需求管理系统/docs/audits/2026-08-20-field-table-self-check.md`

---

最终门禁结论：**Stage 1 FAIL；Stage 2 SKIPPED。** 下一 Agent 不应从视觉微调开始，应先处理 H-05/H-09 数据安全，再处理 H-01/H-02 行高几何和 H-03 改名空值/迁移。
