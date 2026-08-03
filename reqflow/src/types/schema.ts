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

export interface ViewPreferences {
  columnOrder: string[];
  columnWidths: Record<string, number>;
}

export interface Schema {
  version: number;
  stageOptions: StageOption[];
  attributes: Attribute[];
  tabs: TabDefinition[];
  viewPreferences: ViewPreferences;
}
