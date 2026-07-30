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

export interface Attribute {
  id: string;
  name: string;
  type: AttributeType;
  options?: SelectOption[];
  showOnBoard: boolean;
  showOnDetail: boolean;
  computedKind?: "stayDays" | "totalDays" | "createdAt";
}

export interface StageOption {
  id: string;
  label: string;
  color: string;
  isTerminal: boolean;
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
