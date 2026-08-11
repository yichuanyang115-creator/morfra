import type { ProjectedGroup } from "../../../lib/table/groupProjection";

interface GroupBarProps { groups: ProjectedGroup[]; uniqueCount: number; collapsedKeys: string[]; canCreate: boolean; onToggle: (key: string) => void; onCreate: (key: string) => void; onExpandAll: () => void; onCollapseAll: () => void; }

export function GroupBar({ groups, uniqueCount, collapsedKeys, canCreate, onToggle, onCreate, onExpandAll, onCollapseAll }: GroupBarProps) {
  return <section className="morfra-grid-group-bar" aria-label="表格分组">
    <span>{uniqueCount} 条唯一记录</span>
    <button type="button" onClick={onExpandAll}>全部展开</button><button type="button" onClick={onCollapseAll}>全部折叠</button>
    <div>{groups.map((group) => { const collapsed = collapsedKeys.includes(group.key); return <span key={group.key}><button type="button" aria-pressed={!collapsed} onClick={() => onToggle(group.key)}>{collapsed ? "›" : "⌄"} {group.label} · {group.count}</button>{canCreate && <button type="button" aria-label={`在${group.label}分组中新建记录`} onClick={() => onCreate(group.key)}>＋</button>}</span>; })}</div>
  </section>;
}
