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
  exit 2
fi

cd "$MIL2_DIR"
if [ -f install/setup.bash ]; then
  source install/setup.bash
fi

echo "=== Bringup Discovery ==="
echo "Workspace: $MIL2_DIR"
echo

echo "--- ROS packages matching subjugator/bringup/front_cam ---"
ros2 pkg list | grep -Ei 'subjugator|bringup|front_cam|thruster' | sort || true
echo

if ros2 pkg prefix subjugator_bringup >/dev/null 2>&1; then
  prefix="$(ros2 pkg prefix subjugator_bringup)"
  launch_dir="$prefix/share/subjugator_bringup/launch"
  echo "--- subjugator_bringup launch directory ---"
  echo "$launch_dir"
  if [ -d "$launch_dir" ]; then
    ls -1 "$launch_dir"
  else
    echo "(launch directory not found)"
  fi
  echo
fi

echo "--- Candidate launch files in workspace (first 120) ---"
find "$MIL2_DIR" -type f \( -name "*.launch.py" -o -name "*.launch.xml" -o -name "*.launch.yaml" \) \
  | grep -Ei 'subjugator|bringup|gazebo|sim|pool|mission' \
  | head -n 120 || true
echo

echo "--- Suggested next step ---"
echo "Pick a launch file from above, then run:"
echo "  ros2 launch <package_name> <launch_file>"
