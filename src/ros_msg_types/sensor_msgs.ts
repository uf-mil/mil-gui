import { Header } from "./std_msgs"
import { Quaternion, Vector3 } from "./geometry_msgs"

export interface Imu {
    header: Header;
    orientation: Quaternion;
    orientation_covariance: [number, number, number, number, number, number, number, number, number];
    angular_velocity: Vector3;
    angular_velocity_covariance: [number, number, number, number, number, number, number, number, number];
    linear_acceleration: Vector3;
    linear_acceleration_covariance: [number, number, number, number, number, number, number, number, number];
}

export interface Image {
    header: Header;
    height: number;
    width: number;
    encoding: string;
    is_bigendian: number;
    step: number;
    data: Uint8Array;
}
