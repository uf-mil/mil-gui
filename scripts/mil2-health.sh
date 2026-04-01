#!/usr/bin/env bash
set -euo pipefail

choose_ros_setup() {
  for setup in /opt/ros/jazzy/setup.bash /opt/ros/humble/setup.bash /opt/ros/iron/setup.bash; do
    if [ -f "$setup" ]; then
      echo "$setup"
      return
    fi
  done
  echo ""
}

ROS_SETUP="$(choose_ros_setup)"
if [ -z "$ROS_SETUP" ]; then
  echo "[FAIL] Could not find ROS setup.bash (checked jazzy/humble/iron)."
  exit 2
fi
source "$ROS_SETUP"

MIL2_DIR="${MIL2_DIR:-$HOME/mil2}"
if [ ! -d "$MIL2_DIR" ]; then
  echo "[FAIL] mil2 workspace not found at: $MIL2_DIR"
  echo "Set MIL2_DIR or clone mil2 to ~/mil2"
  exit 2
fi

cd "$MIL2_DIR"
if [ -f install/setup.bash ]; then
  source install/setup.bash
fi

nodes="$(ros2 node list 2>/dev/null || true)"
services="$(ros2 service list 2>/dev/null || true)"
topics="$(ros2 topic list -t 2>/dev/null || true)"

count_lines() {
  printf '%s\n' "$1" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' '
}

has_line_like() {
  local haystack="$1"
  local regex="$2"
  if printf '%s\n' "$haystack" | grep -Eq "$regex"; then
    echo "yes"
  else
    echo "no"
  fi
}

NODE_COUNT="$(count_lines "$nodes")"
SERVICE_COUNT="$(count_lines "$services")"
TOPIC_COUNT="$(count_lines "$topics")"

echo "=== MIL2 Health Check ==="
echo "ROS setup: $ROS_SETUP"
echo "Workspace: $MIL2_DIR"
echo "Nodes: $NODE_COUNT"
echo "Services: $SERVICE_COUNT"
echo "Topics: $TOPIC_COUNT"
echo

failures=0

if [ "$NODE_COUNT" -eq 0 ]; then
  echo "[FAIL] No ROS nodes found. Bringup is likely not running."
  failures=$((failures + 1))
else
  echo "[PASS] ROS graph has active nodes."
fi

if [ "$(has_line_like "$nodes" '/rosbridge_websocket$')" = "yes" ]; then
  echo "[PASS] rosbridge node is present."
else
  echo "[FAIL] rosbridge node (/rosbridge_websocket) is missing."
  failures=$((failures + 1))
fi

if [ "$(has_line_like "$services" '/subjugator_localization/(enable|reset)$')" = "yes" ]; then
  echo "[PASS] localization services detected."
else
  echo "[WARN] localization enable/reset services not detected."
fi

if [ "$(has_line_like "$services" '/pid_controller/enable$')" = "yes" ]; then
  echo "[PASS] controller enable service detected."
else
  echo "[WARN] /pid_controller/enable service not detected."
fi

if [ "$(has_line_like "$topics" '/odometry/filtered[[:space:]]')" = "yes" ]; then
  echo "[PASS] /odometry/filtered topic detected."
else
  echo "[WARN] /odometry/filtered topic not detected."
fi

if [ "$(has_line_like "$topics" '/thruster_efforts[[:space:]]')" = "yes" ]; then
  echo "[PASS] /thruster_efforts topic detected."
else
  echo "[WARN] /thruster_efforts topic not detected (thruster panel will stay disabled)."
fi

if [ "$(has_line_like "$topics" '/cmd_wrench[[:space:]]')" = "yes" ]; then
  echo "[PASS] /cmd_wrench topic detected."
else
  echo "[WARN] /cmd_wrench topic not detected."
fi

echo
echo "--- quick sample (nodes) ---"
printf '%s\n' "$nodes" | head -n 12
echo "--- quick sample (services filtered) ---"
printf '%s\n' "$services" | grep -E 'unkill|subjugator_localization|pid_controller|kill' || true
echo "--- quick sample (topics filtered) ---"
printf '%s\n' "$topics" | grep -E 'odometry/filtered|thruster_efforts|cmd_wrench|image|compressed' || true

echo
if [ "$failures" -gt 0 ]; then
  echo "[RESULT] FAIL ($failures blocking issue(s))"
  echo "Run: npm run mil2:discover to find bringup launch files."
  exit 1
fi

echo "[RESULT] PASS"
