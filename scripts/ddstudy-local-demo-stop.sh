#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${DDSTUDY_ROOT:-/Users/gimdonghyeon/Desktop/live2d/nnnnnrrrrrin}"

for session_name in ddstudy-app ddstudy-tunnel; do
  while read -r session; do
    [ -n "$session" ] || continue
    screen -S "$session" -X quit >/dev/null 2>&1 || true
  done < <(screen -ls 2>/dev/null | awk -v name=".$session_name" '$1 ~ name {print $1}')
done

pkill -f "ddstudy-local-demo-supervisor.sh" >/dev/null 2>&1 || true
pkill -f "$ROOT_DIR.*next start.*3005" >/dev/null 2>&1 || true

echo "Ddstudy local demo sessions stopped."
