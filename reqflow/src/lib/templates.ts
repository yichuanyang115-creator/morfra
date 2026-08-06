export interface BodyTemplate {
  id: string;
  name: string;
  markdown: string;
}

export const BODY_TEMPLATES: BodyTemplate[] = [
  {
    id: "feature",
    name: "功能条目模板",
    markdown: "## 背景\n\n## 方案\n\n- \n",
  },
  {
    id: "optimization",
    name: "优化条目模板",
    markdown: "## 现状问题\n\n## 优化目标\n\n## 验证方式\n\n",
  },
];
