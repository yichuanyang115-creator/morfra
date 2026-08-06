import { create } from "zustand";
import { nanoid } from "nanoid";
import { ensureDir, listFileNames, readFile, removeFile, writeFile } from "../lib/fs";
import { templatePath, templatesInitializedPath, templatesRootDir } from "../lib/paths";
import { reqflowTemplateSnapshot, schemaSnapshot } from "../lib/schemaDefaults";
import type { Schema } from "../types/schema";
import type { SchemaTemplate } from "../types/templates";

const REQFLOW_TEMPLATE_ID = "reqflow";

interface TemplateState {
  templates: SchemaTemplate[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  saveFromSchema: (name: string, schema: Schema) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSchemaSnapshot(value: unknown): value is SchemaTemplate["schemaSnapshot"] {
  return isRecord(value) && typeof value.version === "number" && Array.isArray(value.stageOptions) && Array.isArray(value.attributes) && Array.isArray(value.tabs);
}

function parseTemplate(raw: string): SchemaTemplate | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" || !isSchemaSnapshot(value.schemaSnapshot)) {
      return null;
    }
    return { id: value.id, name: value.name, schemaSnapshot: value.schemaSnapshot };
  } catch {
    return null;
  }
}

function ordered(templates: SchemaTemplate[]): SchemaTemplate[] {
  return templates.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

async function persist(template: SchemaTemplate): Promise<void> {
  await ensureDir(await templatesRootDir());
  await writeFile(await templatePath(template.id), JSON.stringify(template, null, 2));
}

async function loadTemplates(): Promise<SchemaTemplate[]> {
  const root = await templatesRootDir();
  await ensureDir(root);

  const initializedPath = await templatesInitializedPath();
  if ((await readFile(initializedPath)) === null) {
    await persist({ id: REQFLOW_TEMPLATE_ID, name: "reqflow", schemaSnapshot: reqflowTemplateSnapshot() });
    await writeFile(initializedPath, "initialized\n");
  }

  const fileNames = await listFileNames(root);
  const loaded = await Promise.all(
    fileNames
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const raw = await readFile(`${root}/${name}`);
        return raw === null ? null : parseTemplate(raw);
      }),
  );
  return ordered(loaded.filter((template): template is SchemaTemplate => template !== null));
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  loaded: false,
  loading: false,
  error: null,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      set({ templates: await loadTemplates(), loaded: true, loading: false });
    } catch {
      set({ loading: false, error: "模板读取失败，请重试" });
    }
  },

  saveFromSchema: async (name, schema) => {
    const template: SchemaTemplate = { id: nanoid(), name, schemaSnapshot: schemaSnapshot(schema) };
    await persist(template);
    set((state) => ({ templates: ordered([...state.templates, template]), error: null }));
  },

  rename: async (id, name) => {
    const current = get().templates.find((template) => template.id === id);
    if (!current) return;
    const updated = { ...current, name };
    await persist(updated);
    set((state) => ({ templates: ordered(state.templates.map((template) => (template.id === id ? updated : template))), error: null }));
  },

  remove: async (id) => {
    if (!get().templates.some((template) => template.id === id)) return;
    await removeFile(await templatePath(id));
    set((state) => ({ templates: state.templates.filter((template) => template.id !== id), error: null }));
  },
}));
