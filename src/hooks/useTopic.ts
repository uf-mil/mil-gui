import { useEffect, useRef, useState } from 'react';
import * as ROSLIB from 'roslib';
import { useRos } from '../components/RosContext';

type ROSMessageObject = Record<string, any>;

type TopicHookReturn<T extends ROSMessageObject> = [
    T | null,
    number,
    { topic: ROSLIB.Topic | null; publish: (msg: T) => void }
];

const LENGTH_OF_HZ_WINDOW = 10;
const TOPIC_TIMEOUT_SECONDS = 3;

// Generic type for the hook to handle different message types
export function useTopic<T extends ROSMessageObject>(topicName: string, messageType: string): TopicHookReturn<T> {
    const { ros, connected } = useRos();
    const topicRef = useRef<ROSLIB.Topic | null>(null);
    const [message, setMessage] = useState<T | null>(null);
    const [hz, setHz] = useState<number>(0);

    const intervalRef = useRef<NodeJS.Timer | null>(null);

    const timesRef = useRef<number[]>([])

    useEffect(() => {
        // Clear any existing interval
        if (intervalRef.current) { clearInterval(intervalRef.current); }


        intervalRef.current = setInterval(() => {
            const topic_is_dead = timesRef.current.length === 0 || Date.now() - timesRef.current[timesRef.current.length - 1] > TOPIC_TIMEOUT_SECONDS * 1000
            if (topic_is_dead) {
                timesRef.current = []
                setHz(0)
            }
        }, TOPIC_TIMEOUT_SECONDS * 1000);

        // delete interval on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [])

    // Set up topic when ROS connection changes
    useEffect(() => {
        if (!ros || !ros.isConnected) return;

        topicRef.current = new ROSLIB.Topic({
            ros: ros,
            name: topicName,
            messageType: messageType
        });

        // Subscribe to the topic
        topicRef.current.subscribe((msg: ROSLIB.Message) => {
            setMessage(msg as T); // I hate casting ts

            // update times
            timesRef.current.push(Date.now())
            while (timesRef.current.length > LENGTH_OF_HZ_WINDOW) { timesRef.current.shift() }

            // take times and create delta-t then sum and average
            // TODO move the hz calculation to its own funciton so that it's eaiser to read
            const diff_of_times = timesRef.current.slice(0, -1).map((num, index) => timesRef.current[index + 1] - num);
            const initialValue = 0;
            const sum_of_times = diff_of_times.reduce(
                (accumulator, currentValue) => accumulator + currentValue,
                initialValue,
            );
            const average_time_between_messages_in_seconds = (sum_of_times / 1000) / diff_of_times.length // 1000 bcuz ms to s 
            const hz_or_nan = 1 / average_time_between_messages_in_seconds
            const hz = Number.isNaN(hz_or_nan) ? 0 : hz_or_nan
            setHz(Number(hz.toFixed(2)))
        });

        // Cleanup on unmount or when dependencies change
        return () => {
            if (topicRef.current) {
                topicRef.current.unsubscribe();
                topicRef.current.unadvertise();
            }
        };
    }, [ros, topicName, messageType, connected]);

    // Function to publish messages to the topic
    const publish = (msg: T) => {
        if (topicRef.current && connected) {
            topicRef.current.publish(new ROSLIB.Message(msg));
        } else {
            console.error('Cannot publish: topic not initialized or ROS not connected');
        }
    };

    // Return current message and the topic reference with publish method
    return [message, hz, { topic: topicRef.current, publish }];
}
