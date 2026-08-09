export type TableFieldType =
  | "text"
  | "number"
  | "percent"
  | "singleSelect"
  | "multiSelect"
  | "date"
  | "checkbox"
  | "attachment"
  | "computed";

export interface TableAttachment {
  id: string;
  name: string;
  url?: string;
  mimeType?: string;
}

export type TableCellValue =
  | string
  | number
  | boolean
  | string[]
  | TableAttachment[]
  | null;

export interface ActiveTableDescriptor {
  tableId: string;
  name: string;
}

export interface TableFieldOption {
  id: string;
  label: string;
}

export interface TableField {
  id: string;
  name: string;
  type: TableFieldType;
  options?: TableFieldOption[];
}

export interface TableRecord {
  id: string;
  values: Record<string, TableCellValue>;
}

export interface TableSnapshot {
  tableId: string;
  name: string;
  schemaVersion: string;
  primaryTitleFieldId: string;
  fields: TableField[];
  records: TableRecord[];
  capturedAt: string;
}

export type TableEvent =
  | { type: "active-table-changed"; tableId: string | null }
  | { type: "table-data-changed"; tableId: string }
  | { type: "selection-changed"; tableId: string; recordIds: string[] }
  | { type: "table-deleted"; tableId: string };

export class TableSnapshotValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`表快照无效（${path}）：${message}`);
    this.name = "TableSnapshotValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TableSnapshotValidationError(path, "必须是非空字符串");
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, path);
}

function normalizeOptions(value: unknown, path: string): TableFieldOption[] {
  if (!Array.isArray(value)) {
    throw new TableSnapshotValidationError(path, "必须是数组");
  }
  const optionIds = new Set<string>();
  return value.map((option, index) => {
    if (!isRecord(option)) {
      throw new TableSnapshotValidationError(`${path}[${index}]`, "必须是对象");
    }
    const id = requiredString(option.id, `${path}[${index}].id`);
    if (optionIds.has(id)) {
      throw new TableSnapshotValidationError(`${path}[${index}].id`, "选项 ID 不能重复");
    }
    optionIds.add(id);
    return { id, label: requiredString(option.label, `${path}[${index}].label`) };
  });
}

function normalizeAttachment(value: unknown, path: string): TableAttachment {
  if (!isRecord(value)) {
    throw new TableSnapshotValidationError(path, "附件元数据必须是对象");
  }
  return {
    id: requiredString(value.id, `${path}.id`),
    name: requiredString(value.name, `${path}.name`),
    url: optionalString(value.url, `${path}.url`),
    mimeType: optionalString(value.mimeType, `${path}.mimeType`),
  };
}

function isValidDate(value: string): boolean {
  return value.length > 0 && !Number.isNaN(Date.parse(value));
}

function normalizeDate(value: string): string {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(value);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function normalizeValue(
  value: unknown,
  field: TableField,
  path: string,
): TableCellValue {
  if (value === null || value === undefined) return null;

  switch (field.type) {
    case "text":
      if (typeof value !== "string") break;
      return value;
    case "number":
      if (typeof value === "number" && Number.isFinite(value)) return value;
      break;
    case "percent":
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
        return value;
      }
      break;
    case "singleSelect":
      if (typeof value === "string" && field.options?.some((option) => option.id === value)) {
        return value;
      }
      break;
    case "multiSelect":
      if (
        Array.isArray(value) &&
        value.every((item): item is string => typeof item === "string") &&
        new Set(value).size === value.length &&
        value.every((item) => field.options?.some((option) => option.id === item) === true)
      ) {
        return [...value];
      }
      break;
    case "date":
      if (typeof value === "string" && isValidDate(value)) return normalizeDate(value);
      break;
    case "checkbox":
      if (typeof value === "boolean") return value;
      break;
    case "attachment":
      if (Array.isArray(value)) return value.map((item, index) => normalizeAttachment(item, `${path}[${index}]`));
      break;
    case "computed":
      if (
        typeof value === "string" ||
        typeof value === "number" && Number.isFinite(value) ||
        typeof value === "boolean"
      ) {
        return value;
      }
      break;
  }

  throw new TableSnapshotValidationError(path, `与字段类型 ${field.type} 不匹配`);
}

export function normalizeTableSnapshot(input: unknown): TableSnapshot {
  if (!isRecord(input)) {
    throw new TableSnapshotValidationError("snapshot", "必须是对象");
  }

  const tableId = requiredString(input.tableId, "tableId");
  const fieldsInput = input.fields;
  if (!Array.isArray(fieldsInput) || fieldsInput.length === 0) {
    throw new TableSnapshotValidationError("fields", "必须至少包含一个字段");
  }

  const fieldIds = new Set<string>();
  const fields = fieldsInput.map((field, index) => {
    if (!isRecord(field)) {
      throw new TableSnapshotValidationError(`fields[${index}]`, "必须是对象");
    }
    const id = requiredString(field.id, `fields[${index}].id`);
    if (fieldIds.has(id)) {
      throw new TableSnapshotValidationError(`fields[${index}].id`, "字段 ID 不能重复");
    }
    fieldIds.add(id);
    const type = field.type;
    if (
      type !== "text" && type !== "number" && type !== "percent" && type !== "singleSelect" &&
      type !== "multiSelect" && type !== "date" && type !== "checkbox" && type !== "attachment" &&
      type !== "computed"
    ) {
      throw new TableSnapshotValidationError(`fields[${index}].type`, "不是支持的字段类型");
    }
    const fieldType = type as TableFieldType;
    const options = field.options === undefined ? undefined : normalizeOptions(field.options, `fields[${index}].options`);
    if ((fieldType === "singleSelect" || fieldType === "multiSelect") && (!options || options.length === 0)) {
      throw new TableSnapshotValidationError(`fields[${index}].options`, "选择字段必须定义选项");
    }
    if (fieldType !== "singleSelect" && fieldType !== "multiSelect" && options !== undefined) {
      throw new TableSnapshotValidationError(`fields[${index}].options`, "非选择字段不能定义选项");
    }
    return { id, name: requiredString(field.name, `fields[${index}].name`), type: fieldType, options };
  });

  const primaryTitleFieldId = requiredString(input.primaryTitleFieldId, "primaryTitleFieldId");
  if (!fieldIds.has(primaryTitleFieldId)) {
    throw new TableSnapshotValidationError("primaryTitleFieldId", "必须指向已存在字段");
  }

  if (!Array.isArray(input.records)) {
    throw new TableSnapshotValidationError("records", "必须是数组");
  }
  const recordIds = new Set<string>();
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const records = input.records.map((record, index) => {
    if (!isRecord(record)) {
      throw new TableSnapshotValidationError(`records[${index}]`, "必须是对象");
    }
    const id = requiredString(record.id, `records[${index}].id`);
    if (recordIds.has(id)) {
      throw new TableSnapshotValidationError(`records[${index}].id`, "记录 ID 不能重复");
    }
    recordIds.add(id);
    if (!isRecord(record.values)) {
      throw new TableSnapshotValidationError(`records[${index}].values`, "必须是对象");
    }
    for (const key of Object.keys(record.values)) {
      if (!fieldMap.has(key)) {
        throw new TableSnapshotValidationError(`records[${index}].values.${key}`, "字段不存在");
      }
    }
    const values: Record<string, TableCellValue> = {};
    for (const field of fields) {
      values[field.id] = normalizeValue(record.values[field.id], field, `records[${index}].values.${field.id}`);
    }
    return { id, values };
  });

  return {
    tableId,
    name: requiredString(input.name, "name"),
    schemaVersion: requiredString(input.schemaVersion, "schemaVersion"),
    primaryTitleFieldId,
    fields,
    records,
    capturedAt: requiredString(input.capturedAt, "capturedAt"),
  };
}

function formatValue(value: TableCellValue, field: TableField): string {
  if (value === null) return "";
  if (field.type === "singleSelect" && typeof value === "string") {
    return field.options?.find((option) => option.id === value)?.label ?? value;
  }
  if (field.type === "multiSelect" && Array.isArray(value)) {
    return value
      .map((id) => field.options?.find((option) => option.id === id)?.label ?? id)
      .join("、");
  }
  if (field.type === "checkbox" && typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : item.name)).join("、");
  }
  return String(value);
}

export function getRecordTitle(snapshot: TableSnapshot, recordId: string): string {
  const record = snapshot.records.find((candidate) => candidate.id === recordId);
  if (!record) throw new Error(`找不到记录：${recordId}`);
  const field = snapshot.fields.find((candidate) => candidate.id === snapshot.primaryTitleFieldId);
  if (!field) throw new Error(`主标题字段不存在：${snapshot.primaryTitleFieldId}`);
  const title = formatValue(record.values[field.id], field).trim();
  return title.length > 0 ? title : "未命名记录";
}
