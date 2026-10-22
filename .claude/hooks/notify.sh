#!/bin/bash
# .claude/hooks/notify.sh
sleep 10
if command -v osascript &>/dev/null; then
  osascript -e 'display notification "Claude 가 응답을 기다리고 있어요" with title "Claude Code" sound name "Ping"'
fi