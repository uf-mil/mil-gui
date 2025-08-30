import { PoseWithCovariance, TwistWithCovariance } from "./geometry_msgs";
import { Header } from "./std_msgs"

export interface Odometry {
    header: Header;
    child_frame_id: string;
    pose: PoseWithCovariance;
    twist: TwistWithCovariance;
}
