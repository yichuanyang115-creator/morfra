import { RELEASE_METHODS, STAGES } from "../types/models";
import type { Attribute, Schema, StageOption, TabDefinition } from "../types/schema";
import { paletteColorAt } from "./stagePalette";
import { FIELD_KEYS } from "./requirementFields";

const SCHEMA_VERSION = 1;

const PRECAST_TABS: TabDefinition[] = [
  { id: "body", name: "正文", renderer: "body", visible: true },
  { id: "deliverables", name: "产出", renderer: "deliverables", visible: true },
  { id: "tasks", name: "任务", renderer: "tasks", visible: true },
  { id: "acceptance", name: "验收", renderer: "acceptance", visible: true },
  { id: "activity", name: "活动", renderer: "activity", visible: true },
];

function legacyStageOptions(): StageOption[] {
  return STAGES.map((s, i) => ({
    id: s.key,
    label: s.label,
    color: paletteColorAt(i),
    isTerminal: s.key === "archive",
  }));
}

function legacyAttributes(sources: string[]): Attribute[] {
  return [
    {
      id: FIELD_KEYS.priority,
      name: "优先级",
      type: "singleSelect",
      options: [
        { id: "P0", label: "P0" },
        { id: "P1", label: "P1" },
        { id: "P2", label: "P2" },
      ],
      showOnBoard: true,
      showOnDetail: true,
    },
    {
      id: FIELD_KEYS.assignee,
      name: "负责人",
      type: "text",
      showOnBoard: true,
      showOnDetail: true,
    },
    {
      id: FIELD_KEYS.source,
      name: "来源",
      type: "singleSelect",
      options: sources.map((s) => ({ id: s, label: s })),
      showOnBoard: false,
      showOnDetail: true,
    },
    {
      id: FIELD_KEYS.deadline,
      name: "截止日期",
      type: "date",
      showOnBoard: true,
      showOnDetail: true,
    },
    {
      id: FIELD_KEYS.progress,
      name: "进度",
      type: "percent",
      showOnBoard: true,
      showOnDetail: true,
    },
    {
      id: FIELD_KEYS.releaseMethod,
      name: "发布方式",
      type: "singleSelect",
      options: RELEASE_METHODS.map((m) => ({ id: m, label: m })),
      showOnBoard: true,
      showOnDetail: true,
    },
    {
      id: FIELD_KEYS.releaseDate,
      name: "发布时间",
      type: "date",
      showOnBoard: true,
      showOnDetail: false,
    },
    {
      id: FIELD_KEYS.result,
      name: "结果",
      type: "singleSelect",
      options: [
        { id: "completed", label: "完成" },
        { id: "abandoned", label: "废弃" },
      ],
      showOnBoard: true,
      showOnDetail: true,
    },
    {
      id: "created_at",
      name: "创建时间",
      type: "computed",
      computedKind: "createdAt",
      showOnBoard: true,
      showOnDetail: true,
    },
    {
      id: "stay_days",
      name: "停留天数",
      type: "computed",
      computedKind: "stayDays",
      showOnBoard: true,
      showOnDetail: false,
    },
    {
      id: "total_days",
      name: "总耗时",
      type: "computed",
      computedKind: "totalDays",
      showOnBoard: true,
      showOnDetail: false,
    },
  ];
}

/**
 * 与旧硬编码字段等价的 Schema（迁移旧项目 / 新建项目时使用），见 REQ-029 和
 * Schema-自定义机制-讨论稿 §17。sources 是迁移时刻的一次性快照，之后来源选项
 * 的增删仍走 Project.sources（本 Phase 未接线到 schema 属性 options 上）。
 */
export function legacyEquivalentSchema(sources: string[]): Schema {
  return {
    version: SCHEMA_VERSION,
    stageOptions: legacyStageOptions(),
    attributes: legacyAttributes(sources),
    tabs: PRECAST_TABS,
    viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [] },
  };
}

/** 空白项目 Schema：只有骨架属性 Name + Stage（一个"默认"选项），供未来新建项目"空白"路径使用。 */
export function blankSchema(): Schema {
  return {
    version: SCHEMA_VERSION,
    stageOptions: [{ id: "default", label: "默认", color: paletteColorAt(0), isTerminal: false }],
    attributes: [],
    tabs: [],
    viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [] },
  };
}
