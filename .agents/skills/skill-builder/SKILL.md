---
name: skill-builder
description: 当用户说要创建新技能，或 EVOLUTION.md 提议自动生成新 Skill 时使用。按照框架模块化规范创建结构一致的新 Skill。
---

[任务]
    根据用户需求或 EVOLUTION 提议，创建符合框架规范的新 Skill，结构和现有 Skill 一致、即插即用。

[依赖检测]
    无必需依赖。可选：来自进化提议时读对应 proposal 了解背景。

[文件结构]
    skill-builder/
    ├── SKILL.md               # 本文件
    └── templates/
        └── skill-template.md  # 新 Skill 骨架模板

[第一性原则]
    模板优先：先读 templates/skill-template.md 骨架按结构填，不从零写。
    参照现有：创建前读 1-2 个交互模式最接近的已有 Skill 保持一致，不发明新格式。
    最小必要：只建需要的 Section，不为"看起来完整"加空内容。
    联网优先：涉及不熟的领域先 WebSearch 了解最佳实践再设计维度和策略。

[创建规范]
    三层模块化：
    - Section 是原子能力。维度清单定义查什么收什么，策略定义怎么做，工作流程定义什么顺序。改一个 Section 不影响其他
    - Skill 是多个 Section 的组合，解决一个领域问题
    - AGENTS.md 编排 Skill 的顺序和触发，改工作流不改 Skill 内容
    Section 分类：
    - 必须有：[任务]、[依赖检测]、[文件结构]、[第一性原则]、[初始化]
    - 推荐有：[输出风格]、[XX维度清单]、[XX策略]
    - 按需有：[信息充足度判断]、[回退策略]、[Phase 完成度判断]、多模式工作流程
    交互模式定参照：对话采集型参照 product-spec-builder、design-brief-builder；自主分析型参照 dev-planner、code-review；执行操作型参照 dev-builder、release-builder；诊断修复型参照 bug-fixer。

[写作规范]
    遵循 Agent-Guideline.md：
    - 格式：[标题] 段、四空格缩进、中文、嵌套 [name] 块，frontmatter 只有 name 和 description
    - 不用括号写补充逻辑，直接写成正文或短句
    - 不点具体模型或产品名，直接讲本质
    - 人称用"你"，写直接的指令，不写外部观察
    - 讲规则、需求、标准，不写分步执行剧本，剩下交给你自己
    - 言简意赅，删含糊、绕、废话

[工作流程]
    了解新 Skill 解决什么、何时触发、输入输出 → 按交互模式找参照 Skill → 读模板定 Section → 逐个填，第一性原则最后一条是联网优先 → 在 .agents/skills/[skill-name]/ 建 SKILL.md，有模板建 templates/ → 自检格式和写作规范 → 在 AGENTS.md 补 [Skill 调用规则]、[可用技能] 和工作流程。

[初始化]
    收集新 Skill 需求。
