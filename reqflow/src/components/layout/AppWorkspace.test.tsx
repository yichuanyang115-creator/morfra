import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { blankSchema } from "../../lib/schemaDefaults";
import { useProjectStore } from "../../stores/projectStore";
import { useRequirementStore } from "../../stores/requirementStore";
import { useSchemaStore } from "../../stores/schemaStore";
import { useUiStore } from "../../stores/uiStore";

vi.mock("../board/Board", () => ({ Board: () => null }));
vi.mock("../detail/DetailPanel", () => ({ DetailPanel: () => null }));
vi.mock("../app-settings/AppSettingsPage", () => ({ AppSettingsPage: () => null }));
vi.mock("../settings/SchemaSettingsWorkspace", () => ({ SchemaSettingsWorkspace: () => null }));
vi.mock("./MainLayout", () => ({ MainLayout: () => null }));
vi.mock("../topbar/Topbar", () => ({ Topbar: () => null }));

const { AppWorkspace } = await import("./AppWorkspace");

describe("AppWorkspace Phase 30 系统反馈", () => {
  it("Schema 迁移完成时使用反馈模块的 success Toast", () => {
    const acknowledgeMigration = vi.fn();
    useProjectStore.setState({ currentProjectId: "project-1" });
    useRequirementStore.setState({ requirements: [], loading: false, error: false, loadedProjectId: "project-1" });
    useSchemaStore.setState({ schema: blankSchema(), justMigrated: true, acknowledgeMigration });
    useUiStore.setState({
      selectedRequirementId: null,
      detailMode: "closed",
      activeTab: "body",
      settingsSection: null,
      appSettingsSection: null,
    });

    render(<AppWorkspace />);

    expect(screen.getByRole("status")).toHaveClass("theme-module-feedback", "border-l-(--st-done)");
    expect(screen.getByText("项目已自动升级为动态 Schema")).toBeInTheDocument();
  });
});
