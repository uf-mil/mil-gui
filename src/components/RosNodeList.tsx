import React, { useState, useEffect } from 'react';
import ROSLIB from 'roslib'; 

function RosNodeStatus() {
    const expectedNodes = ['/depth_sensor_node', '/depth_to_pose', '/dvl_bridge_node', '/hydrophone_node','/pid_controller',
        '/reset_localization_service','/robot_state_publisher','/ros_gz_bridge','/rviz','/subjugator_localization',
        '/subjugator_path_planner','/subjugator_trajectory_planner','/thruster_bridge_node','/thruster_manager',
        '/transform_listener_impl_5b676bf83270','/transform_listener_impl_615e20107470','/wrench_tuner']; // Replace this with the actual expected nodes

    const [runningNodes, setRunningNodes] = useState<string[]>([]);
    const rosBridgeUrl = 'ws://localhost:9090'
    useEffect(() => {
        const ros = new ROSLIB.Ros({
            url: rosBridgeUrl
        });

        ros.on('connection', () => {
            console.log('Successfully connected to ROS bridge server.');
        });

        ros.on('error', (error) => {
            console.error('Error connecting to ROS bridge server: ', error);
        });

        ros.on('close', () => {
            console.log('Connection to ROS bridge server closed.');
        });

        const intervalId = setInterval(() => {
            ros.getNodes(
            (nodes: string[]) => {
                console.log('Fetched Nodes:', nodes);
                setRunningNodes(nodes);
            },
            (error) => {
                console.error('Failed to get ROS nodes:', error);
            }
            );
        }, 2000);

        return () => {
            clearInterval(intervalId);
            ros.close();
        };
    }, []);
    const greenNodes = runningNodes.filter(node => expectedNodes.includes(node));
    const redNodes = expectedNodes.filter(node => !runningNodes.includes(node));
    const yellowNodes = runningNodes.filter(node => !expectedNodes.includes(node));

    return (
        <div style={{ fontFamily: 'sans-serif', display: 'flex', justifyContent: 'space-around' }}>
        {/* Green Box */}
        <div style={{ border: '1px solid #2e7d32', borderRadius: '8px', padding: '10px', backgroundColor: '#e8f5e9', width: '30%' }}>
            <h2 style={{ color: '#2e7d32' }}>Running</h2>
            <ul>
                {greenNodes.length > 0 ? (
                greenNodes.map(node => <li key={node}>{node}</li>)
                ) : (
                <li>None</li>
                )}
            </ul>
        </div>

      {/* Red Box */}
        <div style={{ border: '1px solid #c62828', borderRadius: '8px', padding: '10px', backgroundColor: '#ffebee', width: '30%' }}>
            <h2 style={{ color: '#c62828' }}>Missing</h2>
            <ul>
                {redNodes.length > 0 ? (
                redNodes.map(node => <li key={node}>{node}</li>)
                ) : (
                <li>None</li>
                )}
            </ul>
        </div>

      {/* Yellow Box */}
        <div style={{ border: '1px solid #f9a825', borderRadius: '8px', padding: '10px', backgroundColor: '#fffde7', width: '30%' }}>
            <h2 style={{ color: '#f9a825' }}>Unexpected</h2>
            <ul>
                {yellowNodes.length > 0 ? (
                yellowNodes.map(node => <li key={node}>{node}</li>)
                ) : (
                <li>None</li>
                )}
            </ul>
        </div>
    </div>
  );
}

export default RosNodeStatus;