export interface ThemeAuditViolation {
  file: string;
  line: number;
  rule: string;
  source: string;
}

interface AuditRule {
  name: string;
  pattern: RegExp;
}

export interface ThemeAuditSource {
  file: string;
  source: string;
}

const AUDIT_RULES: AuditRule[] = [
  {
    name: "fixed-color-function-or-hex",
    pattern: /#(?:[0-9a-f]{3,8})\b|\b(?:rgba?|hsla?)\s*\(/i,
  },
  {
    name: "tailwind-fixed-color",
    pattern: /\b(?:bg|text|border|ring|shadow|fill|stroke|from|via|to|divide|placeholder|decoration|accent|caret|outline)-(?:white|black|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|grey|slate|zinc|neutral|stone)(?:-|[\s"'`])/i,
  },
  {
    name: "legacy-component-token",
    pattern: /--(?:bg|surface(?:-2)?|topbar(?!-h\b)|fg|muted(?:-2)?|border(?:-strong)?|accent(?:-(?:text|soft(?:-strong)?|solid(?:-fg)?|selected))?|context-strong|sev-p[0-2](?:-soft)?|st-(?:todo|progress|done|blocked)(?:-soft)?)\b/i,
  },
];

function isSourceFile(file: string): boolean {
  return /\.(?:ts|tsx|css)$/.test(file) && !/\.test\.(?:ts|tsx)$/.test(file);
}

export function auditComponentThemeUsage(sources: ThemeAuditSource[]): ThemeAuditViolation[] {
  return sources.filter(({ file }) => isSourceFile(file)).flatMap(({ file, source: contents }) => {
    const lines = contents.split(/\r?\n/);
    return lines.flatMap((source, index) =>
      AUDIT_RULES.flatMap((rule) =>
        rule.pattern.test(source) ? [{ file, line: index + 1, rule: rule.name, source: source.trim() }] : [],
      ),
    );
  });
}
