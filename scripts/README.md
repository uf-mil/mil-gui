# ROS Bag Helper Scripts

Quick commands to record and play back ROS2 bags for testing the simulation GUI.

## Quick Start

### 1. Record a test bag from the GUI

```powershell
# In PowerShell (Windows) - default 15 seconds, saves to bags/pool_test_01
npm run bag:record
```

This will:
- Prompt you to start the GUI simulation first
- Record `/imu/data`, `/dvl/odom`, and `/depth/pose` for 15 seconds
- Save to `bags/pool_test_01/`

**Custom bag name and duration:**
```powershell
# Record to a custom bag name for 30 seconds
wsl bash ./scripts/record-bag.sh my_test_bag 30
```

### 2. Play back a bag

```powershell
# In PowerShell (Windows) - plays bags/pool_test_01 in loop
npm run bag:play
```

This will:
- Play `bags/pool_test_01/` in loop mode at normal speed
- Press Ctrl+C to stop

**Custom bag name and playback rate:**
```powershell
# Play custom bag at 2x speed
wsl bash ./scripts/play-bag.sh my_test_bag 2.0
```

### 3. List available bags

```powershell
npm run bag:list
```

## Manual Usage (from WSL)

If you prefer to run the scripts directly in WSL:

```bash
# Record
./scripts/record-bag.sh [bag_name] [duration_seconds]

# Play
./scripts/play-bag.sh [bag_name] [rate]

# Examples
./scripts/record-bag.sh pool_test_02 20
./scripts/play-bag.sh pool_test_02 1.5
```

## Workflow for Testing Bag Mode

1. **Record a bag:**
   ```powershell
   npm start                    # Start GUI
   # Set Data Source: Synthetic Simulation, click Start
   npm run bag:record           # In another terminal
   ```

2. **Play it back:**
   ```powershell
   npm run bag:play             # Plays in loop
   # In GUI: switch to "Bag Playback (listen only)"
   # Click "Seed from ROS topics"
   ```

3. **Verify seeding works:**
   - Topics should show Hz values (not "lost!")
   - Seed button should be enabled
   - After clicking "Seed from ROS topics", you should see:
     - Green status line: "Seeded orientation from /imu/data, depth from /depth/pose, velocity from /dvl/odom — HH:MM:SS"

## Troubleshooting

**"Bag not found" error:**
- Check `npm run bag:list` to see available bags
- Make sure you recorded a bag first with `npm run bag:record`

**"No topics" when recording:**
- Ensure rosbridge is running in WSL: `ros2 launch rosbridge_server rosbridge_websocket_launch.xml`
- Start the GUI and begin synthetic simulation
- Verify topics with: `wsl ros2 topic list`

**Bag playback but GUI shows "lost!" banners:**
- Verify topics are publishing: `wsl ros2 topic hz /imu/data`
- Check rosbridge is connected (green banner in GUI)
- Ensure bag contains the right topics: `wsl ros2 bag info bags/pool_test_01`

## Notes

- All scripts run inside WSL2 (where ROS2 is installed)
- The npm commands are wrappers that invoke WSL automatically
- Bags are stored in the `bags/` directory at the repo root
- Recording uses a 15-second default duration (configurable)
- Playback runs in loop mode by default
