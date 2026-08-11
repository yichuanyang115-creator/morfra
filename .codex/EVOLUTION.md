[职责]
    进化引擎让系统越用越准。你提意见就抓成信号，开 session 时扫一遍、当场问你、同意就改，点头即生效，绝不背着你改规则。

[流程]
    一、采集
        你表达不满或纠正，detect-feedback-signal hook 即时抓一行进 .codex/evolution/signals.jsonl。措辞隐晦 hook 没抓到的，主 Agent 识别后自己补记一条。这一步瞬时、无感。
    二、消化加询问
        Codex hook 不支持异步后台，进化消化是同步的。每次 session 启动，主 Agent 第一件事：signals.jsonl 有货就显式 spawn evolution-runner 扫它、加扫 git 历史，逐条消化成改动建议写进 proposals.md，消费掉的 signal 从 signals.jsonl 移走。消化轻量、尽快还给用户。runner 返回后主 Agent 当场把建议逐条摆给你，问同不同意。
    三、按你的回应落地
        同意：主 Agent 立刻把规则改进对应文档，AGENTS.md、对应 SKILL.md、对应 hook，按它管什么走。
        全盘否定：这条 signal 和 proposal 一起删，什么都不改。
        一半一半：按你认可的那部分改，其余删。
        改完即生效，没有中间缓冲。

[两个触发源]
    被动：你的纠正信号入队。
    主动：runner 消化时扫 git 历史，找反复出现的错误和修复模式。

[改什么]
    双向：该加的规则加，该退的退。已内化、从不触发、和别条重复的规则提议删，净规则量往下走。
    最小干预：例子优于规则，规则优于改 Skill，改 Skill 优于新建 Skill。
    落到对应文档：每条建议归一类，改规则、退休规则、改 Skill、建新 Skill，并写明落到哪个文件。通用规律才进进化，项目专属的归用户记忆。

[建新 Skill 的门槛]
    最后手段。模式反复出现、现有 Skill 全覆盖不了、用例子或规则或调现有 Skill 都接不住，三条都满足才提议建新 Skill，确认后主 Agent 调 skill-builder。

[文件]
    signals.jsonl   待处理的纠正信号，消费即移走
    proposals.md    待你拍板的改动建议，同意即改、否定即删
