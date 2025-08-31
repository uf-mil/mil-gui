import React, { useEffect, useRef } from 'react'
import './preflight.css'
import { useTopic } from '../hooks/useTopic';
import { PoseWithCovarianceStamped } from '../ros_msg_types/geometry_msgs'
import { Odometry } from '../ros_msg_types/nav_msgs';
import { Imu } from '../ros_msg_types/sensor_msgs';

/*
    *
    * PRE FLIGHT STEPS
    * 1. checking sensor topics (IMU, DVL, Depth Sensor)
    * 2. checking cameras (topics for front cam and down cam)
    * 3. spin thrusters (unkill, spin thrusters, maybe kill while they are spinning to test kill)
    *
    * */

function create_dead_topic_list_item(topic_hz: number, msg: string) {
    const topic_is_dead = topic_hz === 0
    if (!topic_is_dead) { return }

    return (<li className='bad-card-li'>{msg}</li>);
}

function create_alive_topic_list_item(topic_hz: number, msg: string) {
    const topic_is_dead = topic_hz === 0
    if (topic_is_dead) { return }

    return (<li className='good-card-li'>{msg}</li>);
}

function Preflight() {
    // TODO add camera topics and display what the cameras see (either before or after AI)
    const [imu_msg, imu_hz, _imu_topic] = useTopic<Imu>('/imu/data', 'sensor_msgs/Imu');
    const [depth_msg, depth_hz, _depth_topic] = useTopic<PoseWithCovarianceStamped>('/depth/pose', 'geometry_msgs/PoseWithCovarianceStamped');
    const [dvl_msg, dvl_hz, _dvl_topic] = useTopic<Odometry>('/dvl/odom', 'nav_msgs/Odometry');

    return (
        <>
            <div className='preflight-card'>
                <div className='preflight-bad-card'>
                    {create_dead_topic_list_item(imu_hz, "imu lost!")}
                    {create_dead_topic_list_item(dvl_hz, "dvl lost!")}
                    {create_dead_topic_list_item(depth_hz, "depth lost!")}
                </div>

                <div className='preflight-good-card'>
                    {create_alive_topic_list_item(imu_hz, `Imu Hz: ${imu_hz}`)}
                    {create_alive_topic_list_item(dvl_hz, `dvl Hz: ${dvl_hz}`)}
                    {create_alive_topic_list_item(depth_hz, `Depth Hz: ${depth_hz}`)}
                </div>

                <div className='preflight-log-card'>
                    <div className='imu-log'>
                        <ul className='log-list'>
                            <li className='log-list-item'>{`quat x: ${imu_msg?.orientation.x}`}</li>
                            <li className='log-list-item'>{`quat y: ${imu_msg?.orientation.y}`}</li>
                            <li className='log-list-item'>{`quat z: ${imu_msg?.orientation.z}`}</li>
                            <li className='log-list-item'>{`quat w: ${imu_msg?.orientation.w}`}</li>

                            <li className='log-list-item'>{`linear accel x: ${imu_msg?.linear_acceleration.x}`}</li>
                            <li className='log-list-item'>{`angular twist x: ${imu_msg?.angular_velocity.x}`}</li>
                            <li className='log-list-item'>{`linear accel y: ${imu_msg?.linear_acceleration.y}`}</li>

                            <li className='log-list-item'>{`angular twist y: ${imu_msg?.angular_velocity.y}`}</li>
                            <li className='log-list-item'>{`linear accel z: ${imu_msg?.linear_acceleration.z}`}</li>
                            <li className='log-list-item'>{`angular twist z: ${imu_msg?.angular_velocity.z}`}</li>
                        </ul>
                    </div>
                    <div className='dvl-log'>
                        <ul>
                            <li className='log-list-item'>{`linear velocity x: ${dvl_msg?.twist.twist.linear.x}`}</li>
                            <li className='log-list-item'>{`linear velocity y: ${dvl_msg?.twist.twist.linear.y}`}</li>
                            <li className='log-list-item'>{`linear velocity z: ${dvl_msg?.twist.twist.linear.z}`}</li>
                        </ul>
                    </div>
                    <div className='depth-log'>{`depth: ${depth_msg?.pose.pose.position.z}`}</div>
                </div>
            </div>

        </>
    )
}

export default Preflight
