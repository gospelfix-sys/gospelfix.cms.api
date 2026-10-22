#!/bin/bash
# PostToolUse 훅: Write/Edit 후 Prettier 및 ESLint 자동 실행

# stdin에서 파일 경로 추출
FILE=$(jq -r '.tool_input.file_path // empty')

# 파일 경로가 없으면 종료
[ -z "$FILE" ] && exit 0

BIN="$CLAUDE_PROJECT_DIR/node_modules/.bin"

# Prettier 실행 (모든 파일)
if [ -x "$BIN/prettier" ]; then
  "$BIN/prettier" --write "$FILE" 2>/dev/null || true
fi

# ESLint --fix 실행 (.ts, .tsx 파일만)
if echo "$FILE" | grep -qE '\.(ts|tsx)$'; then
  if [ -x "$BIN/eslint" ]; then
    "$BIN/eslint" --fix "$FILE" 2>/dev/null || true
  fi
fi
