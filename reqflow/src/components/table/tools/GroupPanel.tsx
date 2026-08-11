import { isGroupable } from "../../../lib/table/groupProjection";
import { fieldOptions, Panel, type PanelProps } from "./viewToolShared";

export function GroupPanel({ fields, config, onChange, onClose }: PanelProps) {
  const groupable = fields.filter(isGroupable);
  return <Panel title="单级分组" onClose={onClose}>
    <label>字段<select value={config.group.fieldId ?? ""} onChange={(event) => onChange({ ...config, group: { fieldId: event.target.value || null, direction: config.group.direction, collapsedKeys: [] } })}><option value="">不分组</option>{fieldOptions(groupable)}</select></label>
    {config.group.fieldId && <label>顺序<select value={config.group.direction} onChange={(event) => onChange({ ...config, group: { ...config.group, direction: event.target.value === "desc" ? "desc" : "asc" } })}><option value="asc">正序</option><option value="desc">倒序</option></select></label>}
  </Panel>;
}
