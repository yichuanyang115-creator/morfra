import { useEffect, useMemo, useRef, useState } from "react";
import { useAIConversationStore } from "../../stores/aiConversationStore";
import { useAIProviderStore } from "../../stores/aiProviderStore";
import type { AIConversationMode } from "../../types/ai";
import { ChatComposer, type ChatModelOption } from "./ChatComposer";
import { ChatContextBar } from "./ChatContextBar";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatHeader } from "./ChatHeader";
import { ChatHistoryView } from "./ChatHistoryView";
import { ChatMessage } from "./ChatMessage";
import type { AIHostActions, ChatTableContext } from "./chatTypes";

const EMPTY_CONVERSATIONS: never[] = [];

export interface ChatPanelProps {
  width: number | null;
  /** 由真实右侧宿主约束宽度时填满容器，避免窄屏抽屉溢出。 */
  fillContainer?: boolean;
  tableContext?: ChatTableContext;
  hostActions?: AIHostActions;
  onClose?: () => void;
  onOpenSettings?: () => void;
}

function dispatchSettingsRequest(): void {
  window.dispatchEvent(new CustomEvent("open-ai-service-settings"));
}

export function ChatPanel({ width, fillContainer = false, tableContext, hostActions, onClose = () => undefined, onOpenSettings = dispatchSettingsRequest }: ChatPanelProps) {
  const tableId = tableContext?.table.tableId ?? null;
  const tableName = tableContext?.table.name;
  const adapter = tableContext?.adapter;
  const providedSnapshot = tableContext?.snapshot;
  const providedSelection = tableContext?.selectedRecordIds;
  const [snapshot, setSnapshot] = useState(providedSnapshot);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [selectionIds, setSelectionIds] = useState<string[]>(providedSelection ? [...providedSelection] : []);
  const [draftMode, setDraftMode] = useState<AIConversationMode>("table-analysis");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectionReferenced, setSelectionReferenced] = useState(false);
  const [draftModelKey, setDraftModelKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const configs = useAIProviderStore((state) => state.configs);
  const secretStatus = useAIProviderStore((state) => state.secretStatus);
  const defaultProviderConfigId = useAIProviderStore((state) => state.defaultProviderConfigId);
  const lastProviderConfigId = useAIProviderStore((state) => state.lastProviderConfigId);
  const lastModelId = useAIProviderStore((state) => state.lastModelId);
  const modelIds = useAIProviderStore((state) => state.modelIds);
  const dataExfiltrationConfirmed = useAIProviderStore((state) => state.dataExfiltrationConfirmed);
  const providerLoaded = useAIProviderStore((state) => state.loaded);
  const loadProviders = useAIProviderStore((state) => state.load);

  const loadTable = useAIConversationStore((state) => state.loadTable);
  const conversationState = useAIConversationStore((state) => tableId ? state.conversationsByTable[tableId] : undefined);
  const conversations = conversationState ?? EMPTY_CONVERSATIONS;
  const currentConversationId = useAIConversationStore((state) => tableId ? state.currentConversationIdByTable[tableId] ?? null : null);
  const tableLoaded = useAIConversationStore((state) => tableId ? state.loadedTables[tableId] === true : false);
  const currentConversation = conversations.find((conversation) => conversation.id === currentConversationId) ?? null;
  const loadingTable = useAIConversationStore((state) => tableId ? state.loadingTables[tableId] === true : false);
  const activeRequest = useAIConversationStore((state) => currentConversationId ? state.activeRequests[currentConversationId] : undefined);
  const persistenceError = useAIConversationStore((state) => state.persistenceError);
  const createConversation = useAIConversationStore((state) => state.createConversation);
  const selectConversation = useAIConversationStore((state) => state.selectConversation);
  const renameConversation = useAIConversationStore((state) => state.renameConversation);
  const deleteConversation = useAIConversationStore((state) => state.deleteConversation);
  const setConversationModel = useAIConversationStore((state) => state.setConversationModel);
  const sendMessage = useAIConversationStore((state) => state.sendMessage);
  const retryMessage = useAIConversationStore((state) => state.retryMessage);
  const stopConversation = useAIConversationStore((state) => state.stopConversation);
  const copyAnswer = useAIConversationStore((state) => state.copyAnswer);

  useEffect(() => {
    if (!providerLoaded) void loadProviders();
  }, [loadProviders, providerLoaded]);

  useEffect(() => {
    setSnapshot(providedSnapshot);
    setSnapshotError(null);
    if (!adapter || !tableId || providedSnapshot) return;
    let cancelled = false;
    const refreshSnapshot = () => {
      void adapter.getTableSnapshot(tableId).then((next) => {
        if (!cancelled) { setSnapshot(next); setSnapshotError(null); }
      }).catch(() => { if (!cancelled) setSnapshotError("当前表数据暂时不可用"); });
    };
    refreshSnapshot();
    const unsubscribe = adapter.subscribe((event) => {
      if (event.type === "table-data-changed" && event.tableId === tableId) {
        refreshSnapshot();
        if (!providedSelection) setSelectionIds(adapter.getSelectedRecordIds(tableId));
      }
      if (event.type === "table-deleted" && event.tableId === tableId && !cancelled) {
        setSnapshot(undefined);
        setSnapshotError("当前表已删除，AI 会话已同步清理");
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [adapter, providedSnapshot, tableId]);

  useEffect(() => {
    if (!adapter || !tableId) { setSelectionIds(providedSelection ? [...providedSelection] : []); return; }
    setSelectionIds(providedSelection ? [...providedSelection] : adapter.getSelectedRecordIds(tableId));
    return adapter.subscribe((event) => {
      if (event.type === "selection-changed" && event.tableId === tableId && !providedSelection) setSelectionIds([...event.recordIds]);
    });
  }, [adapter, providedSelection, tableId]);

  useEffect(() => {
    if (tableId && !tableLoaded) void loadTable(tableId);
  }, [loadTable, tableId, tableLoaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [currentConversation?.messages, activeRequest]);

  const availableConfigs = useMemo(() => configs.filter((config) => secretStatus[config.id] === true), [configs, secretStatus]);
  const defaultConfig = availableConfigs.find((config) => config.id === (currentConversation?.providerConfigId ?? lastProviderConfigId ?? defaultProviderConfigId)) ?? availableConfigs[0] ?? null;
  const modelOptions = useMemo<ChatModelOption[]>(() => availableConfigs.flatMap((config) => {
    const ids = modelIds[config.id]?.length ? modelIds[config.id] : config.cachedModelIds.length ? config.cachedModelIds : [config.defaultModelId];
    return ids.map((modelId) => ({ providerConfigId: config.id, modelId, providerName: config.name }));
  }), [availableConfigs, modelIds]);
  const preferredModelKey = currentConversation ? `${currentConversation.providerConfigId}::${currentConversation.modelId}` : draftModelKey;
  const selectedModel = modelOptions.find((option) => `${option.providerConfigId}::${option.modelId}` === preferredModelKey) ?? modelOptions.find((option) => option.providerConfigId === defaultConfig?.id && option.modelId === (lastModelId ?? defaultConfig.defaultModelId)) ?? modelOptions[0] ?? null;
  const selectedProviderConfig = availableConfigs.find((config) => config.id === selectedModel?.providerConfigId) ?? defaultConfig;
  const mode = currentConversation?.mode ?? draftMode;
  const userMessages = currentConversation?.messages.filter((message) => message.role === "user") ?? [];
  const lastUserMessage = userMessages[userMessages.length - 1];
  const recordCount = snapshot?.records.length;
  const configured = availableConfigs.length > 0;
  const tableReady = Boolean(tableId && adapter);
  const tableAnalysisDisabled = mode === "table-analysis" && recordCount === 0;
  const composerDisabled = !tableReady || loadingTable || tableAnalysisDisabled || Boolean(snapshotError);

  async function ensureConversation(targetMode: AIConversationMode) {
    if (currentConversation && currentConversation.mode === targetMode) return currentConversation;
    if (!defaultConfig || !selectedModel) return null;
    return createConversation({ tableId: tableId ?? "", mode: targetMode, providerConfigId: selectedModel.providerConfigId, modelId: selectedModel.modelId });
  }

  async function sendQuestion(question: string, selectionOverride?: boolean): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed || !tableId) return;
    if (!configured || !defaultConfig || !selectedModel) { setInteractionError("请先配置可用的 AI 服务和模型。"); return; }
    if (!adapter) { setInteractionError("当前表数据尚未接入 AI 面板。"); return; }
    if (tableAnalysisDisabled && mode === "table-analysis") { setInteractionError("当前表没有记录，表格分析暂不可用；可以切换到通用对话。"); return; }
    setInteractionError(null);
    const conversation = await ensureConversation(mode);
    if (!conversation) { setInteractionError("无法创建会话，请先选择可用模型。"); return; }
    setInput("");
    const shouldReference = (selectionOverride ?? selectionReferenced) && selectionIds.length > 0;
    setSelectionReferenced(false);
    if (!selectedProviderConfig) { setInteractionError("无法找到所选 AI 服务，请重新选择模型。"); return; }
    const result = await sendMessage({ tableId, conversationId: conversation.id, question: trimmed, selectionReferenced: shouldReference, selectedRecordIds: shouldReference ? selectionIds : undefined, runtime: { adapter, providerConfig: { id: selectedProviderConfig.id, baseUrl: selectedProviderConfig.baseUrl, defaultModelId: selectedProviderConfig.defaultModelId }, modelId: selectedModel.modelId, dataExfiltrationConfirmed } });
    if (!result.ok) setInteractionError(result.message ?? "这次请求没有完成，请重试。");
    else { hostActions?.notifyGenerationCompleted?.({ tableId, conversationId: conversation.id }); window.dispatchEvent(new CustomEvent("ai-generation-completed")); }
  }

  async function handleRetry(messageId: string): Promise<void> {
    if (!tableId || !adapter || !defaultConfig || !selectedModel || !currentConversation) return;
    setInteractionError(null);
    if (!selectedProviderConfig) { setInteractionError("无法找到所选 AI 服务，请重新选择模型。"); return; }
    const result = await retryMessage({ tableId, conversationId: currentConversation.id, assistantMessageId: messageId, runtime: { adapter, providerConfig: { id: selectedProviderConfig.id, baseUrl: selectedProviderConfig.baseUrl, defaultModelId: selectedProviderConfig.defaultModelId }, modelId: selectedModel.modelId, dataExfiltrationConfirmed } });
    if (!result.ok) setInteractionError(result.message ?? "重试失败，请更换模型后再试。");
    else { hostActions?.notifyGenerationCompleted?.({ tableId, conversationId: currentConversation.id }); window.dispatchEvent(new CustomEvent("ai-generation-completed")); }
  }

  function handleModelChange(option: ChatModelOption): void {
    setDraftModelKey(`${option.providerConfigId}::${option.modelId}`);
    if (currentConversation && tableId) void setConversationModel(tableId, currentConversation.id, option.providerConfigId, option.modelId);
  }

  function handleCopy(messageId: string): void {
    if (!tableId || !currentConversation) return;
    const content = copyAnswer(tableId, currentConversation.id, messageId);
    if (content && navigator.clipboard) void navigator.clipboard.writeText(content);
  }

  function handleModeChange(nextMode: AIConversationMode): void {
    setDraftMode(nextMode);
    setHistoryOpen(false);
    if (currentConversation?.mode !== nextMode && tableId && configured) void ensureConversation(nextMode);
  }

  function handleNewConversation(): void {
    setHistoryOpen(false);
    if (tableId && configured) void createConversation({ tableId, mode, providerConfigId: selectedModel?.providerConfigId ?? defaultConfig?.id ?? "", modelId: selectedModel?.modelId ?? defaultConfig?.defaultModelId ?? "" });
  }

  if (width == null) return null;
  return <div data-theme-module="chat" className={`theme-module-chat flex h-full min-w-0 flex-col border-l border-(--module-scope-border-subtle) bg-(--module-scope-background-surface) ${fillContainer ? "w-full flex-1" : "flex-none"}`} style={fillContainer ? undefined : { width: `${width}px` }}>
    <ChatHeader mode={mode} historyOpen={historyOpen} onModeChange={handleModeChange} onOpenHistory={() => setHistoryOpen((value) => !value)} onNewConversation={handleNewConversation} onClose={onClose} />
    <ChatContextBar mode={mode} tableName={tableName} recordCount={recordCount} contextRef={lastUserMessage?.contextRef} selectedCount={selectionIds.length} selectionReferenced={selectionReferenced} onToggleSelection={() => setSelectionReferenced((value) => !value)} />
    {historyOpen && tableId ? <ChatHistoryView conversations={conversations} currentConversationId={currentConversationId} onSelect={(conversationId) => { void selectConversation(tableId, conversationId); setHistoryOpen(false); }} onRename={(conversationId, title) => { void renameConversation(tableId, conversationId, title); }} onDelete={(conversationId) => { void deleteConversation(tableId, conversationId); }} onBack={() => setHistoryOpen(false)} /> : <>
      <div ref={scrollRef} role="log" aria-live="polite" aria-busy={Boolean(activeRequest)} aria-label="AI 对话消息" className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {!tableReady ? <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-[12px] text-(--module-scope-text-secondary)"><strong className="font-[590] text-(--module-scope-text-primary)">等待当前表上下文</strong><span>AI 面板会在宿主提供只读表快照后启用分析。</span></div> : !currentConversation ? <ChatEmptyState configured={configured} tableName={tableName} recordCount={recordCount} selectedCount={selectionIds.length} snapshot={snapshot} mode={mode} onOpenSettings={onOpenSettings} onModeChange={handleModeChange} onSuggestion={(question) => { void sendQuestion(question, question === "总结已选记录"); }} /> : <div className="flex flex-col gap-2">{currentConversation.messages.map((message) => <ChatMessage key={message.id} message={message} tableId={tableId ?? ""} hostActions={hostActions} onRetry={(messageId) => { void handleRetry(messageId); }} onCopy={handleCopy} />)}{activeRequest && <span className="sr-only">生成进行中，可以继续浏览表格和记录详情。</span>}</div>}
      </div>
      {snapshotError && <p role="alert" className="m-0 border-t border-(--module-scope-feedback-danger) bg-(--module-scope-feedback-danger-soft) px-2.5 py-1.5 text-[11.5px] text-(--module-scope-feedback-danger)">{snapshotError}</p>}
      {(interactionError || persistenceError) && <p role="alert" className="m-0 border-t border-(--module-scope-feedback-danger) bg-(--module-scope-feedback-danger-soft) px-2.5 py-1.5 text-[11.5px] text-(--module-scope-feedback-danger)">{interactionError ?? persistenceError}</p>}
      {configured && tableReady && <ChatComposer value={input} onChange={setInput} onSubmit={() => { void sendQuestion(input); }} onStop={() => { if (currentConversation) void stopConversation(currentConversation.id); }} disabled={composerDisabled} generating={Boolean(activeRequest)} selectionReferenced={selectionReferenced} selectedCount={selectionIds.length} modelOptions={modelOptions} selectedModel={selectedModel} onModelChange={handleModelChange} />}
    </>}
  </div>;
}

export type { AIHostActions, ChatTableContext } from "./chatTypes";
