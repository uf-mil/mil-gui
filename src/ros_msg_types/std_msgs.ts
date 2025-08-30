import { Time } from "./builtin_interfaces"


export interface String {
    data: string;
}

export interface Header {
    stamp: Time;
    frame_id: string;
}

