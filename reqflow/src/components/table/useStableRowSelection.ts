import { useCallback, useEffect, useRef } from "react";
import type { GridSelection } from "../../lib/table/selectionModel";
import { useGridInteractionStore } from "../../stores/gridInteractionStore";
import type { RecordData } from "../../types/domain";

export function useStableRowSelection(input: {
  viewId: string;
  records: RecordData[];
  onSelectionChange?: (recordIds: string[]) => void;
  focusGrid: () => void;
}) {
  const selectedRecordIdsRef = useRef<string[]>([]);
  const activeRecordIdRef = useRef<string | null>(null);
  const onSelectionChangeRef = useRef(input.onSelectionChange);
  const recordsRef = useRef(input.records);
  const focusGridRef = useRef(input.focusGrid);
  onSelectionChangeRef.current = input.onSelectionChange;
  recordsRef.current = input.records;
  focusGridRef.current = input.focusGrid;
  const interaction = useGridInteractionStore();

  useEffect(() => {
    selectedRecordIdsRef.current = [];
    activeRecordIdRef.current = null;
    onSelectionChangeRef.current?.([]);
    useGridInteractionStore.getState().initialize(input.viewId);
  }, [input.viewId]);

  useEffect(() => {
    if (!onSelectionChangeRef.current || interaction.viewId !== input.viewId) return;
    const rowByRecordId = new Map(input.records.map((record, row) => [record.id, row]));
    const selectedRecordIds = selectedRecordIdsRef.current.filter((recordId) => rowByRecordId.has(recordId));
    selectedRecordIdsRef.current = selectedRecordIds;
    const selectedRows = selectedRecordIds.map((recordId) => rowByRecordId.get(recordId)).filter((row): row is number => row !== undefined).sort((left, right) => left - right);
    const currentSelection = interaction.selection;
    if (!selectedRows.length && currentSelection?.rows.length) {
      activeRecordIdRef.current = null;
      interaction.clearSelection();
    } else if (selectedRows.length) {
      const activeRow = rowByRecordId.get(activeRecordIdRef.current ?? "") ?? selectedRows[0];
      const column = currentSelection?.active.column ?? 0;
      const rowsChanged = currentSelection?.rows.length !== selectedRows.length || selectedRows.some((row, index) => currentSelection.rows[index] !== row);
      if (rowsChanged || currentSelection?.active.row !== activeRow) {
        const active = { row: activeRow, column };
        interaction.setSelection({ active, range: { anchor: active, focus: active }, rows: selectedRows });
      }
    }
    onSelectionChangeRef.current(selectedRecordIds);
  }, [input.records, input.viewId, interaction, interaction.selection, interaction.viewId]);

  const clearStableSelection = useCallback(() => {
    selectedRecordIdsRef.current = [];
    activeRecordIdRef.current = null;
    onSelectionChangeRef.current?.([]);
  }, []);

  const applyRowSelection = useCallback((selection: GridSelection) => {
    const selectedRecordIds = selection.rows.map((row) => recordsRef.current[row]?.id).filter((id): id is string => Boolean(id));
    selectedRecordIdsRef.current = selectedRecordIds;
    activeRecordIdRef.current = recordsRef.current[selection.active.row]?.id ?? null;
    useGridInteractionStore.getState().setSelection(selection);
    onSelectionChangeRef.current?.(selectedRecordIds);
    focusGridRef.current();
  }, []);

  return { clearStableSelection, applyRowSelection };
}
