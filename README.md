# SubjuGator GUI

## running the gui

`npm install`

install dependancies<br>
`npm install react-scripts@5.0.1`

`npm start`
:)

install ros bridge
-
`sudo apt install ros-jazzy-rosbridge-suite -y`

running ros bridge
-
`ros2 launch rosbridge_server rosbridge_websocket_launch.xml`

mil2 health check from Windows terminal
-
`npm run mil2:health`

This prints explicit PASS/WARN/FAIL statuses for launch-flow nodes/services/topics.

bringup discovery (find your actual launch files)
-
`npm run mil2:discover`

If `/thruster_efforts` is missing, the GUI will not subscribe to it and the thruster panel remains disabled.
If camera publishers are unavailable, use the Camera panel `Enable Test Pattern` toggle to verify GUI rendering.

### custom hooks

The useRos hook manages the WebSocket (re)connection in the background. 

#### example usage

```jsx
import { useRos } from './RosContext';

...

// inside your component
const { ros, connected } = useRos()

// Use the ros variable the same way you would if it were defined with:
// const ros = new ROSLIB.Ros({})
topicRef.current = new ROSLIB.Topic({
    ros: ros,
    name: '/hi_adam',
    messageType: 'std_msgs/String'
});

// The connected variable is basically just useState of the websocket's connection status
const msg_status = connected ? "connected" : "not connected";
return ( <div> {msg_status} </div>)
```
