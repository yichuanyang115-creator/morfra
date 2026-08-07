import { useMemo, useState } from "react";
import type { TabDefinition } from "../../../types/schema";
import { EmptyState } from "../../shared/EmptyState";
import { GenericCard } from "./GenericCard";
import { useTabRecordStore } from "../../../stores/tabRecordStore";
import { useRequirementStore } from "../../../stores/requirementStore";

interface GenericTabProps {
  projectId: string | null;
  requirementId: string;
  tab: TabDefinition;
  draftOpen: boolean;
  onCloseDraft: () => void;
}

export function GenericTab({ projectId, requirementId, tab, draftOpen, onCloseDraft }: GenericTabProps) {
  const requirement = useRequirementStore((state) => state.requirements.find((item) => item.id === requirementId));
  const records = useMemo(() => (requirement?.tabRecords ?? []).filter((record) => record.tabId === tab.id), [requirement?.tabRecords, tab.id]);
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>({});
  const fields = tab.fields ?? [{ id: "name", name: "名称", type: "text" as const }];

  if (!projectId) return <EmptyState text="项目尚未加载" />;

  return (
    <div>
      {records.length === 0 && !draftOpen && <EmptyState text={`还没有${tab.name}记录，点右上角 + 添加`} />}
      {draftOpen && <>
        <GenericCard record={{ id: "draft", tabId: tab.id, fieldValues: draftValues, createdAt: "" }} fields={fields} onUpdate={setDraftValues} onRemove={() => { onCloseDraft(); setDraftValues({}); }} />
        <button type="button" onClick={() => { if (Object.values(draftValues).some((value) => value !== "" && value != null && value !== false)) { void useTabRecordStore.add(projectId, requirementId, tab.id, draftValues); onCloseDraft(); setDraftValues({}); } }} className="mb-2 rounded-(--r-sm) bg-(--accent-solid) px-2.5 py-1.5 text-[12px] text-(--accent-solid-fg)">保存记录</button>
      </>}
      {records.map((record) => <GenericCard key={record.id} record={record} fields={fields} onUpdate={(values) => void useTabRecordStore.update(projectId, requirementId, record.id, values)} onRemove={() => void useTabRecordStore.remove(projectId, requirementId, record.id)} />)}
    </div>
  );
}
