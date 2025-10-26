#!/bin/bash
# Helper script to record a test bag from the GUI's synthetic simulation
# Usage: ./scripts/record-bag.sh [bag_name] [duration_seconds]

BAG_NAME="${1:-pool_test_01}"
DURATION="${2:-15}"
BAG_DIR="$(cd "$(dirname "$0")/.." && pwd)/bags/${BAG_NAME}"

echo "========================================="
echo "Recording ROS2 bag for ${DURATION} seconds"
echo "Bag: ${BAG_NAME}"
echo "Path: ${BAG_DIR}"
echo "========================================="
echo ""
echo "Topics to record:"
echo "  - /imu/data (sensor_msgs/Imu)"
echo "  - /dvl/odom (nav_msgs/Odometry)"
echo "  - /depth/pose (geometry_msgs/PoseWithCovarianceStamped)"
echo ""
echo "Before recording:"
echo "  1. Start the GUI (npm start)"
echo "  2. Set Data Source: Synthetic Simulation"
echo "  3. Click 'Start Simulation'"
echo "  4. Wait a few seconds for topics to stabilize"
echo ""
read -p "Press Enter when simulation is running, or Ctrl+C to cancel..."

# Remove existing bag if present
if [ -d "$BAG_DIR" ]; then
    echo "Removing existing bag at $BAG_DIR"
    rm -rf "$BAG_DIR"
fi

echo ""
echo "Recording for ${DURATION} seconds..."
echo "Press Ctrl+C to stop early."
echo ""

# Record with timeout
timeout ${DURATION}s ros2 bag record \
    /imu/data \
    /dvl/odom \
    /depth/pose \
    -o "$BAG_DIR" \
    || true

echo ""
echo "========================================="
echo "Recording complete!"
echo "========================================="
echo ""

# Show bag info
if [ -f "${BAG_DIR}/metadata.yaml" ]; then
    ros2 bag info "$BAG_DIR"
    echo ""
    echo "To play this bag:"
    echo "  npm run bag:play -- ${BAG_NAME}"
    echo ""
    echo "Or manually:"
    echo "  ros2 bag play ${BAG_DIR} -l"
else
    echo "ERROR: No metadata.yaml found. Recording may have failed."
    echo "Make sure:"
    echo "  - rosbridge is running (ros2 launch rosbridge_server rosbridge_websocket_launch.xml)"
    echo "  - GUI simulation is publishing topics"
    echo "  - You can see topics with: ros2 topic list"
fi
