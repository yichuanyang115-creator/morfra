import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "./workspaceStore";

describe("workspace selection state", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ activeTableByProject: {}, activeViewByTable: {} });
  });

  it("keeps table and view selection isolated by project/table", () => {
    useWorkspaceStore.getState().setActiveTable("project-a", "table-a");
    useWorkspaceStore.getState().setActiveTable("project-b", "table-b");
    useWorkspaceStore.getState().setActiveView("table-a", "view-a");
    useWorkspaceStore.getState().setActiveView("table-b", "view-b");

    expect(useWorkspaceStore.getState().activeTableByProject).toEqual({ "project-a": "table-a", "project-b": "table-b" });
    expect(useWorkspaceStore.getState().activeViewByTable).toEqual({ "table-a": "view-a", "table-b": "view-b" });
  });

  it("clears a project's table selection without touching another project", () => {
    useWorkspaceStore.getState().setActiveTable("project-a", "table-a");
    useWorkspaceStore.getState().setActiveTable("project-b", "table-b");

    useWorkspaceStore.getState().clearProject("project-a");

    expect(useWorkspaceStore.getState().activeTableByProject).toEqual({ "project-b": "table-b" });
  });
});
