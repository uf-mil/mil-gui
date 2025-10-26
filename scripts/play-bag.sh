#!/bin/bash
# Helper script to play back a recorded bag
# Usage: ./scripts/play-bag.sh [bag_name] [rate]

BAG_NAME="${1:-pool_test_01}"
RATE="${2:-1.0}"
BAG_DIR="$(cd "$(dirname "$0")/.." && pwd)/bags/${BAG_NAME}"

echo "========================================="
echo "Playing ROS2 bag"
echo "Bag: ${BAG_NAME}"
echo "Path: ${BAG_DIR}"
echo "Rate: ${RATE}x"
echo "========================================="
echo ""

# Check if bag exists
if [ ! -f "${BAG_DIR}/metadata.yaml" ]; then
    echo "ERROR: Bag not found at ${BAG_DIR}"
    echo ""
    echo "Available bags:"
    ls -1 "$(dirname "$0")/../bags" 2>/dev/null || echo "  (none)"
    echo ""
    echo "To record a new bag:"
    echo "  npm run bag:record -- ${BAG_NAME}"
    exit 1
fi

# Show bag info
ros2 bag info "$BAG_DIR"
echo ""
echo "Playing in loop mode. Press Ctrl+C to stop."
echo ""

# Play bag in loop mode
ros2 bag play "$BAG_DIR" -l -r "$RATE"
