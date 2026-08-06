# Development Plan — 需求管理系统（代号 reqflow）

> 本文件记录项目的开发阶段划分、当前进度和剩余工作。
> 新 session 启动时应首先阅读此文件，了解项目状态后再继续开发。

**项目代码目录**：`reqflow/`（工作代号，产品未定品牌名，仅作代码目录命名，不影响产品对外呈现）

**本次规划的拍板与假设**（供 dev-builder 直接沿用，不必重新确认）：
- 前端框架：React 19（已写回 Product-Spec Q-002，见 CHANGELOG v2.4）
- 深色模式：本版本不做，仅浅色（已写回 Product-Spec §8 非功能需求，见 CHANGELOG v2.4）
- 字体加载：设计稿用 jsdelivr CDN 引入 Geist 字体，与 Product-Spec §8 非功能需求"不联网、无遥测"（P0）冲突。这是实现细节层面的问题，不是视觉规范冲突，dev-planner 阶段直接定：改用 `@fontsource/geist-sans` + `@fontsource/geist-mono` 本地自托管字体包，视觉效果不变，不再联网请求字体
- 项目文件夹存储位置：Spec 未指定具体路径，方案：存放在 Tauri `appLocalDataDir()/projects/{projectId}/` 下，用户新建/切换/删除项目时不感知具体路径；仅在打开附件走 Finder 时才会涉及真实路径
- 顶栏"设置入口"（REQ-002）：Phase 1-12 阶段 Spec 未定义设置内容，只渲染按钮不带功能（历史决策）。MVP 完成后 Spec 已补 REQ-023「检查更新」，设置入口在 Phase 13 首次真正激活，见下方 Phase 13
- Markdown 正文存储：使用 Tiptap 官方 `@tiptap/markdown` 扩展做 JSON↔Markdown 双向转换，正文 Tab 内容以标准 Markdown 文本写入 `.md` 文件正文区（而非只存 Tiptap JSON），保证 REQ-019"文件在应用外可用任何文本编辑器打开阅读"
- Frontmatter 解析库变更（Phase 2 阶段实测发现）：原计划用 `gray-matter`，实测其内部用 `eval()` 解析部分 YAML 分支（`gray-matter/lib/engines.js`），在浏览器打包环境下触发 rolldown 的 eval 安全警告，且其依赖的 `js-yaml@3.x` 有 `Buffer` externalized 警告（Tauri 前端跑在 WebView/浏览器环境，无 Node Buffer）。改为直接用 `js-yaml`（具名导出 `dump`/`load`）+ 手写的 frontmatter 分隔符解析（约 20 行，按 `---\n...\n---\n` 分隔提取 YAML 块和正文），避免引入有 eval 的第三方包

**Phase 13 规划的拍板与假设**（MVP 完成后新增，见 Product-Spec CHANGELOG v2.5 / REQ-023）：
- 应用内下载文件的技术方案：WebSearch 确认 Tauri 官方 `@tauri-apps/plugin-upload`（当前最新 2.4.0）的 `download(url, filePath, progressHandler, headers?)` API 直接满足"下载 dmg + 进度回调"需求，不需要手写流式下载或引入非官方方案
- 下载完成后打开 dmg：复用 Phase 6 已引入的 `@tauri-apps/plugin-opener`（`openPath`），调用系统默认程序打开下载好的 dmg 文件，触发系统安装窗口，不需要新增插件
- GitHub Actions 发布流水线技术方案：WebSearch 确认官方 `tauri-apps/tauri-action@v1` 支持一键构建+创建 Release+上传产物，比手写 build+upload-release-asset 组合步骤更省心且是官方维护；官方默认示例按 push 到 release 分支触发，本项目按 Spec 拍板改为 `on: push: tags: ['v*']` 触发，只打 macOS aarch64 单一目标（`--target aarch64-apple-darwin`），不构建 Intel/Linux/Windows（与现有 SCOPE-006 macOS 专用一致）
- 版本号比较：前端手写 semver 比较（三段式 major.minor.patch 数值比较即可，不引入 `semver` npm 包这种量级不匹配的重依赖，比较逻辑不到 10 行）
- GitHub API 请求：检查更新用 `@tauri-apps/plugin-http`（Tauri 官方 HTTP 客户端插件，绕过浏览器 CORS 限制访问 `api.github.com`），不用浏览器原生 `fetch`（Tauri WebView 环境下对第三方域名的 fetch 需要显式 capabilities 权限，plugin-http 是官方推荐路径）
- 仓库地址硬编码位置：GitHub API 请求的 owner/repo 路径（`yichuanyang115-creator/reqflow`）作为编译期常量写死在前端代码里，不做成可配置项，非通用开源模板

---

## Phase 1: 应用骨架与桌面壳

**交付内容**：
- 搭建 Tauri v2 + React 19 + TypeScript + Vite 桌面应用骨架，配置 fs/dialog/opener 插件权限
- 实现顶栏 + 两栏（主内容区+详情面板）静态布局容器，套用 Design-Brief 视觉 tokens（背景色、间距、圆角、字体）
- 应用可打包为 macOS 窗口并正常打开

**关键文件**：
- `reqflow/src-tauri/tauri.conf.json` — 窗口配置、插件注册
- `reqflow/src-tauri/capabilities/default.json` — fs/dialog/opener 权限范围（限定到 appLocalDataDir）
- `reqflow/src-tauri/Cargo.toml` — Rust 依赖声明
- `reqflow/src-tauri/src/lib.rs` — Tauri builder 入口，注册插件
- `reqflow/src/main.tsx` — React 挂载入口
- `reqflow/src/App.tsx` — 顶栏 + 两栏布局容器
- `reqflow/src/components/topbar/Topbar.tsx` — 顶栏骨架（项目名占位、搜索框占位、设置图标、面板收放开关）
- `reqflow/src/styles/tokens.css` — 色彩/间距/圆角/字体 CSS 变量（对应 Design-Brief §5）
- `reqflow/tailwind.config` 相关配置（Tailwind v4 用 CSS-first `@theme`，一般无需单独 config 文件，tokens 直接写在 `tokens.css` 内）

**验收标准**：
- `pnpm tauri dev` 能启动，看到顶栏 + 空白主内容区 + 空白详情面板三块布局，视觉背景色/字体符合 Design-Brief 浅色蓝白基调
- `pnpm tauri build` 能成功打包出 .app

---

## Phase 2: 多项目管理

**交付内容**：
- 实现 Project 数据模型的创建/读取/切换/删除，落盘为 `_project.md`
- 顶栏项目名点击弹出项目列表弹窗（切换 / 新建 / 删除，删除二次确认）
- 只有一个项目时不显示删除选项；新建后自动切换；删除后切换到列表第一个项目

**关键文件**：
- `reqflow/src/types/models.ts` — Project/Requirement 等实体类型定义（本 Phase 先定 Project）
- `reqflow/src/lib/fs.ts` — 封装 `@tauri-apps/plugin-fs` 的读/写/建目录/删目录方法
- `reqflow/src/lib/paths.ts` — 项目路径计算（`appLocalDataDir()/projects/{projectId}/`）
- `reqflow/src/stores/projectStore.ts` — zustand store，管理当前项目、项目列表、切换/新建/删除逻辑
- `reqflow/src/components/topbar/ProjectSwitcher.tsx` — 项目列表弹出组件（对应 CMP proj-popover）
- `reqflow/src/components/shared/ConfirmDialog.tsx` — 通用二次确认弹窗（后续删除类操作复用）

**验收标准**：
- 新建项目后顶栏项目名更新，且能在项目列表间来回切换
- 删除项目需二次确认，确认后正确切换到列表第一项，磁盘目录同步删除

---

## Phase 3: 看板主视图 + 需求创建

**交付内容**：
- 实现 Requirement 数据模型的创建/读取/更新，落盘为 `{id}.md`（YAML frontmatter + Markdown 正文）
- 看板 7 个阶段区域纵向堆叠展示，每区域标题显示阶段名 + 数量，可折叠展开
- 每区域（归档除外）标题行"新建"按钮，行内输入框回车创建需求
- 需求行按 REQ-001 规则显示字段（名称/优先级/负责人/创建时间/截止日期/停留天数/总耗时/进度%）
- 空状态（全局空 / 单区域空）、加载骨架屏、文件读取错误提示

**关键文件**：
- `reqflow/src/lib/frontmatter.ts` — 已在 Phase 2 建好（js-yaml 手写 parse/stringify），本 Phase 直接复用，无需新建
- `reqflow/src/stores/requirementStore.ts` — zustand store，管理当前项目下所有需求的增删改查
- `reqflow/src/components/board/Board.tsx` — 看板主容器，7 区域纵向堆叠 + 滚动
- `reqflow/src/components/board/StageSection.tsx` — 单阶段区域（标题行 + 折叠 + 需求行列表）
- `reqflow/src/components/board/RequirementRow.tsx` — 需求行组件（对应 CMP-001）
- `reqflow/src/components/board/QuickAddInput.tsx` — 行内新建输入框（对应 CMP-003）
- `reqflow/src/components/shared/EmptyState.tsx` / `Skeleton.tsx` — 空状态与加载骨架屏

**验收标准**：
- 在"收集"区域新建条目回车后立即出现在该区域行中，字段自动计算（停留天数=0、总耗时=0）
- 项目无需求时中央显示引导文案；单个区域为空时显示"该阶段暂无需求"
- 关闭应用重新打开，之前创建的需求仍能正确加载显示

---

## Phase 4: 需求详情页骨架 + 属性区

**交付内容**：
- 点击看板行，右栏切换为该需求详情，头部显示可编辑名称 + 收起/全屏按钮
- 属性区常驻渲染：优先级、负责人、来源（含自定义入口）、进度%、阶段（只读展示，暂不可流转）、阶段专属只读槪位、截止日期、创建时间
- Tab 栏渲染 5 个 Tab（正文/产出/任务/验收/活动），仅正文 Tab 占位可点击，其余 Tab 先占位
- 右栏收起（0 宽度）/ 全屏（占满主内容区，顶栏保留）/ 默认三态切换

**关键文件**：
- `reqflow/src/components/detail/DetailPanel.tsx` — 右栏容器，三态切换逻辑
- `reqflow/src/components/detail/DetailHeader.tsx` — 名称可编辑 + 收起/全屏按钮
- `reqflow/src/components/detail/AttributeGrid.tsx` — 属性区字段渲染（对应 REQ-004 规则）
- `reqflow/src/components/detail/TabBar.tsx` — 5 Tab 导航（对应 CMP-007）
- `reqflow/src/stores/uiStore.ts` — 右栏展开状态、当前选中需求、当前激活 Tab

**验收标准**：
- 点击任意需求行，右栏正确显示该需求名称和全部属性字段，且编辑后实时写入对应 `.md` 文件的 frontmatter
- 收起/展开/全屏三态切换效果正确，主内容区宽度联动

---

## Phase 5: 正文 Tab（Block Editor）

**交付内容**：
- 集成 Tiptap，实现段落/标题/列表/代码块/图片/引用的 Block editor
- 实现多套模板抽屉（功能需求模板、优化需求模板），用户手动点击插入引导文字
- 编辑内容通过 `@tiptap/markdown` 序列化为 Markdown，实时写入需求 `.md` 文件正文区

**关键文件**：
- `reqflow/src/components/editor/BlockEditor.tsx` — Tiptap 编辑器封装（对应 REQ-005）
- `reqflow/src/components/editor/TemplateDrawer.tsx` — 模板选择抽屉（对应设计稿 template-rail）
- `reqflow/src/lib/templates.ts` — 模板内容定义（功能需求模板/优化需求模板引导文字）
- `reqflow/src/components/detail/tabs/BodyTab.tsx` — 正文 Tab 容器，接入 BlockEditor + TemplateDrawer

**验收标准**：
- 正文 Tab 可输入段落/标题/列表/代码块/图片/引用并正常渲染
- 点击模板抽屉插入引导文字后可自由编辑或删除
- 关闭重开应用，正文内容原样保留（含格式）

---

## Phase 6: 产出 Tab

**交付内容**：
- 产出条目增删、勾选完成、名称必填
- 每条产出最多挂一个文件或链接，文件走系统上传对话框，链接为文本输入自动识别 URL
- 文件点击用系统默认应用打开，链接点击用浏览器打开；"移除附件"只清除附件保留条目
- 属性区"产出"槪位联动显示完成数/总数（如 1/3），仅在设计阶段展示

**关键文件**：
- `reqflow/src/components/detail/tabs/DeliverablesTab.tsx` — 产出列表容器（对应 REQ-007）
- `reqflow/src/lib/attachments.ts` — 封装 `@tauri-apps/plugin-dialog`（文件选择）与 `@tauri-apps/plugin-opener`（打开文件/URL）

**验收标准**：
- 新建产出条目、勾选完成、挂文件、挂链接、移除附件均正确落盘且刷新后保留
- 点击文件附件用 Finder/默认应用打开，点击链接附件用浏览器打开
- 属性区产出槪位数字随勾选状态实时更新

---

## Phase 7: 任务 Tab

**交付内容**：
- 任务增删，字段：名称（必填）、负责人、截止日期、进度%（手动填）、状态（三态循环）
- 阻塞开关独立于状态，任意状态下可叠加标记，标记后可展开填阻塞原因
- 属性区"任务"槪位联动显示完成数/总数，仅在开发阶段展示

**关键文件**：
- `reqflow/src/components/detail/tabs/TasksTab.tsx` — 任务列表容器（对应 REQ-006）

**验收标准**：
- 新建/编辑/删除任务正确落盘；状态点击按 待开始→进行中→完成→待开始 循环
- 阻塞开关可在任意状态下独立切换，不影响状态循环；阻塞原因可选填写
- 属性区任务槪位数字随任务完成状态实时更新

---

## Phase 8: 验收 Tab

**交付内容**：
- 验收标准增删，字段：描述（必填）、结果（三态按钮：通过/不通过/未验证，默认未验证）
- 结果为"不通过"时可展开填写不通过原因
- 属性区"验收"槪位联动显示通过数/总数，仅在验证阶段展示

**关键文件**：
- `reqflow/src/components/detail/tabs/AcceptanceTab.tsx` — 验收列表容器（对应 REQ-006）

**验收标准**：
- 新建/编辑/删除验收条目正确落盘；三态结果按钮任一时刻只有一个生效
- 不通过原因仅在结果为"不通过"时可填写并保留
- 属性区验收槪位数字随通过状态实时更新

---

## Phase 9: 自由流转 + 活动 Tab

**交付内容**：
- 属性区阶段字段点击弹出下拉（除当前阶段外的 6 阶段 + "废弃"），选中立即流转，无确认弹窗
- 看板行拖拽到目标区域同样触发流转（引入 dnd-kit 跨区域拖拽）
- 流转自动记录 TransitionRecord（时间+从哪到哪+触发人），活动 Tab 以时间线节点展示
- 每个节点可展开填写说明（可选）、节点下可发表评论、当前阶段最后节点高亮
- 节点右上角可删除该流转记录（危险操作，二次确认，说明和评论一并删除，不可撤销）
- 选择"废弃"：直接归档，closureType 设为 abandoned

**关键文件**：
- `reqflow/src/components/detail/StageTransitionDropdown.tsx` — 阶段流转下拉（对应 CMP-011）
- `reqflow/src/components/detail/tabs/ActivityTab.tsx` — 活动 Tab 时间线容器（对应 REQ-008）
- `reqflow/src/stores/requirementStore.ts` — 流转事件生成逻辑（`transitionRequirement`/`updateTransitionNote`/`addComment`/`removeTransition`，新增 TransitionRecord + 更新 Requirement.stage 的原子操作；实测发现内联在 store 里比单独 `lib/transitions.ts` 更贴合 zustand 的 mutate 模式，未单独建文件）
- `reqflow/src/components/board/Board.tsx` — 引入 `@dnd-kit/core` + `@dnd-kit/sortable` 实现跨区域拖拽（本 Phase 补充修改）

**验收标准**：
- AC-013/AC-014：设计阶段需求点击阶段字段选"开发"，立即出现在开发区域，活动 Tab 新增"设计→开发"节点，可在节点旁加评论
- AC-016/AC-017/AC-018：需求经 2 次流转后活动 Tab 显示 2 个节点（初始阶段不生成节点）；节点可加评论；删除节点需二次确认，确认后节点及说明评论一并消失
- 看板拖拽需求行到其他区域效果与属性区流转一致，自动记录节点
- 流转到当前同一阶段时看板拖拽回原位无效果

---

## Phase 10: 归档与恢复 + 发布信息

**交付内容**：
- 归档区域标题行为搜索框（非排序控制），按最近流转时间倒序展示需求
- 归档行简化列：名称/优先级/负责人/创建时间/截止日期/总耗时（冻结）/归档时间/完成或废弃标记
- 归档需求可点击查看详情（可编辑）、可恢复到活跃阶段（清除 closureType，进度清零）
- 发布区域行内可编辑发布方式（全量/灰度/分批，非必填）+ 发布时间（默认当前日期）

**关键文件**：
- `reqflow/src/components/board/ArchiveSearch.tsx` — 归档区域搜索框（对应 CMP-005 Search 变体）
- `reqflow/src/components/board/StageSection.tsx` — 归档/发布区域的行渲染差异化（本 Phase 补充修改）
- `reqflow/src/stores/requirementStore.ts` — 恢复逻辑（清除 closureType，进度归零，本 Phase 新增方法，沿用 Phase 9 流转方法的落点）

**验收标准**：
- 需求流转到归档后出现在归档区域，显示归档时间和完成/废弃标记，总耗时冻结不再增长
- 归档区域按名称搜索能正确过滤；点击归档需求可查看/编辑详情
- 恢复操作后需求回到目标活跃阶段，closureType 清空，进度清零
- 发布阶段行内可直接编辑发布方式和发布时间

---

## Phase 11: 排序与全局搜索

**交付内容**：
- 各阶段区域（归档除外）标题行排序控制：可选排序字段和方向，拖拽调整顺序后自动切到"手动"排序
- 顶栏搜索框：输入即时搜索需求名称，结果下拉浮层展示，点击跳转到对应需求详情（不替换主内容区）

**关键文件**：
- `reqflow/src/components/board/SortControl.tsx` — 排序控制组件（对应 CMP-005 Grouped 变体的排序面板）
- `reqflow/src/components/topbar/SearchBox.tsx` — 顶栏搜索框 + 下拉浮层（对应 REQ-002）
- `reqflow/src/stores/requirementStore.ts` — 补充排序状态与搜索过滤逻辑（本 Phase 补充修改）

**验收标准**：
- 切换排序字段/方向后区域内需求行重新排列；手动拖拽调整顺序后排序状态自动变为"手动"
- 顶栏输入需求名称关键字，下拉浮层展示匹配结果，无匹配时提示"没有匹配的需求"；点击结果正确跳转右栏详情

---

## Phase 12: 收尾打磨与打包

**交付内容**：
- 停留天数/总耗时字段跨所有区域正确自动计算并展示
- 统一检查所有 P0 flow 的空状态/加载状态/错误状态文案与视觉一致性
- 设置入口按钮渲染（点击暂无功能，Spec 未定义具体内容，见本文档开头说明）
- 完整走通 9. 完成定义 中的全部 MVP 检查项
- `pnpm tauri build` 产出可分发的 macOS .app

**关键文件**：
- 无新增核心文件，本 Phase 为跨文件的检查与小修（涉及 Board/DetailPanel/各 Tab 组件的状态分支补全）

**验收标准**：
- Product-Spec §9 完成定义 全部检查项通过
- `pnpm tauri build` 成功产出 .app，双击可独立启动，脱离开发环境正常运行

**完成情况**（四步走验证，2026-07-23）：
- Code Review：code-reviewer 两阶段 PASS，2 个收尾 commit（错误状态健壮性修复 + 测试补全）均在范围内，无超范围改动
- 测试完整性：跑查时发现多项目管理（REQ-018/FLOW-009）此前零测试覆盖，补齐 store CRUD + ProjectSwitcher 组件交互测试；`vitest run` 23 files / 241 tests 全通过
- 编译验证：`tsc --noEmit` 零错误
- 功能测试：`pnpm tauri build` 产出 reqflow.app + dmg；用独立 HOME 目录（非开发环境、非生产数据）启动打包后的 .app，验证默认项目自动创建、新建需求→落盘 Markdown（YAML frontmatter + 可读正文）全链路走通，符合 REQ-019
- Product-Spec §9 完成定义 10 项全部勾选

Phase 12 完成，MVP 全部 Phase（1-12）交付完毕。

---

## Phase 13: 检查更新 + 自动发布流水线

**交付内容**：
- 顶栏"设置"入口首次真正激活：点击弹出设置面板，展示当前应用版本号 + "检查更新"按钮
- 检查更新：用户手动点击才联网请求 GitHub Releases API，按 semver 比较最新正式 Release（跳过 pre-release/draft）的 tag（`v{major}.{minor}.{patch}`）与当前版本
- 已是最新版本：面板内文字提示"已是最新版本"
- 有新版本：面板展示新版本号 + 更新说明 + 下载按钮，点击后应用内下载对应 dmg（带进度条），下载完成自动打开系统安装窗口
- 网络请求失败、下载失败：面板内联错误提示，用户可重新点击手动重试（不自动无限重试；下载失败清理残片文件）
- 新增 GitHub Actions workflow：推送 `v*` 格式 git tag 时自动触发，`pnpm tauri build` 打包 macOS aarch64 版本、创建 GitHub Release、上传 dmg 产物；日常 push 到 main 分支不触发任何构建或发布

**关键文件**：
- `reqflow/src-tauri/Cargo.toml` — 新增 `tauri-plugin-http`、`tauri-plugin-upload` Rust 依赖
- `reqflow/package.json` — 新增 `@tauri-apps/plugin-http`、`@tauri-apps/plugin-upload` 依赖
- `reqflow/src-tauri/src/lib.rs` — 注册 http/upload 插件
- `reqflow/src-tauri/capabilities/default.json` — 新增 http 插件权限，限定请求域名为 `api.github.com` 和 GitHub Release 下载域名（`github.com`、`objects.githubusercontent.com`），不开放任意域名
- `reqflow/src/lib/updater.ts` — 封装检查更新逻辑：请求 GitHub Releases API、过滤 pre-release/draft、semver 比较（手写比较函数，见文档开头拍板）、返回是否有新版本+新版本信息
- `reqflow/src/lib/semver.ts` — 手写 semver 三段式版本号比较纯函数
- `reqflow/src/components/topbar/SettingsPanel.tsx` — 设置面板组件（对应 REQ-023）：版本号展示、检查更新按钮、各状态（检查中/已最新/有新版本/下载中/失败）渲染
- `reqflow/src/components/topbar/Topbar.tsx` — 接入 SettingsPanel，设置按钮从纯占位改为可点击弹出面板（本 Phase 修改）
- `reqflow/src/stores/updateStore.ts` — zustand store，管理检查更新的状态机（idle/checking/up-to-date/available/downloading/error）、下载进度、下载完成后调用 opener 打开 dmg
- `.github/workflows/release.yml` — GitHub Actions 发布流水线，`tauri-apps/tauri-action@v1`，触发条件 `on: push: tags: ['v*']`，只构建 `macos-latest` + `--target aarch64-apple-darwin`

**验收标准**：
- 点击顶栏设置图标弹出面板，正确显示当前 package.json 版本号
- 点击"检查更新"，无新版本时面板提示"已是最新版本"；有新版本（可用测试用的临时 mock Release 验证）时展示版本号、更新说明、下载按钮
- 断网状态下点击"检查更新"，面板内联提示网络错误，不弹系统对话框，重新联网后可再次点击重试
- 点击下载后面板展示进度条，下载完成自动弹出 dmg 系统安装窗口
- 推送一个 `v*` 格式 tag 到 GitHub 后，Actions 自动跑完打包并在 Releases 页面生成对应 dmg；日常 push 到 main 分支不触发该 workflow

---

## Phase 14: 独立对话框栏位（三栏布局重构，REQ-003 / REQ-024 v2.8）

> 本 Phase 因 Product-Spec REQ-003 / REQ-024 v2.8 变更再次整体改写（第二次推翻重做，上一版本是 v2.7 的顶栏开关改造，commit `846097d`）。核心变化：对话框从"挤在详情面板内部的剩余空间"改成看板/详情面板同级的独立第三栏，拥有自己的分隔条和持久化宽度；详情面板不再有固定像素宽度，改为自适应填满剩余空间，底线 480px；对话框显隐彻底和详情面板收起/全屏状态解耦，v2.7 的"面板收起时强制隐藏对话框"和"剩余空间不足时开关按钮置灰"两条规则均被推翻。回 dev-builder 时旧的 `chatPanelWidth`（按详情面板剩余空间倒算对话框宽度）、`DETAIL_CONTENT_MAX_WIDTH=660` 常量、`ChatToggle` 的 disabled/置灰逻辑全部要删，不是在原有基础上加。

**交付内容**：
- 对话框成为看板和详情面板之外的第三栏，拥有自己独立的分隔条（可拖拽），默认宽度 320px，拖拽范围 [240px, 动态上限]；动态上限 = 视口宽度 − 看板宽度 − 分隔条(6px) − 详情面板底线 480px，超出上限时详情面板优先保住 480px，对话框不能继续拖宽
- 对话框拖拽后的宽度和开关状态一样全局唯一、随当前项目落盘，切换项目后各自独立恢复
- 详情面板不再有固定像素宽度：自适应填满"看板宽度 + 分隔条 + 对话框宽度（如已打开）"之外的全部剩余空间；正文/属性区内容可读性上限从 660px 改为 960px，面板实际宽度 >960px 时内容居中或靠左显示、超出部分留白，<960px 时内容跟随面板宽度收缩，不再有固定限宽
- 详情面板宽度逼近 480px 底线时，属性区从两列网格收缩为单列（无中间过渡态）；Tab 栏任何宽度下都保持文字形态，不切图标、不截断、不换行
- 三种面板模式下的列结构：收起（0 宽度）时无详情列，主内容区和对话框（如已打开）一起撑满剩余空间；展开时看板+详情面板+对话框（如已打开）三列或两列；全屏时详情占满主内容区位置，对话框仍按开关状态独立显示在右侧，顶栏保留
- 对话框显隐彻底和详情面板状态解耦：面板收起、全屏、未选中需求，均不影响对话框按自己开关状态显示/隐藏；本版本移除 v2.7 遗留的"剩余空间不足时开关按钮置灰"逻辑，开关按钮始终可点击（Spec v2.8 已不再要求这条置灰规则）

**关键文件**：
- `reqflow/src/lib/boardWidth.ts` — 重写：`DETAIL_MIN_WIDTH` 由 360 改为 480；删除 `chatPanelWidth(detailPanelWidth)`（原按详情面板剩余空间倒算对话框宽度的方式，已不适用于独立成栏后的对话框）；新增对话框宽度的独立 clamp 函数，入参含当前看板宽度和视口宽度，输出 [240, 动态上限] 区间内的合法宽度；`detailPanelWidthFor` 按新的三栏/两栏模式重新计算（collapsed 时详情为 0 但主内容区要吃对话框让出之外的剩余空间；fullscreen 时详情占满主内容区位置但要让出对话框宽度）
- `reqflow/src/lib/boardWidth.test.ts` — 重写：480 底线的边界用例；对话框独立拖拽范围的边界用例（240 下限、动态上限、详情面板优先保留 480px 导致对话框被限宽的情形）
- `reqflow/src/styles/tokens.css` — `--detail-max-w` 由 660px 改为 960px
- `reqflow/src/stores/chatStore.ts` — frontmatter 新增 `width: number` 字段（默认 320），`loadForProject` 读取旧数据缺该字段时补默认值；新增设置宽度并落盘的方法（复用现有 `persist` 逻辑，签名追加 width 参数）
- `reqflow/src/stores/chatStore.test.ts` — 覆盖 width 字段的默认值读取、设置宽度后的落盘
- `reqflow/src/stores/uiStore.ts` — `setBoardWidth` 的 clamp 计算需要把对话框当前宽度也纳入视口占用考虑：看板拖宽如果会把对话框挤到小于 240px，看板拖拽上限相应收紧
- `reqflow/src/components/layout/MainLayout.tsx` — 重写 grid 结构：从"看板+详情面板(1fr)两列、对话框内嵌在详情面板容器里"改成看板/详情面板/对话框三个独立列（详情面板给 `1fr`，看板和对话框给像素值），新增第二条分隔条（对话框和详情面板之间）及其拖拽 handler（复用看板分隔条已有的 pointer 事件模式）；按 collapsed/expanded/fullscreen 三种模式重新计算 gridTemplate；详情面板容器不再用固定的 `var(--detail-max-w)` 限宽，改为按实际计算出的面板宽度决定是否加 960px 上限
- `reqflow/src/components/detail/AttributeGrid.tsx` — 新增 `compact: boolean` prop（由 DetailPanel 根据实际详情面板宽度是否逼近 480px 底线传入），为真时 `gridTemplateColumns` 从两列（`58px minmax(0,1fr) 58px minmax(0,1fr)`）切到单列（`58px minmax(0,1fr)`），无中间过渡态
- `reqflow/src/components/detail/DetailPanel.tsx` — 新增 `width: number` prop（MainLayout 传入实际计算出的详情面板宽度），据此算出 `compact` 布尔值传给 `AttributeGrid`，并在内容包裹层根据宽度是否超过 960px 决定是否限宽居中
- `reqflow/src/components/topbar/ChatToggle.tsx` — 删除 `spaceAvailable`/`disabled` 相关逻辑和悬浮提示文案（v2.8 已移除"剩余空间不足置灰"规则），改为始终可点击的纯开关按钮
- `reqflow/src/components/topbar/ChatToggle.test.tsx` — 删除 disabled 态相关断言，保留点击切换的测试
- `reqflow/src/components/topbar/Topbar.tsx` — 不再需要计算并传入 `spaceAvailable` 给 `ChatToggle`（本 Phase 修改，去掉这部分逻辑）

**验收标准**：
- 对话框打开时显示独立分隔条，可单独拖拽调整宽度，默认 320px；拖到 240px 以下无效（停在 240px）；拖宽时如果会把详情面板挤到小于 480px，对话框停在让详情面板刚好保持 480px 的宽度
- 拖拽看板分隔条改变看板宽度，详情面板宽度自适应联动变化（跟随剩余空间），对话框宽度不受影响（除非会把详情面板挤破 480px 底线）
- 详情面板宽度 >960px 时正文/属性区内容居中或靠左显示在 960px 内，两侧留白；宽度 <960px（如对话框打开挤占后）时内容跟随实际宽度收缩，不再有固定限宽
- 详情面板宽度逼近 480px 底线时属性区从两列变单列；此前任意宽度下都保持两列，无中间态；Tab 栏文字任何宽度下都不截断、不换行、不变图标
- 点击详情面板收起按钮，看板和对话框（如打开）撑满剩余空间，无详情列；点击全屏，详情占据看板位置，对话框仍按自己开关状态显示/隐藏
- 关闭应用重新打开，对话框的开关状态和拖拽后的宽度都按上次保存的状态恢复（用文本编辑器打开项目目录下的对话记录文件能看到 width 字段）
- 未选中任何需求或详情面板收起时，顶栏对话框开关按钮始终可点击（不再有置灰态）

---

## 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 桌面框架 | Tauri | 2.11.5（Rust crate）/ 2.11.1（@tauri-apps/api）/ 2.11.4（@tauri-apps/cli） | macOS 桌面壳，Rust 后端 + 系统 WebView |
| 前端框架 | React | 19.2.8 | 已拍板，见文档开头 |
| 语言 | TypeScript | 7.0.2 | 官方 Go 原生编译器重写版，2026-07-08 发布稳定版，安装方式不变 |
| 构建工具 | Vite | 8.1.5 | 配合 @tailwindcss/vite 插件 |
| 样式方案 | Tailwind CSS | 4.3.3（含 @tailwindcss/vite 4.3.3） | CSS-first `@theme`，承载 Design-Brief 视觉 tokens |
| 状态管理 | Zustand | 5.0.14 | 轻量，无 Provider 样板代码 |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable | 6.3.1 / 10.0.0 | 看板跨区域拖拽 + 区域内手动排序 |
| 富文本编辑器 | @tiptap/react + @tiptap/starter-kit + @tiptap/pm + @tiptap/markdown | 3.28.0（全部同版本） | Headless block editor + 官方 Markdown 双向转换扩展 |
| Frontmatter 解析 | js-yaml | 5.2.1 | 自实现 parse/stringify frontmatter（见下方变更说明），不用 gray-matter |
| ID 生成 | nanoid | 6.0.0 | 生成 Project/Requirement 等实体 id |
| 字体 | @fontsource/geist-sans + @fontsource/geist-mono | 5.3.0 | 本地自托管，替代设计稿 CDN 引入方式（理由见文档开头） |
| Tauri 插件（fs） | @tauri-apps/plugin-fs + tauri-plugin-fs（Rust） | 2.5.1 | 本地文件读写 |
| Tauri 插件（dialog） | @tauri-apps/plugin-dialog + tauri-plugin-dialog（Rust） | 2.7.2 | 产出附件的系统文件选择对话框 |
| Tauri 插件（opener） | @tauri-apps/plugin-opener + tauri-plugin-opener（Rust） | 2.5.4 | 用默认应用/浏览器打开文件或链接 |
| Tauri 插件（http） | @tauri-apps/plugin-http + tauri-plugin-http（Rust） | 使用前 WebSearch 确认最新版本 | Phase 13 新增，请求 GitHub Releases API（限定域名 api.github.com） |
| Tauri 插件（upload） | @tauri-apps/plugin-upload + tauri-plugin-upload（Rust） | 2.4.0 | Phase 13 新增，`download()` API 应用内下载 dmg 并回调进度 |
| CI 发布 | tauri-apps/tauri-action | v1 | Phase 13 新增，GitHub Actions 官方维护 action，按 tag 触发打包+建 Release+传产物 |
| 包管理器 | pnpm | 项目既有约定（见 .claude/hooks 中 `pnpm dev` 引用） | — |

## 数据文件结构

> 本项目无数据库，数据以 Markdown 文件落盘（Product-Spec REQ-019），此表替代模板的"数据库表"章节，标注各实体的存储位置与所属 Phase。

| 实体 | 存储位置 | 所属 Phase |
|------|---------|-----------|
| Project | `appLocalDataDir()/projects/{projectId}/_project.md`（YAML frontmatter 存 id/name） | Phase 2 |
| Requirement | `appLocalDataDir()/projects/{projectId}/{requirementId}.md`（frontmatter 存结构化字段，正文区存 Markdown 富文本） | Phase 3 |
| Deliverable / Task / AcceptanceCriterion / TransitionRecord / Comment | 均作为 Requirement frontmatter 内的嵌套数组字段，随需求文件一并读写，无独立文件 | Phase 6 / 7 / 8 / 9 |
| ChatState | `appLocalDataDir()/projects/{projectId}/_chat.md`（frontmatter 存 open 开关状态 + width 拖拽宽度，正文区或 frontmatter 存 messages） | Phase 14 |

## 开发规则

- 每完成一个 Phase 执行四步走：Code Review → 测试完整性 → 编译验证 → 功能测试
- 四步走全部通过后才能 commit
- Commit message 用 feat、fix、refactor、chore 前缀
- 包管理器：pnpm
- Phase 顺序不可打乱：基础设施（1-2）→ 核心看板与详情骨架（3-4）→ 各 Tab 业务功能（5-8）→ 流转与归档（9-10）→ 排序搜索与收尾（11-12）→ MVP 完成后新增（13-14）→ Schema 改造（15-26）

---

## Schema 改造（Phase 15-26）

> 以下 Phase 实现动态 Schema 引擎，对应 Product-Spec SCOPE-012~016、REQ-025~029。
> 设计决策详见 `Schema-自定义机制-讨论稿.md`（终稿）。
> AI 对话生成 Schema 不进本次改造（OUT-007），见 `AI-Schema生成-设计方案.md`。

**本轮规划的拍板与假设**：
- Schema 存储格式：JSON（`schema.json`），存在项目目录下，与实体 .md 文件平级
- 视图偏好（列宽/列序/隐藏/冻结/筛选/排序）包含在 schema.json 内，不单独建文件
- 模板存储位置：`appLocalDataDir()/templates/{templateId}.json`
- 属性 ID 生成：复用 nanoid
- Undo 实现方案：zustand temporal middleware（命令模式，栈深 50）
- 阶段颜色预设色板：8 色，HSL 均匀分布

---

## Phase 15: Schema 数据模型 + 迁移逻辑

**交付内容**：
- 定义 Schema 类型结构（stageOptions、attributes、tabs、viewPreferences）
- 实现 schemaStore：读写 schema.json、CRUD 阶段/属性/Tab 的底层方法
- 实现迁移逻辑：检测旧项目（无 schema.json）→ 从现有硬编码字段生成等价 Schema → 写入 schema.json
- 迁移完成后 toast 提示
- Entity 数据读写适配：frontmatter 字段从硬编码 key 切换为 schema-driven key（兼容读取旧格式）

**关键文件**：
- `reqflow/src/types/schema.ts` — Schema/StageOption/Attribute/TabDefinition/ViewPreferences 类型定义
- `reqflow/src/stores/schemaStore.ts` — zustand store，管理当前项目 Schema 的全部 CRUD
- `reqflow/src/lib/migration.ts` — 旧项目检测 + 等价 Schema 生成 + 写入
- `reqflow/src/lib/schemaDefaults.ts` — 空白项目默认 Schema（Name + Stage 一个"默认"选项）、reqflow 模板 Schema 定义
- `reqflow/src/stores/requirementStore.ts` — 改造：读写 frontmatter 时走 schema 映射而非硬编码 key（大改）
- `reqflow/src/types/models.ts` — Entity 类型从固定字段改为 `attributeValues: Record<string, any>`

**验收标准**：
- 打开旧项目时自动生成 schema.json，内容与原硬编码字段等价（优先级=单选、负责人=文本、来源=单选...）
- 迁移后 toast 提示出现
- 迁移后原有实体数据正常加载显示（不丢值）
- 新建项目（空白）生成只含 Name + Stage 的 schema.json

**范围调整**（执行时与用户确认，见下方"完成情况"）：本 Phase 单独执行会导致 Requirement 类型改造后、UI 组件尚未跟上而编译不过的中间状态，违反本项目"commit 前 tsc 必须过"的硬性门禁。经确认后范围扩大为"类型+store+迁移逻辑+让现有组件读新数据结构的最小接线"，让现有组件（RequirementRow/AttributeGrid/StageTransitionDropdown/ActivityTab/requirementSort）改为通过 `lib/requirementFields.ts` 的 getter 读 `attributeValues`，但视觉和交互保持与 Phase 14 完全一致——不做本属于 Phase 16/17 的动态渲染工程（看板动态列生成、BoardHeader、FieldCell、Schema 设置页等）。`closureType` 按 Schema 讨论稿 §16 消解为用户自建属性的使用惯例，但旧数据里的该字段迁移时映射进具体的"结果"单选属性（选项：完成/废弃），不丢数据（REQ-029）。

**完成情况**（四步走验证，2026-07-28）：
- Code Review：code-reviewer 两阶段 PASS，未发现越界进 Phase 16/17 动态渲染范围的改动；2 条 LOW 备注（预埋的 schemaStore CRUD/blankSchema 无当前调用者、一处注释笔误）已采纳修正
- 测试完整性：新增 migration/schemaDefaults/schemaStore/requirementFields 测试 + 旧格式文件 closureType→result 映射测试；`vitest run` 36 files / 359 tests 全通过
- 编译验证：`tsc --noEmit` 零错误
- 功能测试：独立 HOME 目录（非生产数据）启动打包后的 debug 二进制，手动放入无 schema.json 的旧格式项目数据，验证：启动后自动生成 schema.json，内容与硬编码字段等价；看板/详情面板渲染与迁移前视觉一致（8 列表格、8 项属性区）；新建 Tab 记录、多次阶段流转后数据正确写入新的 attributeValues 格式，旧扁平字段完全消失

---

## Phase 16: 动态看板渲染

**交付内容**：
- STAGES 常量替换为从 schemaStore 读取的动态阶段列表
- RequirementRow 从 8 个固定单元格改为通用属性类型渲染器（按 schema 中看板可见属性遍历渲染）
- grid-template-columns 动态生成（从 schema 属性列表 + 持久化列宽计算）
- 看板区域支持横向滚动（移除 --board-row-max-w 上限）
- Name 列固定最左不参与滚动（position: sticky）
- 终态阶段行为泛化：任何 isTerminal=true 的阶段获得搜索框、禁新建、禁拖入排序
- 阶段标题颜色从 schema 阶段选项的 color 字段读取

**关键文件**：
- `reqflow/src/components/board/Board.tsx` — 从 schema 读取阶段列表，替换硬编码 STAGES（大改）
- `reqflow/src/components/board/StageSection.tsx` — 终态逻辑泛化，颜色从 schema 读（改）
- `reqflow/src/components/board/RequirementRow.tsx` — 重写为通用属性渲染器
- `reqflow/src/components/board/FieldCell.tsx` — 新建：按属性类型渲染对应 UI（单选badge/文本/数字/日期/勾选等）
- `reqflow/src/components/board/BoardHeader.tsx` — 新建：动态列头（从 schema 可见属性生成）
- `reqflow/src/styles/tokens.css` — 移除 `--board-row-max-w`
- `reqflow/src/lib/boardWidth.ts` — BOARD_MIN_WIDTH 重定义（冻结列宽 + 最小滚动区）

**验收标准**：
- 看板列从 schema 动态渲染，增删属性后看板列跟着变
- 横向滚动正常，Name 列始终固定在左侧可见
- 终态阶段（不管叫什么名字）正确显示搜索框、隐藏新建按钮
- 阶段标题颜色跟随 schema 配置

**范围调整**：发布方式/发布时间两列退化为全阶段统一渲染的普通属性列，不再有 release 阶段专属分支；等 Phase 20 阶段覆盖引擎做好后再配置为"仅发布阶段可见"的覆盖规则。归档行"进度"列不再借用位置特殊显示"完成/废弃"文案（旧 Design-Brief CMP-001 规则被 Schema 化取代，"结果"属性现在是独立看板列，进度列始终显示数字）。执行前发现 Phase 15 迁移 Schema 缺 `createdAt` 属性会导致本 Phase 严格按 schema 渲染后"创建时间"列消失，已在 Phase 15 范围内补齐（见上）。Design-Brief.md DP-003（阶段条统一浅绿底色）与 Product-Spec REQ-001/§966（阶段颜色可自定义）确认存在冲突，已解决：阶段颜色开放为用户可自定义，`accent-soft` 仅作新建阶段选项时的默认取色，Design-Brief 已同步补写说明。

**完成情况**（四步走验证，2026-07-31）：
- Code Review：code-reviewer 两阶段 PASS，交付清单 7 条、验收标准 4 条全部逐条核对通过；1 条 LOW 备注（`StageTransitionDropdown.tsx`/`activityShared.ts` 仍从 `STAGES` 常量查阶段 label，对未来自定义阶段显示不够友好）留给 Phase 20+ 处理，不阻塞
- 测试完整性：新增 FieldCell/BoardHeader/schemaSelectors 测试 + Board/RequirementRow/StageSection 测试重写适配动态渲染；`vitest run` 39 files / 399 tests 全通过
- 编译验证：`tsc --noEmit` 零错误
- 功能测试：独立 HOME 目录启动打包后的 debug 二进制，喂入无 schema.json 的旧格式项目数据，验证：迁移生成的 schema.json 含 7 阶段 + 11 属性且与硬编码字段等价；看板表头/列从 schema 动态渲染（11 列非写死 8 列）；阶段标题颜色各不相同、跟随 schema 阶段选项 color 字段；旧格式数据迁移后可正常查看编辑，编辑后正确落盘为新 attributeValues 格式。横向滚动和终态搜索框两条因验证过程中的操作事故（见下）改为仅靠单测覆盖，未截图实测，经用户确认可接受

**验证事故记录**：功能测试中误用 `tell application "reqflow" to activate` 唤起了系统已安装的正式版 app（非本次测试的 debug 二进制），随后几次全局键盘快捷键误发到其他前台应用。已核实真实生产数据全程未被读写（文件 mtime 早于本次 session、无 schema.json 意外生成），进程已清理，临时测试目录已删除。后续在同机器验证桌面应用时，避免用 `tell application "<name>" to activate` 按应用名唤起（可能命中已安装的正式版而非测试二进制），改为通过 PID 或窗口句柄精确定位。

---

## Phase 17: 详情面板改造 + 顶栏布局

**交付内容**：
- AttributeGrid 从固定 8 字段改为从 schema 动态渲染（详情页可见属性列表，独立排序）
- 移除"来源"字段特殊交互（当场追加选项），统一为普通单选
- 移除阶段专属只读槽位
- 详情面板头部：收起按钮改为关闭按钮（×），点击关闭面板；看板行点击展开
- 顶栏移除详情面板收起/展开按钮，新增占位按钮：[筛选] [排序] [字段] [⚙]（筛选/排序/字段本 Phase 放占位，后续 Phase 接功能；⚙ 为新增的 Schema 设置齿轮，本 Phase 也是占位，Phase 18 接功能）
- 顶栏原有"设置"齿轮（Phase 13 检查更新入口）改名为独立的"版本"按钮，与新的 Schema 设置齿轮分离并列，功能不变（见 Product-Spec v2.9 变更，REQ-002/REQ-023）
- 搜索框提示文案从"搜索需求"改为中性表达

**关键文件**：
- `reqflow/src/components/detail/AttributeGrid.tsx` — 重写：从 schema 读取详情页可见属性列表动态渲染（布局容器，59 行）
- `reqflow/src/components/detail/AttributeField.tsx` — 新建：从 AttributeGrid 拆出的各属性类型字段渲染器（单文件 300 行上限，271 行）
- `reqflow/src/components/detail/DetailHeader.tsx` — 收起按钮改为关闭×
- `reqflow/src/components/detail/DetailPanel.tsx` — 打开逻辑改为由看板行点击触发（而非常驻展开）
- `reqflow/src/components/topbar/Topbar.tsx` — 布局重构：移除 detail toggle，新增 filter/sort/fields/gear 占位按钮，原设置齿轮改为独立"版本"按钮与新齿轮并列
- `reqflow/src/stores/uiStore.ts` — detailMode 状态从"展开/收起/全屏"改为"关闭/展开/全屏"（内部命名 collapsed→closed，与 `lib/boardWidth.ts` 的 `DetailLayoutMode` 合并为同一类型）
- `reqflow/src/lib/schemaSelectors.ts` — 新增 `detailAttributesFor`：按 showOnDetail 过滤，保持 schema.attributes 原始顺序（独立于看板 columnOrder）

**范围调整**：来源字段自定义追加交互删除后，连带清理了 App.tsx 的 `sources`/`onAddSource` 整条链路，包括 `projectStore.addSource` 方法及其测试（已无调用方，非本 Phase 交付清单条目但属于必然连带的死代码清理）。

**完成情况**（四步走验证，2026-07-31）：
- Code Review：code-reviewer 两阶段 PASS，交付清单 7 条、验收标准 4 条全部逐条核对通过，无超范围改动；Stage 2 提出 2 条 MEDIUM（DetailMode/DetailLayoutMode 类型重复、AttributeGrid.tsx 超 300 行）+ 1 条 LOW（boardWidth.ts 注释用词滞后），均已修复：合并为单一 DetailMode 类型、拆出 AttributeField.tsx、注释同步改为 closed
- 测试完整性：AttributeGrid.test.tsx/DetailPanel.test.tsx/DetailHeader.test.tsx/uiStore.test.ts/boardWidth.test.ts/schemaSelectors.test.ts/projectStore.test.ts 同步更新；`vitest run` 39 files / 408 tests 全通过
- 编译验证：`tsc --noEmit` 零错误
- 功能测试：`vite build` 生产构建成功无报错。本 Phase 是纯前端 UI 改造（无新增/变更的 Tauri IPC 调用或数据落盘格式），且桌面应用无 HTTP API 可 curl，真实渲染效果（顶栏新按钮布局、详情面板动态属性区、关闭×交互）需要用户在实际窗口里过一遍确认

---

## Phase 18: Schema 设置页

**交付内容**：
- 新建独立页面（全屏，替换看板内容区），入口为顶栏齿轮按钮
- 左侧竖向导航：阶段 / 属性 / 各 Tab 名
- 阶段管理区：增删改排序阶段选项、颜色选择器、终态标记开关、属性覆盖规则配置
- 属性管理区：属性列表（眼睛图标看板/详情页隐藏开关）、点击展开编辑面板（类型/显示名/显示条件）、新建属性
- Tab 管理区：Tab 列表（排序/显隐）、每个 Tab 的字段配置、新建 Tab
- "保存为模板"按钮（本 Phase 放占位，Phase 25 接功能）
- 右键表头"编辑此属性"跳转到设置页对应位置

**关键文件**：
- `reqflow/src/components/settings/SchemaSettingsPage.tsx` — 设置页主容器
- `reqflow/src/components/settings/SettingsNav.tsx` — 左侧竖向导航
- `reqflow/src/components/settings/StageManager.tsx` — 阶段管理区
- `reqflow/src/components/settings/AttributeManager.tsx` — 属性管理区
- `reqflow/src/components/settings/TabManager.tsx` — Tab 管理区
- `reqflow/src/components/settings/AttributeEditor.tsx` — 单个属性的编辑面板（类型/名称/依赖条件）
- `reqflow/src/components/settings/StageEditor.tsx` — 单个阶段的编辑面板（名称/颜色/终态/覆盖）
- `reqflow/src/components/settings/ColorPicker.tsx` — 预设色板选择器

**验收标准**：
- 齿轮按钮点击进入设置页，左侧导航切换区域
- 可新建/删除/重命名阶段选项，可标记终态，可选颜色
- 可新建/删除/改类型属性，有损改类型弹确认
- 可配置属性的看板/详情页隐藏开关
- 右键看板表头"编辑此属性"跳转到设置页正确位置
- 删阶段选项时若有实体存在则禁止并提示

**完成情况**（四步走验证，2026-08-03）：
- Code Review：code-reviewer 分 5 个 Task 逐一两阶段审查，均 PASS：Task 1 骨架+导航+入口路由；Task 2 阶段管理区（首轮发现 HIGH——"Stage 选项最少 1 个不允许清空到 0"未实现，已在 store 层+UI 层双重兜底修复，复审通过）；Task 3 属性管理区（含改类型有损判定、属性依赖配置骨架、命名唯一性拦截，一次通过无问题）；Task 4 Tab 管理区（1 项 MEDIUM——TabManager.tsx 超 300 行阈值，已拆出 TabRow.tsx/TabEditor.tsx 修复）；Task 5 右键表头跳转。交付清单 6 项、验收标准 6 条全部逐条核对通过，未发现超范围改动（未误做 Phase 19 的列宽/列序/字段面板/隐藏冻结）
- 测试完整性：新增 105+ 条测试覆盖交互层和故障路径（同名拦截、删除保护、有损改类型确认、最少阶段数兜底等），非仅顺畅路径；`vitest run` 48 files / 509 tests 全通过
- 编译验证：`tsc --noEmit` 零错误
- 功能测试：`vite build` 生产构建成功无报错。本 Phase 是纯前端 UI 改造（无新增 Tauri IPC 调用格式变更），桌面应用无 HTTP API 可 curl，真实交互效果（拖拽排序、右键菜单定位、有损确认弹窗）需要用户在实际窗口里过一遍确认

---

## Phase 19: 列操作 + 字段管理面板

**交付内容**：
- 列宽调整：拖拽列头右边缘（下限=各类型默认宽度），持久化到 schema.json viewPreferences
- 列序调整：拖拽列头文字换位，持久化
- 列冻结：从左向右连续扩展，Name 默认冻结；冻结列 position: sticky
- 右键表头菜单：隐藏此属性 / 冻结至此列（仅左侧已全部冻结时可用）/ 编辑此属性
- 顶栏"字段"按钮接通：弹出字段管理下拉面板（属性列表+眼睛图标+拖拽排序+底部新建属性）

**关键文件**：
- `reqflow/src/components/board/BoardHeader.tsx` — 列头拖拽调宽/调序交互（改）
- `reqflow/src/components/board/ColumnContextMenu.tsx` — 新建：右键菜单
- `reqflow/src/components/topbar/FieldsPanel.tsx` — 新建：字段管理下拉面板
- `reqflow/src/stores/schemaStore.ts` — viewPreferences 的列宽/列序/隐藏/冻结 CRUD 方法

**验收标准**：
- 拖拽列头右边缘调宽，松手后持久化，重开应用保留
- 拖拽列头文字调序，松手后列位变化持久化
- 冻结列在横向滚动时固定不动
- 右键菜单三项功能正确
- 字段面板的眼睛图标切换与 Schema 设置页联动

---

## Phase 20: 属性依赖 + 阶段覆盖引擎

**交付内容**：
- 属性依赖引擎：看板按行空白（条件不满足的行该格子为空）；详情面板同理（不满足的属性不显示）
- 阶段覆盖引擎：某阶段下一批属性的列位被另一批替换
- 优先级规则：覆盖先于依赖（覆盖决定位置，依赖只管占位后的那个属性）
- 设置页属性编辑面板"显示条件"配置交互完善（选属性A + 选值）
- 设置页阶段编辑面板"属性覆盖"配置交互完善（fromAttr → toAttr 映射列表）

**关键文件**：
- `reqflow/src/lib/dependencyEngine.ts` — 新建：依赖条件求值（给定属性值集合，返回哪些属性可见）
- `reqflow/src/lib/overrideEngine.ts` — 新建：覆盖映射求值（给定当前阶段，返回列位替换表）
- `reqflow/src/components/board/RequirementRow.tsx` — 接入依赖+覆盖引擎（改）
- `reqflow/src/components/detail/AttributeGrid.tsx` — 接入依赖引擎（改）
- `reqflow/src/components/settings/AttributeEditor.tsx` — 显示条件配置 UI（改）
- `reqflow/src/components/settings/StageEditor.tsx` — 属性覆盖配置 UI（改）

**验收标准**：
- 配置"属性B仅当属性A=X时显示"后，看板上条件不满足的行该列为空、详情页该属性不显示
- 配置阶段覆盖后，对应阶段的行正确显示替换后的属性
- 覆盖和依赖同时存在时，覆盖优先

---

## Phase 21: 筛选机制

**交付内容**：
- 顶栏"筛选"按钮接通：弹出筛选下拉面板
- 条件结构：选属性 → 选运算符（按类型区分）→ 选值
- 多条件 AND 逻辑
- 按项目持久化（写入 schema.json viewPreferences.filters）
- 激活时按钮高亮 + tag 显示条件数 + × 清除

**关键文件**：
- `reqflow/src/components/topbar/FilterPanel.tsx` — 新建：筛选下拉面板
- `reqflow/src/components/topbar/FilterConditionRow.tsx` — 新建：单条筛选条件行
- `reqflow/src/lib/filterEngine.ts` — 新建：筛选求值（给定实体属性值+条件集合，返回是否可见）
- `reqflow/src/components/board/Board.tsx` — 接入筛选引擎过滤实体（改）
- `reqflow/src/stores/schemaStore.ts` — filters CRUD（改）

**验收标准**：
- 添加筛选条件后看板只显示满足的实体，多条件取交集
- 关闭应用重开，筛选条件保留
- 筛选激活时顶栏按钮高亮 + tag，点 × 清除后恢复全量显示

---

## Phase 22: 排序重构

**交付内容**：
- 顶栏"排序"按钮接通：全局排序面板（可选属性从 schema 动态生成，排除文本/勾选/附件）
- 每个阶段标题行保留局部排序控制（从 schema 动态生成可选属性列表）
- 优先级层级：手动拖拽 > 阶段局部规则 > 全局规则
- 手动拖拽只影响被拖的那个阶段
- 重新激活规则覆盖手动位置
- 排序状态持久化（globalSort + stageSorts 写入 schema.json viewPreferences）

**关键文件**：
- `reqflow/src/components/topbar/GlobalSortPanel.tsx` — 新建：全局排序下拉面板
- `reqflow/src/components/board/SortControl.tsx` — 改造：从 schema 动态生成可选属性列表
- `reqflow/src/lib/requirementSort.ts` — 重写：三层排序优先级逻辑
- `reqflow/src/stores/schemaStore.ts` — globalSort/stageSorts CRUD（改）

**验收标准**：
- 全局排序激活后所有阶段按规则排列
- 某阶段设局部规则后该阶段按局部规则、其他阶段按全局
- 手动拖拽某阶段内的实体后，只有该阶段切换为手动，其他不受影响
- 重新激活排序规则后覆盖手动位置

---

**完成情况**（四步走验证，2026-08-06）：
- Code Review：主 Agent 对照 Phase 22 交付清单完成 Stage 1 功能/优先级/迁移复核和 Stage 2 质量/测试/安全复核；排序属性动态来自 Schema，手动 > 阶段局部 > 全局，删除排序属性会清理失效规则，无超出 Phase 22 的业务改动。
- 测试完整性：`pnpm test --run`，53 个测试文件 / 594 个测试全部通过，覆盖规则优先级、空值排序、动态属性过滤、手动排序、Schema 持久化、旧 Schema 迁移和删除属性清理。
- 编译验证：`pnpm exec tsc --noEmit` 零错误。
- 功能测试：`pnpm dev --host 127.0.0.1` 成功启动，`curl -fsS http://127.0.0.1:1420/` 返回 HTML；`pnpm build` 成功。构建保留 Vite 单 chunk 超过 500 kB 的非阻塞提醒。

## Phase 23: Tab 模型重构

**交付内容**：
- Tab 栏从 schema tabs 列表动态渲染（顺序/显隐由 schema 控制）
- 用户自建 Tab：通用字段渲染器（字段从上到下排列的标准卡片）
- 预制 Tab 容错：字段被改后专用组件做容错（缺的跳过、多的追加通用渲染）
- 活动 Tab 改为预制 Tab（不默认存在于空白项目）
- 正文 Tab 保持固定特例（是否显示由 schema 控制）
- Tab 内记录的 CRUD 走 schema 字段定义

**关键文件**：
- `reqflow/src/components/detail/TabBar.tsx` — 从 schema 动态渲染 Tab 列表（改）
- `reqflow/src/components/detail/tabs/GenericTab.tsx` — 新建：通用 Tab 渲染器
- `reqflow/src/components/detail/tabs/GenericCard.tsx` — 新建：通用记录卡片（按字段类型渲染）
- `reqflow/src/components/detail/tabs/TasksTab.tsx` — 接入容错逻辑（改）
- `reqflow/src/components/detail/tabs/DeliverablesTab.tsx` — 接入容错逻辑（改）
- `reqflow/src/components/detail/tabs/AcceptanceTab.tsx` — 接入容错逻辑（改）
- `reqflow/src/stores/tabRecordStore.ts` — 新建：通用 Tab 记录的 CRUD store

**验收标准**：
- 在设置页新建一个自定义 Tab 后，详情面板 Tab 栏出现对应 Tab，可新建/编辑/删除记录
- 修改预制 Tab 字段（如删除任务 Tab 的"阻塞"字段）后，任务卡片正确容错渲染（阻塞 UI 消失）
- 活动 Tab 在空白项目中不出现，使用 reqflow 模板的项目中出现

---

## Phase 24: Undo 机制

**交付内容**：
- Undo 栈（深度 50），Cmd+Z 触发
- 可 Undo：属性值修改、Tab 内记录增删改、手动排序、拖拽换阶段
- 不可 Undo：结构操作（删属性/Tab/阶段）、永久删除实体
- 底部 toast 反馈"已撤销：[操作摘要]"，2-3 秒消失
- 关闭应用清空栈，不做 Redo

**关键文件**：
- `reqflow/src/lib/undoStack.ts` — 新建：Undo 命令栈（push/pop/clear，每条命令含 undo 回调和摘要文本）
- `reqflow/src/stores/requirementStore.ts` — 属性值修改和阶段流转操作包装为可撤销命令（改）
- `reqflow/src/stores/tabRecordStore.ts` — 记录增删改包装为可撤销命令（改）
- `reqflow/src/components/shared/UndoToast.tsx` — 新建：底部 toast 组件
- `reqflow/src/hooks/useUndoKeyboard.ts` — 新建：全局 Cmd+Z 键盘监听

**验收标准**：
- 修改属性值后 Cmd+Z 撤销，toast 显示操作摘要
- 删除 Tab 记录后 Cmd+Z 撤销，记录恢复
- 连续多次 Cmd+Z 逐步撤销（栈深 50）
- 结构操作（删属性）执行后 Cmd+Z 无效（不可撤销）
- 关闭重开应用后 Cmd+Z 无效（栈已清空）

---

## Phase 25: 模板系统 + 新建项目流程

**交付内容**：
- 模板数据结构：schemaSnapshot（Schema 去掉 viewPreferences 和实体数据）
- 内置 reqflow 模板（从 schemaDefaults.ts 导出）
- "保存为模板"按钮接通（设置页顶部右侧），点击弹小面板输入名称确认保存
- 新建项目弹窗改造：输入项目名 + 下方模板选择区（不选=空白），模板列表含内置+用户自定义
- 模板管理：新建项目弹窗内可改名/删除模板
- 模板存储：`appLocalDataDir()/templates/{templateId}.json`

**关键文件**：
- `reqflow/src/stores/templateStore.ts` — 新建：模板列表读写、保存当前 Schema 为模板、删除模板
- `reqflow/src/components/topbar/ProjectSwitcher.tsx` — 新建项目弹窗改造：加模板选择区和管理操作（改）
- `reqflow/src/components/settings/SchemaSettingsPage.tsx` — 保存为模板按钮接通（改）
- `reqflow/src/lib/schemaDefaults.ts` — 导出 reqflow 内置模板定义（改）

**验收标准**：
- 新建项目不选模板 → 空白（只有 Name + Stage "默认"）
- 新建项目选 reqflow 模板 → 7 阶段 + 全部属性 + 任务/产出/验收/活动/正文 Tab
- 在某项目配好 Schema 后点"保存为模板"，在另一个新建项目时能选到该模板
- 模板管理中可改名/删除，删除后新建项目列表不再显示

---

## Phase 26: 收尾 + 实体删除 + Bug 修复

**交付内容**：
- 实体永久删除（看板行右键菜单 + 详情面板头部按钮），二次确认，级联删子记录/流转/评论
- 新建实体交互修复：blur 有内容 = 创建成功（修复现有 bug）
- 删阶段选项后历史流转记录阶段名冻结为纯文本快照
- 检查所有 UI 中性表达（不使用"需求"等实体名）
- 完整走通 Product-Spec §9 完成定义全部 Schema 改造检查项
- `pnpm tauri build` 产出可分发的 .app

**关键文件**：
- `reqflow/src/components/board/EntityContextMenu.tsx` — 新建：实体行右键菜单（永久删除入口）
- `reqflow/src/components/detail/DetailHeader.tsx` — 新增删除按钮（改）
- `reqflow/src/components/board/QuickAddInput.tsx` — 修复 blur 行为（改）
- `reqflow/src/stores/requirementStore.ts` — 永久删除逻辑（级联删除 TabRecord/TransitionRecord/Comment）（改）

**验收标准**：
- 右键实体行"永久删除"，确认后实体及所有关联数据消失
- 新建实体输入名称后点击其他区域（blur），实体正确创建
- Product-Spec §9 Schema 改造完成定义全部检查项通过
- `pnpm tauri build` 成功产出可分发 .app
