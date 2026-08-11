#!/bin/bash
# PostToolUse hook: 代码文件被编辑/创建后标记需要 review
# 排除已知的非代码文件，其余都触发

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 只管项目目录内的文件，/tmp 等外部路径不触发
case "$FILE_PATH" in
  "$(git rev-parse --show-toplevel)"/*) ;;
  *) exit 0 ;;
esac

# 无扩展名的文件（脚本草稿、数据、内容稿等）不是项目代码，不触发
case "$(basename "$FILE_PATH")" in
  *.*) ;;
  *) exit 0 ;;
esac

# 排除框架元目录和非代码文件，其余才标记需要 review
case "$FILE_PATH" in
  */.codex/*|*/.agents/*|*.md|*.txt|*.json|*.yaml|*.yml|*.toml|*.lock|*.log|*.env|*.env.*|*.gitignore|*.prettierrc|*.eslintrc)
    ;;
  *)
    echo "needs_review" > "$(git rev-parse --show-toplevel)/.codex/.needs-review"
    ;;
esac

exit 0
