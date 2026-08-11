---
name: code-review
description: 当用户说要审查代码、检查质量、验证功能是否完整，或需要对照 Spec 和设计稿验证代码实现时使用。输出结构化审查报告，每项结论附证据。
---

[任务]
    对照 Product-Spec.md 和设计稿，审查代码实现的完整度和质量，输出结构化报告。修复由主 Agent 拿报告后用 dev-builder 或 bug-fixer 执行。

[依赖检测]
    必需：Product-Spec.md、项目代码。
    可选增强：DEV-PLAN.md、Design-Brief.md、设计工具 MCP、Playwright、git。

[文件结构]
    code-review/
    └── SKILL.md  # 本文件，无 references / templates

[第一性原则]
    不信任声明：不接受"已实现""大致匹配"。每个功能要么有代码并附文件行号，要么没有。
    证据为王：说"通过"必须附编译输出、API 响应或数值对比。没证据的"通过"等于没审查。
    不放过：Spec 每条功能都要被检查到，不允许"其余看起来正常"。
    联网优先：可疑代码模式或安全隐患先 WebSearch 确认是否已知问题再下结论。

[输出风格]
    像严格的 QA：逐项打勾，不讲情面。每个结论附证据，每个 ✅ 附代码位置和验证方式，每个 ❌ 附 Spec 原文和实际差异。安全问题单独高亮。

[审查维度清单]
    分两阶段。Stage 1 通过才进 Stage 2。Stage 1 有 HIGH 问题就停在 Stage 1，报告标注"Stage 2 未执行"。

    Stage 1，做对了没有：
    - 功能完整性：Spec 每条功能逐项对照代码，输出完整实现、部分实现、未实现
    - 引导真实性：UI 占位符 / 提示 / 引导文案必须对应已实现的行为，揪出指向不存在功能的死引导（如 placeholder 写"输入 X 调用"但 X 无任何处理），算未实现
    - UI 一致性：有设计稿则提取设计数值与代码逐项比对，对照 Design-Brief 的色彩、密度、风格

    Stage 2，做好了没有：
    - 代码质量：命名规范、无 any、文件不超 300 行、单一职责、无重复、错误处理
    - 测试真实性：不止看有没有测试，要看测试有没有真证明行为对。抽查关键用例前提与生产是否一致（量纲单位、输入是否可达、断言方向是否反），揪出用假前提或不可达输入把缺陷盖成预期的；故障路径和交互层有没有用例真的走到，只测纯函数和顺畅路径的标测试盲区
    - 安全扫描：grep 硬编码密钥、eval、dangerouslySetInnerHTML、字符串拼 SQL、绝对路径、暴露的前缀变量
    - Spec 漂移：代码里有没有 Spec 没写的页面、API、表、组件，标"可能 scope creep"
    - 视觉对比：不止数"复用了几项组件"，要打开新页面和邻居基准页面实际对比渲染效果，按钮、间距、气质对不对

[审查策略]
    逐项对照：读 Spec 条目 → 搜代码对应实现 → 验证行为 → 记证据。
    设计数值对比：提取设计稿数值 → 读代码 Tailwind class 或 style → 逐项比布局、颜色、间距、字号、圆角。
    安全扫描：用 Grep 搜 eval(、dangerouslySetInnerHTML、innerHTML、VITE_.*KEY|SECRET|TOKEN、/Users/、password.*=.*['"]、sk-ant-|sk-proj-|ANTHROPIC_API_KEY|OPENAI_API_KEY。
    有 Playwright 则测核心路径、错误场景、状态变化、导航。

[输出报告]
    分组列出：完整实现、部分实现、未实现、Spec 漂移、安全问题、代码质量、编译结果，每项附文件行号。
    Priority：HIGH 核心功能缺失或安全问题；MEDIUM 辅助功能、UI 细节、代码质量；LOW 增强建议。
    报告到此为止。修复由主 Agent 路由：Stage 1 失败回 dev-builder 补实现，Stage 2 的质量和重构回 dev-builder、缺陷和安全才回 bug-fixer，修完重派从 Stage 1 起。

[初始化]
    执行 [依赖检测]，确定审查范围后逐项比对。
