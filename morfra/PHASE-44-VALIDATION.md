# Phase 44 验证记录

日期：2026-08-12
构建：`pnpm tauri build` 生成的独立 macOS `Morfra.app`（`src-tauri/target/release/bundle/macos/Morfra.app`）
机器：Apple M5（10 logical CPU），macOS / Darwin 25.5.0（arm64）

原始证据位于 [`evidence/phase-44`](evidence/phase-44)：`performance-raw.json` 保留一次完整性能命令输出的最终 JSON 行；`macos-table-ax.txt`、`macos-app-ax.txt` 为独立应用 AX 树；对应 PNG 是同一状态截图。SHA-256：

- `performance-raw.json`：`a499f925a4062baea330d3836d37af7f6a3a24436a12f7ad18d47b142b25d396`
- `macos-table-ax.txt`：`d3ddf4da689d7d59f1062f3a99734e98faaaacf3844dce822e150fd11af00749`；`macos-table.png`：`1bdc690aff53e1e41628425098411fd0a0944dc672efe77ebaa63f3dd3ccbb71`
- `macos-app-ax.txt`：`508fca93814a8ebd3c64b9205dc94d84762961c147a1a4f5acfab850a81422e0`；`macos-app.png`：`d54c6b293ddbd03eaf44edff8dd1b4144fc73c179bfa7ad7a3d3801841194bc1`
- `macos-detail-ax.txt`：`bb120540a6ab222714b9c3dd1a31bd12663890ecd58c625ae9fc911ad244f727`；`macos-detail.png`：`4f3b75bae9254771c46b09bfbbb1729b4c12bca3de5f0fb9e10c21433db6f27e`

## 自动化窗口与功能矩阵

| 范围 | 证据 | 结果 |
| --- | --- | --- |
| 960×640、1199px 窄窗 | `MorfraShell.test.tsx` 的窄窗导航、右栏抽屉与主区保留测试 | 通过 |
| 1200px、宽屏、超宽 | `windowLayout.test.ts`、`MorfraShell.test.tsx` 双栏网格与 560px 主区底线测试 | 通过 |
| 全屏与可用区扩展 | `windowLayout.test.ts`、`DataGrid.virtualization.test.tsx`、`KanbanView.test.tsx` | 通过 |
| 键盘、焦点恢复、ARIA、撤销 | `DataGrid.interaction.test.tsx` | 通过 |
| 搜索/筛选无结果、局部加载/失败和重试 | `StorageWorkspace.test.tsx`、`DataGrid.interaction.test.tsx` | 通过 |
| 外观三档、系统变化、减少动态、降低透明度 | `appearance.test.ts` | 通过 |

## 真实 macOS 应用手工验证

使用独立 `Morfra.app` 的 macOS Accessibility 树核对，未使用浏览器替代。

| 操作 | 可核对原始观察 | 结果 |
| --- | --- | --- |
| 960×640、1199px、1200px、宽屏、超宽 | 当前 `Morfra.app` 重启后保存 `macos-table-ax.txt/png`；临界宽度逻辑由 `MorfraShell.test.tsx`/`windowLayout.test.ts` 固定为 960、1199、1200 与宽屏网格断言 | 通过 |
| 全屏、表格、详情与 AI 互斥布局 | 操作：全屏按钮→展开 AI→点击第 1 行详情箭头。`macos-table-ax.txt` 保存表格+AI状态；`macos-detail-ax.txt` 保存切换后 `上下文面板`、选中 `详情` tab、`记录详情` 与 AI tab，证明详情/AI 互斥 | 通过 |
| 表格录入编辑与详情 | 操作：双击第 1 行标题→输入 `Phase 44`→Enter→点击详情箭头。`macos-detail-ax.txt` 记录 `未命名记录Phase 44`、详情标题与 `打开第 1 条记录详情` | 通过 |
| 键盘和屏幕阅读器语义 | 操作：聚焦 grid 后方向键移动。AX 原文记录 `table 可编辑表格`、可选择行/单元格、可设置搜索框、splitter、项目导航和主显示区 | 通过 |
| 浅色、深色、跟随系统 | 操作：Morfra 菜单→设置→外观→深色→跟随系统。`macos-app-ax.txt` 保存跟随系统 radio 值 1；切换过程中深色 radio 值为 1 | 通过，偏好恢复为跟随系统 |
| 减少动态效果 | 操作：macOS 辅助功能→动态效果→`减弱动态效果` off→on，核对 Morfra 设置仍可访问，然后 on→off | 通过，系统设置已恢复 |
| 降低透明度 | 操作：macOS 辅助功能→显示→`降低透明度` off→on，随后 on→off | 通过，系统设置已恢复 |

## 性能基准

复跑命令：`cd morfra && pnpm benchmark:phase39 > evidence/phase-44/performance-raw.json`。生产最小化构建后，在 JSDOM 中真实挂载生产 `DataGrid` 与 `KanbanView`；测试项目是脚本内的独立 SQLite 形状快照，包含 10,000 条记录、200 字段和 4 个真实表格/看板视图配置。每项 5 次预热、30 次测量，以预热后 nearest-rank P95 判断，阈值均为 300ms。完整命令输出与全部样本保存在 `evidence/phase-44/performance-raw.json` 最后一行。

| 操作 | P95 |
| --- | ---: |
| 搜索 | 2.46ms |
| 筛选 | 25.24ms |
| 排序 | 66.50ms |
| 视图切换 | 85.87ms |
| 表格可见区渲染 | 58.15ms |
| 看板可见区渲染 | 78.17ms |

完整原始 30 次样本由命令以 JSON 输出；所有指标低于 300ms。
