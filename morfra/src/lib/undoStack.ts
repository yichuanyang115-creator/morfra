export interface UndoCommand {
  summary: string;
  undo: () => Promise<void>;
}

const MAX_UNDO_DEPTH = 50;

class UndoStack {
  private commands: UndoCommand[] = [];
  private pending: Promise<void> = Promise.resolve();
  private currentVersion = 0;

  push(command: UndoCommand): void {
    this.commands.push(command);
    if (this.commands.length > MAX_UNDO_DEPTH) this.commands.shift();
  }

  /**
   * 结构操作会使此前的实体快照失效。异步写入完成后才入栈的普通操作必须带上
   * 开始时的版本，避免在属性/Tab 删除之后把旧快照重新塞回栈里。
   */
  pushIfCurrent(version: number, command: UndoCommand): void {
    if (version === this.currentVersion) this.push(command);
  }

  /** 所有会改需求数据的操作与撤销共用此队列，避免 Undo 覆盖尚在写盘的新编辑。 */
  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation, operation);
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }

  undo(): Promise<string | null> {
    return this.enqueue(async () => {
      const command = this.commands.pop();
      if (!command) return null;
      await command.undo();
      return command.summary;
    });
  }

  clear(): void {
    this.commands = [];
    this.currentVersion += 1;
  }

  get size(): number {
    return this.commands.length;
  }

  get version(): number {
    return this.currentVersion;
  }
}

/** 仅存内存，应用重启后自然清空（REQ-027）。 */
export const undoStack = new UndoStack();
