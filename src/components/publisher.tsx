import React, { useEffect, useRef } from 'react'
import * as ROSLIB from 'roslib'
import { useRos } from './RosContext';

function Publisher() {
    const { ros, connected } = useRos()
    const topicRef = useRef<ROSLIB.Topic | null>(null); // when the topic changes, don't re-render lol

    // setup topic
    useEffect(() => {
        topicRef.current = new ROSLIB.Topic({
            ros: ros,
            name: '/hi_adam',
            messageType: 'std_msgs/String'
        });

        // called on clean-up
        return () => {
            if (topicRef.current) { topicRef.current.unadvertise(); }
        };
    }, [ros])

    function pub_it() {
        if (topicRef.current === null) {
            console.error("topic was null L")
            return
        }

        const msg = new ROSLIB.Message({
            data: 'Hello, Adam!'
        });
        topicRef.current.publish(msg)
        console.log("hi_adam")
    }

    const msg_status = connected ? "connected" : "not connected";

    return (
        <>
            <div>
                {msg_status}
            </div>

            <button onClick={pub_it}> click me </button>

        </>
    )
}

export default Publisher
