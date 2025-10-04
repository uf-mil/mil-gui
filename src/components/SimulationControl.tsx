/**
 * SimulationControl
 * - Collapsible panel to publish fake sensor data for IMU/Depth/DVL at 10Hz
 * - Provides scenarios (idle, dive, surface, forward, circle, wobble)
 * - Status-aware header and ROS bridge topic publishers
 */
import React, { useState, useRef, useEffect } from 'react';
import { useRos } from './RosContext';
import * as ROSLIB from 'roslib';
import './SimulationControl.css';

interface SimulationControlProps {
    connected: boolean;
}

const SimulationControl: React.FC<SimulationControlProps> = ({ connected }) => {
    // Simulation state
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationScenario, setSimulationScenario] = useState(() => {
        try {
            const v = localStorage.getItem('sim.scenario');
            return v ?? 'idle';
        } catch { return 'idle'; }
    });
    const [isExpanded, setIsExpanded] = useState<boolean>(() => {
        try {
            const v = localStorage.getItem('sim.expanded');
            return v ? v === '1' : false;
        } catch { return false; }
    });
    const simulationRef = useRef<NodeJS.Timer | null>(null);
    
    const { ros } = useRos();
    
    // Publishers for fake data
    const imuPublisher = useRef<ROSLIB.Topic | null>(null);
    const depthPublisher = useRef<ROSLIB.Topic | null>(null);
    const dvlPublisher = useRef<ROSLIB.Topic | null>(null);
    
    // Simulation state variables
    const simStateRef = useRef({
        time: 0,
        depth: -2.0, // Starting depth (negative is underwater)
        orientation: { roll: 0, pitch: 0, yaw: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: -2.0 }
    });

    // Initialize publishers when connected
    useEffect(() => {
        if (connected && ros) {
            imuPublisher.current = new ROSLIB.Topic({
                ros: ros,
                name: '/imu/data',
                messageType: 'sensor_msgs/Imu'
            });
            
            depthPublisher.current = new ROSLIB.Topic({
                ros: ros,
                name: '/depth/pose',
                messageType: 'geometry_msgs/PoseWithCovarianceStamped'
            });
            
            dvlPublisher.current = new ROSLIB.Topic({
                ros: ros,
                name: '/dvl/odom',
                messageType: 'nav_msgs/Odometry'
            });
        }
    }, [connected, ros]);

    // Helper function to convert euler angles to quaternion
    const eulerToQuaternion = (roll: number, pitch: number, yaw: number) => {
        const cy = Math.cos(yaw * 0.5);
        const sy = Math.sin(yaw * 0.5);
        const cp = Math.cos(pitch * 0.5);
        const sp = Math.sin(pitch * 0.5);
        const cr = Math.cos(roll * 0.5);
        const sr = Math.sin(roll * 0.5);

        return {
            w: cr * cp * cy + sr * sp * sy,
            x: sr * cp * cy - cr * sp * sy,
            y: cr * sp * cy + sr * cp * sy,
            z: cr * cp * sy - sr * sp * cy
        };
    };

    // Simulation scenarios
    const runSimulationStep = () => {
        const state = simStateRef.current;
        state.time += 0.1; // 100ms timestep
        
        // Apply scenario-specific motions
        switch (simulationScenario) {
            case 'dive':
                state.velocity.z = -0.5; // Diving down
                state.position.z += state.velocity.z * 0.1;
                state.depth = -state.position.z;
                break;
                
            case 'surface':
                state.velocity.z = 0.3; // Rising up
                state.position.z += state.velocity.z * 0.1;
                state.depth = -state.position.z;
                if (state.depth < 0) state.depth = 0; // Can't go above surface
                break;
                
            case 'forward':
                state.velocity.x = 1.0; // Moving forward
                state.position.x += state.velocity.x * 0.1;
                break;
                
            case 'circle':
                const radius = 5.0;
                const angularVel = 0.1;
                state.position.x = radius * Math.cos(state.time * angularVel);
                state.position.y = radius * Math.sin(state.time * angularVel);
                state.velocity.x = -radius * angularVel * Math.sin(state.time * angularVel);
                state.velocity.y = radius * angularVel * Math.cos(state.time * angularVel);
                state.orientation.yaw = state.time * angularVel;
                break;
                
            case 'wobble':
                // Simulate rough waters or instability
                state.orientation.roll = 0.1 * Math.sin(state.time * 2);
                state.orientation.pitch = 0.05 * Math.cos(state.time * 3);
                break;
                
            default: // idle
                state.velocity.x = 0;
                state.velocity.y = 0;
                state.velocity.z = 0;
        }
        
        // Add some realistic noise
        const noise = () => (Math.random() - 0.5) * 0.01;
        
        // Publish IMU data
        if (imuPublisher.current) {
            const quat = eulerToQuaternion(
                state.orientation.roll + noise(),
                state.orientation.pitch + noise(),
                state.orientation.yaw + noise()
            );
            
            const imuMsg = new ROSLIB.Message({
                header: {
                    stamp: { sec: Math.floor(Date.now() / 1000), nanosec: 0 },
                    frame_id: 'imu_link'
                },
                orientation: quat,
                linear_acceleration: {
                    x: state.velocity.x * 0.1 + noise(),
                    y: state.velocity.y * 0.1 + noise(),
                    z: 9.81 + state.velocity.z * 0.1 + noise()
                },
                angular_velocity: {
                    x: (state.orientation.roll - (simStateRef.current.orientation.roll || 0)) / 0.1 + noise(),
                    y: (state.orientation.pitch - (simStateRef.current.orientation.pitch || 0)) / 0.1 + noise(),
                    z: (state.orientation.yaw - (simStateRef.current.orientation.yaw || 0)) / 0.1 + noise()
                }
            });
            imuPublisher.current.publish(imuMsg);
        }
        
        // Publish depth data
        if (depthPublisher.current) {
            const depthMsg = new ROSLIB.Message({
                header: {
                    stamp: { sec: Math.floor(Date.now() / 1000), nanosec: 0 },
                    frame_id: 'depth_link'
                },
                pose: {
                    pose: {
                        position: {
                            x: state.position.x,
                            y: state.position.y,
                            z: state.depth + noise()
                        },
                        orientation: { x: 0, y: 0, z: 0, w: 1 }
                    }
                }
            });
            depthPublisher.current.publish(depthMsg);
        }
        
        // Publish DVL data
        if (dvlPublisher.current) {
            const dvlMsg = new ROSLIB.Message({
                header: {
                    stamp: { sec: Math.floor(Date.now() / 1000), nanosec: 0 },
                    frame_id: 'dvl_link'
                },
                twist: {
                    twist: {
                        linear: {
                            x: state.velocity.x + noise(),
                            y: state.velocity.y + noise(),
                            z: state.velocity.z + noise()
                        },
                        angular: { x: 0, y: 0, z: 0 }
                    }
                }
            });
            dvlPublisher.current.publish(dvlMsg);
        }
    };

    // Start/stop simulation
    const toggleSimulation = () => {
        if (isSimulating) {
            if (simulationRef.current) {
                clearInterval(simulationRef.current);
                simulationRef.current = null;
            }
            setIsSimulating(false);
        } else {
            simulationRef.current = setInterval(runSimulationStep, 100); // 10Hz
            setIsSimulating(true);
        }
    };

    // Persist scenario and expanded state
    useEffect(() => {
        try { localStorage.setItem('sim.scenario', simulationScenario); } catch {}
    }, [simulationScenario]);

    useEffect(() => {
        try { localStorage.setItem('sim.expanded', isExpanded ? '1' : '0'); } catch {}
    }, [isExpanded]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (simulationRef.current) {
                clearInterval(simulationRef.current);
            }
        };
    }, []);

    if (!connected) return null;

    return (
        <div className={`simulation-wrapper ${isExpanded ? 'expanded' : ''}`}>
            <div className={`simulation-control ${isExpanded ? 'expanded' : ''} ${isSimulating ? 'running' : 'stopped'}`}>
            <div className="simulation-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="header-content">
                    <h4>Sensor Data Simulation</h4>
                    <div className="header-status">
                        <span className={`status-badge ${isSimulating ? 'running' : 'stopped'}`}>
                            {isSimulating ? 'Running' : 'Stopped'}
                        </span>
                        <span className={`expand-chevron ${isExpanded ? 'expanded' : ''}`}>
                            ▼
                        </span>
                    </div>
                </div>
            </div>
            
            <div className={`simulation-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="simulation-grid">
                    <div className="control-group">
                        <label htmlFor="scenario-select">Scenario:</label>
                        <select 
                            id="scenario-select"
                            value={simulationScenario} 
                            onChange={(e) => setSimulationScenario(e.target.value)}
                            disabled={isSimulating}
                            className="scenario-select"
                        >
                            <option value="idle">Idle (Stationary)</option>
                            <option value="dive">Dive Down</option>
                            <option value="surface">Surface Up</option>
                            <option value="forward">Move Forward</option>
                            <option value="circle">Circle Pattern</option>
                            <option value="wobble">Wobble (Rough Waters)</option>
                        </select>
                    </div>
                    
                    <button 
                        onClick={toggleSimulation}
                        className={`sim-toggle-btn ${isSimulating ? 'stop' : 'start'}`}
                    >
                        {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
                    </button>
                </div>
                
                <div className="simulation-info">
                    <span>Publishing to /imu/data, /depth/pose, /dvl/odom at 10Hz</span>
                </div>
            </div>
            </div>
        </div>
    );
};

export default SimulationControl;
