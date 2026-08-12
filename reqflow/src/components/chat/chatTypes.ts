import type { ActiveTableDescriptor, AIHostActionResult, TableDataAdapter, TableSnapshot } from "../../lib/ai/tableDataAdapter";

export interface AIHostActions {
  openRecord: (input: { tableId: string; recordId: string }) => Promise<AIHostActionResult>;
  notifyGenerationCompleted?: (input: { tableId: string; conversationId: string }) => void;
}

export interface ChatTableContext {
  table: ActiveTableDescriptor;
  adapter: TableDataAdapter;
  snapshot?: TableSnapshot;
  selectedRecordIds?: readonly string[];
}
