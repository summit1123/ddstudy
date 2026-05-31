#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/com.ddstudy.local-demo.plist"
RUNTIME_DIR="$HOME/Library/Application Support/Ddstudy/local-demo"
LOG_DIR="/tmp/ddstudy-deploy-logs"
LABEL="com.ddstudy.local-demo"
USER_ID="$(id -u)"

mkdir -p "$HOME/Library/LaunchAgents" "$RUNTIME_DIR" "$LOG_DIR"
cp "$ROOT_DIR/scripts/ddstudy-local-demo-supervisor.sh" "$RUNTIME_DIR/ddstudy-local-demo-supervisor.sh"
cp "$ROOT_DIR/scripts/ddstudy-local-demo-stop.sh" "$RUNTIME_DIR/ddstudy-local-demo-stop.sh"
chmod +x "$RUNTIME_DIR/ddstudy-local-demo-supervisor.sh" "$RUNTIME_DIR/ddstudy-local-demo-stop.sh"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$RUNTIME_DIR/ddstudy-local-demo-supervisor.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DDSTUDY_ROOT</key>
    <string>$ROOT_DIR</string>
    <key>DDSTUDY_PUBLIC_HOSTNAME</key>
    <string>ddstudy.summit1123.co.kr</string>
    <key>DDSTUDY_APP_PORT</key>
    <string>3005</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>NetworkState</key>
    <true/>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/launchagent.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchagent.err.log</string>
  <key>WorkingDirectory</key>
  <string>$RUNTIME_DIR</string>
</dict>
</plist>
PLIST

chmod +x "$ROOT_DIR/scripts/ddstudy-local-demo-supervisor.sh" "$ROOT_DIR/scripts/ddstudy-local-demo-stop.sh"

launchctl bootout "gui/$USER_ID" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$USER_ID" "$PLIST_PATH"
launchctl kickstart -k "gui/$USER_ID/$LABEL"

echo "Installed and started $LABEL"
echo "Public URL: https://ddstudy.summit1123.co.kr"
echo "Plist: $PLIST_PATH"
echo "Runtime scripts: $RUNTIME_DIR"
echo "Logs: $LOG_DIR"
