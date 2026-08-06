export type AttributeType =
  | "singleSelect"
  | "multiSelect"
  | "number"
  | "percent"
  | "date"
  | "text"
  | "checkbox"
  | "attachment"
  | "computed";

export interface SelectOption {
  id: string;
  label: string;
  color?: string;
}

/** 属性依赖显示条件（单条件）：本属性仅当 attributeId 取 value 时显示。见 Schema-自定义机制-讨论稿 §4.1，Phase 20 接引擎生效，本 Phase 只落配置。 */
export interface AttributeDependency {
  attributeId: string;
  value: unknown;
}

export interface Attribute {
  id: string;
  name: string;
  type: AttributeType;
  options?: SelectOption[];
  showOnBoard: boolean;
  showOnDetail: boolean;
  computedKind?: "stayDays" | "totalDays" | "createdAt";
  dependsOn?: AttributeDependency;
}

/** 阶段覆盖映射：该阶段下 fromAttributeId 被 toAttributeId 替换（占同一列位）。见 Schema-自定义机制-讨论稿 §4.2，Phase 20 接引擎生效，本 Phase 只落配置。 */
export interface AttributeOverride {
  fromAttributeId: string;
  toAttributeId: string;
}

export interface StageOption {
  id: string;
  label: string;
  color: string;
  isTerminal: boolean;
  attributeOverrides?: AttributeOverride[];
}

export type TabRenderer = "body" | "deliverables" | "tasks" | "acceptance" | "activity" | "generic";

export interface TabDefinition {
  id: string;
  name: string;
  renderer: TabRenderer;
  visible: boolean;
}

/**
 * 看板筛选运算符（REQ-026："运算符按类型区分"）。is_empty/is_not_empty 通用，UI 只对
 * 指定类型暴露对应运算符（见 lib/filterEngine 的 operatorsFor）。
 */
export type FilterOperator =
  | "eq"
  | "neq"
  | "is_empty"
  | "is_not_empty"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "before"
  | "after";

/** 看板筛选单条条件：选属性 → 选运算符 → 选值（REQ-026）。attributeId 为空视为未完成条件，不参与筛选。 */
export interface FilterCondition {
  attributeId: string;
  operator: FilterOperator;
  value: unknown;
}

export type SortDirection = "asc" | "desc";

export interface SortRule {
  attrId: string;
  direction: SortDirection;
}

export type StageSortPreference = SortRule | { mode: "manual" };

export interface ViewPreferences {
  columnOrder: string[];
  columnWidths: Record<string, number>;
  /** 从左向右连续冻结的属性列数量，不含固定冻结的 Name 列（见 REQ-001 列冻结）。 */
  frozenCount: number;
  /** 看板筛选条件集合，多条件 AND（REQ-026），按项目落盘。 */
  filters: FilterCondition[];
  /** 全局排序规则，未设置时各阶段保持当前顺序。 */
  globalSort?: SortRule | null;
  /** 阶段局部排序规则；mode=manual 表示该阶段被手动拖拽覆盖。 */
  stageSorts?: Record<string, StageSortPreference>;
}

export interface Schema {
  version: number;
  stageOptions: StageOption[];
  attributes: Attribute[];
  tabs: TabDefinition[];
  viewPreferences: ViewPreferences;
}
