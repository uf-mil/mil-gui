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
