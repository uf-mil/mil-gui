/**
 * SimulationControl
 * - Collapsible panel to publish fake sensor data
 * - IMU: ~20Hz, DVL: ~10Hz, Depth: ~16Hz (realistic rates)
 * - Provides scenarios (idle, dive, surface, forward, circle, wobble)
 * - Status-aware header and ROS bridge topic publishers
 */
import React, { useState, useRef, useEffect } from 'react';
import { useRos } from './RosContext';
import { useTopic } from '../hooks/useTopic';
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
    // Use drift-compensated timer for IMU to hit ~20Hz reliably in browsers
    const imuTimerRef = useRef<number | null>(null);
    const dvlTimerRef = useRef<NodeJS.Timer | null>(null);
    const depthTimerRef = useRef<NodeJS.Timer | null>(null);
    const stateTimerRef = useRef<NodeJS.Timer | null>(null);
    
    const { ros } = useRos();
    // Data source selection
    const [dataSource, setDataSource] = useState<'synthetic' | 'bag'>(() => {
        try { return (localStorage.getItem('sim.source') as any) || 'synthetic'; } catch { return 'synthetic'; }
    });
    // Subscribe to topics for seeding
    const [imuMsg] = useTopic<any>('/imu/data', 'sensor_msgs/Imu');
    const [depthMsg] = useTopic<any>('/depth/pose', 'geometry_msgs/PoseWithCovarianceStamped');
    const [dvlMsg] = useTopic<any>('/dvl/odom', 'nav_msgs/Odometry');
    // Seeding feedback state
    const [seededAt, setSeededAt] = useState<number | null>(null);
    const [seedSummary, setSeedSummary] = useState<string>('');
    
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
        if (connected && ros && dataSource === 'synthetic') {
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
        if (connected && ros && dataSource === 'bag') {
            if (imuPublisher.current) { imuPublisher.current.unadvertise(); imuPublisher.current = null; }
            if (depthPublisher.current) { depthPublisher.current.unadvertise(); depthPublisher.current = null; }
            if (dvlPublisher.current) { dvlPublisher.current.unadvertise(); dvlPublisher.current = null; }
        }
    }, [connected, ros, dataSource]);

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

    // Quaternion -> Euler (for seeding from IMU)
    const quaternionToEuler = (x: number, y: number, z: number, w: number) => {
        const sinr_cosp = 2 * (w * x + y * z);
        const cosr_cosp = 1 - 2 * (x * x + y * y);
        const roll = Math.atan2(sinr_cosp, cosr_cosp);

        const sinp = 2 * (w * y - z * x);
        const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

        const siny_cosp = 2 * (w * z + x * y);
        const cosy_cosp = 1 - 2 * (y * y + z * z);
        const yaw = Math.atan2(siny_cosp, cosy_cosp);
        return { roll, pitch, yaw };
    };

    // Seed initial sim state from latest ROS topics
    const seedFromRosTopics = () => {
        const s = simStateRef.current;
        let seededParts: string[] = [];

        const q = (imuMsg as any)?.orientation;
        if (q && typeof q.x === 'number' && typeof q.y === 'number' && typeof q.z === 'number' && typeof q.w === 'number') {
            const e = quaternionToEuler(q.x, q.y, q.z, q.w);
            s.orientation = { roll: e.roll, pitch: e.pitch, yaw: e.yaw };
            seededParts.push('orientation from /imu/data');
        }

        const p = (depthMsg as any)?.pose?.pose?.position;
        if (p && typeof p.z === 'number') {
            s.position.z = p.z;
            s.depth = -p.z; // assume z-up
            seededParts.push('depth from /depth/pose');
        }

        const v = (dvlMsg as any)?.twist?.twist?.linear;
        if (v && (typeof v.x === 'number' || typeof v.y === 'number' || typeof v.z === 'number')) {
            s.velocity = { x: v.x ?? 0, y: v.y ?? 0, z: v.z ?? 0 };
            seededParts.push('velocity from /dvl/odom');
        }

        if (seededParts.length === 0) {
            setSeedSummary('No recent messages available to seed. Make sure rosbag2 is playing and topics are active.');
            setSeededAt(Date.now());
            return;
        }

        setSeedSummary(`Seeded ${seededParts.join(', ')}`);
        setSeededAt(Date.now());
        // Force a tiny state change to ensure any UI bound to sim state can reflect updates
        // (simStateRef updates alone do not trigger a re-render)
        // We reuse seedSummary/seededAt states above for this purpose.
        // Optional: console for debugging
        // eslint-disable-next-line no-console
        console.log('[Simulation] Seeded from ROS topics:', { orientation: q, positionZ: p?.z, velocity: v });
    };

    // Simulation scenarios - update state based on scenario
    const updateSimulationState = (dt: number) => {
        const state = simStateRef.current;
        state.time += dt;
        
        // Apply scenario-specific motions
        switch (simulationScenario) {
            case 'dive':
                state.velocity.z = -0.5; // Diving down
                state.position.z += state.velocity.z * dt;
                state.depth = -state.position.z;
                break;
                
            case 'surface':
                state.velocity.z = 0.3; // Rising up
                state.position.z += state.velocity.z * dt;
                state.depth = -state.position.z;
                if (state.depth < 0) state.depth = 0; // Can't go above surface
                break;
                
            case 'forward':
                state.velocity.x = 1.0; // Moving forward
                state.position.x += state.velocity.x * dt;
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
    };

    // Publish IMU data (~20Hz)
    const publishIMU = () => {
        const state = simStateRef.current;
        const noise = () => (Math.random() - 0.5) * 0.01;
        
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
                    x: (state.orientation.roll - (simStateRef.current.orientation.roll || 0)) / 0.05 + noise(),
                    y: (state.orientation.pitch - (simStateRef.current.orientation.pitch || 0)) / 0.05 + noise(),
                    z: (state.orientation.yaw - (simStateRef.current.orientation.yaw || 0)) / 0.05 + noise()
                }
            });
            imuPublisher.current.publish(imuMsg);
        }
    };

    // Publish Depth data (~16Hz)
    const publishDepth = () => {
        const state = simStateRef.current;
        const noise = () => (Math.random() - 0.5) * 0.01;
        
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
    };

    // Publish DVL data (~10Hz)
    const publishDVL = () => {
        const state = simStateRef.current;
        const noise = () => (Math.random() - 0.5) * 0.01;
        
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
        if (dataSource === 'bag') return; // don't publish in bag mode
        if (isSimulating) {
            // Stop all sensor publishers and state updater
            if (stateTimerRef.current) {
                clearInterval(stateTimerRef.current);
                stateTimerRef.current = null;
            }
            if (imuTimerRef.current !== null) {
                window.clearTimeout(imuTimerRef.current);
                imuTimerRef.current = null;
            }
            if (dvlTimerRef.current) {
                clearInterval(dvlTimerRef.current);
                dvlTimerRef.current = null;
            }
            if (depthTimerRef.current) {
                clearInterval(depthTimerRef.current);
                depthTimerRef.current = null;
            }
            setIsSimulating(false);
        } else {
            // Start state updater at high frequency
            stateTimerRef.current = setInterval(() => updateSimulationState(0.02), 20); // 50Hz state updates
            
            // Start IMU with drift-compensated timer (~20Hz)
            const imuPeriod = 50; // ms
            const startIMULoop = () => {
                let next = performance.now() + imuPeriod;
                const tick = () => {
                    publishIMU();
                    const now = performance.now();
                    // schedule next run compensating for drift
                    next += imuPeriod;
                    const delay = Math.max(0, next - now);
                    imuTimerRef.current = window.setTimeout(tick, delay) as unknown as number;
                };
                imuTimerRef.current = window.setTimeout(tick, imuPeriod) as unknown as number;
            };
            startIMULoop();
            // Start remaining publishers at their respective rates
            dvlTimerRef.current = setInterval(publishDVL, 100);       // ~10Hz
            depthTimerRef.current = setInterval(publishDepth, 62.5);  // ~16Hz
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

    // Persist data source and stop timers when switching to bag
    useEffect(() => {
        try { localStorage.setItem('sim.source', dataSource); } catch {}
        if (dataSource === 'bag' && isSimulating) {
            if (stateTimerRef.current) { clearInterval(stateTimerRef.current); stateTimerRef.current = null; }
            if (imuTimerRef.current !== null) { window.clearTimeout(imuTimerRef.current); imuTimerRef.current = null; }
            if (dvlTimerRef.current) { clearInterval(dvlTimerRef.current); dvlTimerRef.current = null; }
            if (depthTimerRef.current) { clearInterval(depthTimerRef.current); depthTimerRef.current = null; }
            setIsSimulating(false);
        }
    }, [dataSource]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (stateTimerRef.current) clearInterval(stateTimerRef.current);
            if (imuTimerRef.current !== null) window.clearTimeout(imuTimerRef.current);
            if (dvlTimerRef.current) clearInterval(dvlTimerRef.current);
            if (depthTimerRef.current) clearInterval(depthTimerRef.current);
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
                        <label htmlFor="source-select">Data Source:</label>
                        <select
                            id="source-select"
                            value={dataSource}
                            onChange={(e) => setDataSource(e.target.value as 'synthetic' | 'bag')}
                            className="scenario-select"
                        >
                            <option value="synthetic">Synthetic Simulation</option>
                            <option value="bag">Bag Playback (listen only)</option>
                        </select>
                    </div>
                    <div className="control-group">
                        <label htmlFor="scenario-select">Scenario:</label>
                        <select 
                            id="scenario-select"
                            value={simulationScenario} 
                            onChange={(e) => setSimulationScenario(e.target.value)}
                            disabled={isSimulating || dataSource === 'bag'}
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
                    
                    {dataSource === 'synthetic' ? (
                        <button 
                            onClick={toggleSimulation}
                            className={`sim-toggle-btn ${isSimulating ? 'stop' : 'start'}`}
                        >
                            {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
                        </button>
                    ) : (
                        <button 
                            onClick={seedFromRosTopics}
                            className="sim-toggle-btn start"
                            disabled={!(imuMsg || depthMsg || dvlMsg)}
                            title="Seed simulation state from current ROS topics"
                        >
                            Seed from ROS topics
                        </button>
                    )}
                </div>
                
                <div className="simulation-info">
                    {dataSource === 'synthetic' ? (
                        <span>Publishing to /imu/data (~20Hz), /dvl/odom (~10Hz), /depth/pose (~16Hz)</span>
                    ) : (
                        <span>Listening to /imu/data, /dvl/odom, /depth/pose (run: ros2 bag play ...)</span>
                    )}
                </div>
                {seededAt && (
                    <div className="seed-info" style={{ marginTop: 6, fontSize: 12, color: seedSummary.startsWith('No recent') ? '#b00020' : '#2e7d32' }}>
                        {seedSummary} — {new Date(seededAt).toLocaleTimeString()}
                    </div>
                )}
            </div>
            </div>
        </div>
    );
};

export default SimulationControl;
