import { DEFAULT_SOURCES, RELEASE_METHODS, STAGES } from "../types/models";
import type { Attribute, Schema, SelectOption, StageOption, TabDefinition, TabField } from "../types/schema";
import { nextPaletteColor, paletteColorAt } from "./stagePalette";
import { FIELD_KEYS } from "./requirementFields";
import type { SchemaSnapshot } from "../types/templates";

const SCHEMA_VERSION = 1;

/** 自动色一旦分配就写入 Schema；已有显式颜色永远保留。 */
function withAutoColors(options: SelectOption[]): SelectOption[] {
  const used = options.map((option) => option.color);
  return options.map((option) => {
    if (option.color !== undefined) return option;
    const color = nextPaletteColor(used);
    used.push(color);
    return { ...option, color };
  });
}

const DELIVERABLE_FIELDS: TabField[] = [
  { id: "name", name: "名称", type: "text" },
  { id: "checked", name: "完成", type: "checkbox" },
  { id: "attach", name: "附件", type: "attachment" },
];
const TASK_FIELDS: TabField[] = [
  { id: "name", name: "名称", type: "text" },
  { id: "assignee", name: "负责人", type: "text" },
  { id: "deadline", name: "截止日期", type: "date" },
  { id: "progress", name: "进度", type: "percent" },
  { id: "status", name: "状态", type: "singleSelect", options: withAutoColors([{ id: "todo", label: "待开始" }, { id: "progress", label: "进行中" }, { id: "done", label: "完成" }]) },
  { id: "blocked", name: "阻塞", type: "checkbox" },
  { id: "blockNote", name: "阻塞原因", type: "text", dependsOn: { attributeId: "blocked", value: true } },
];
const ACCEPTANCE_FIELDS: TabField[] = [
  { id: "desc", name: "描述", type: "text" },
  { id: "result", name: "结果", type: "singleSelect", options: withAutoColors([{ id: "pass", label: "通过" }, { id: "fail", label: "不通过" }, { id: "unverified", label: "未验证" }]) },
  { id: "failNote", name: "不通过原因", type: "text", dependsOn: { attributeId: "result", value: "fail" } },
];

const PRECAST_TABS: TabDefinition[] = [
  { id: "body", name: "正文", renderer: "body", visible: true },
  { id: "deliverables", name: "产出", renderer: "deliverables", visible: true, fields: DELIVERABLE_FIELDS },
  { id: "tasks", name: "任务", renderer: "tasks", visible: true, fields: TASK_FIELDS },
  { id: "acceptance", name: "验收", renderer: "acceptance", visible: true, fields: ACCEPTANCE_FIELDS },
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
        ...withAutoColors([
          { id: "P0", label: "P0" },
          { id: "P1", label: "P1" },
          { id: "P2", label: "P2" },
        ]),
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
      options: withAutoColors(sources.map((s) => ({ id: s, label: s }))),
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
      options: withAutoColors(RELEASE_METHODS.map((m) => ({ id: m, label: m }))),
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
      options: withAutoColors([
        { id: "completed", label: "完成" },
        { id: "abandoned", label: "废弃" },
      ]),
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
    viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [], globalSort: null, stageSorts: {} },
  };
}

/** 空白项目 Schema：只有骨架属性 Name + Stage（一个"默认"选项），供未来新建项目"空白"路径使用。 */
export function blankSchema(): Schema {
  return {
    version: SCHEMA_VERSION,
    stageOptions: [{ id: "default", label: "默认", color: paletteColorAt(0), isTerminal: false }],
    attributes: [],
    tabs: [],
    viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [], globalSort: null, stageSorts: {} },
  };
}

/** 将项目特有的视图偏好剥离，得到可复用的模板快照。 */
export function schemaSnapshot(schema: Schema): SchemaSnapshot {
  const { viewPreferences: _viewPreferences, ...snapshot } = schema;
  return structuredClone(snapshot);
}

/** 用模板快照创建一份无项目历史的新 Schema。 */
export function schemaFromSnapshot(snapshot: SchemaSnapshot): Schema {
  return {
    ...structuredClone(snapshot),
    viewPreferences: { columnOrder: [], columnWidths: {}, frozenCount: 0, filters: [], globalSort: null, stageSorts: {} },
  };
}

/** 内置 reqflow 模板：完整的 7 阶段、属性与五个预制 Tab。 */
export function reqflowTemplateSnapshot(): SchemaSnapshot {
  return schemaSnapshot(legacyEquivalentSchema(DEFAULT_SOURCES));
}
