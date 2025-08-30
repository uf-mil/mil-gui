import { Header } from "./std_msgs";

export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface PoseWithCovarianceStamped {
    header: Header;
    pose: PoseWithCovariance;
}

export interface PoseWithCovariance {
    pose: Pose
    covariance: number[] & { length: 36 };
}

export interface Pose {
    position: Point;
    orientation: Quaternion
}

export interface Point {
    x: number;
    y: number;
    z: number;
}

export interface TwistWithCovariance {
    twist: Twist;
    covariance: number[] & { length: 36 };
}

export interface Twist {
    linear: Vector3
    angular: Vector3
}
